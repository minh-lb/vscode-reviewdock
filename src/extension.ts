import * as vscode from 'vscode';
import { ConnectionService } from './application/connectionService';
import {
  RepositoryService,
  type RepositoryBindingStore,
  type RemoteCandidate,
} from './application/repositoryService';
import { ReviewService } from './application/reviewService';
import type { ReviewProvider } from './application/ports';
import type { Connection, RepositoryRef, ReviewRequestSummary } from './domain/models';
import { AppError } from './domain/errors';
import { ProviderHttpClient } from './infrastructure/http/providerHttpClient';
import { VscodeSecretStore, MementoStore } from './infrastructure/storage/vscodeStores';
import { GitHubAdapter } from './infrastructure/providers/github/githubAdapter';
import { GitLabAdapter } from './infrastructure/providers/gitlab/gitlabAdapter';
import { ConnectionsTree, type ConnectionNode } from './presentation/tree/connectionsTree';
import { RequestsTree, type RequestNode } from './presentation/tree/requestsTree';
import { pickSidebarRepositories } from './presentation/tree/repositoryPicker';
import { connectionChoice } from './presentation/tree/connectionSelection';
import { reviewFilters, selectWorkspaceFolder } from './presentation/tree/treeItems';
import { openReviewRequestPanel } from './presentation/webview/reviewRequestPanel';

interface GitApi {
  repositories: {
    rootUri: vscode.Uri;
    state: { remotes: { fetchUrl?: string; pushUrl?: string }[] };
  }[];
}
interface GitExtensionApi {
  getAPI(version: 1): GitApi;
}
const allFolders = () => vscode.workspace.workspaceFolders ?? [];
async function chooseFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = allFolders();
  if (folders.length === 1) return folders[0];
  if (!folders.length) {
    void vscode.window.showWarningMessage(
      'Open a workspace folder before selecting a ReviewDock connection or repository.',
    );
    return undefined;
  }
  const selected = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { placeHolder: 'Choose the workspace folder for this connection and repository binding' },
  );
  return selected?.folder;
}
async function getGitApi(): Promise<GitApi | undefined> {
  const extension = vscode.extensions.getExtension<GitExtensionApi>('vscode.git');
  if (!extension) return undefined;
  try {
    return (extension.isActive ? extension.exports : await extension.activate()).getAPI(1);
  } catch {
    return undefined;
  }
}
async function remotesFor(folder: vscode.WorkspaceFolder): Promise<string[]> {
  const api = await getGitApi();
  if (api)
    return api.repositories
      .filter((repo) => repo.rootUri.toString() === folder.uri.toString())
      .flatMap((repo) =>
        repo.state.remotes.flatMap((remote) =>
          [remote.fetchUrl, remote.pushUrl].filter((value): value is string => !!value),
        ),
      );
  return [];
}

export function activate(context: vscode.ExtensionContext): void {
  const global = new MementoStore(context.globalState);
  const workspace = new MementoStore(context.workspaceState) as MementoStore &
    RepositoryBindingStore;
  const secrets = new VscodeSecretStore(context.secrets);
  const httpRef: { client?: ProviderHttpClient } = {};
  const connections = new ConnectionService(global, secrets, {}, undefined, undefined, (id) =>
    httpRef.client?.cancelConnection(id),
  );
  const http = new ProviderHttpClient(secrets, fetch, 30_000, async (id) =>
    connections.getLiveConnectionState(id),
  );
  httpRef.client = http;
  const providers = new Map<string, ReviewProvider>();
  const reviews = new Map<string, ReviewService>();
  const panels = new Set<vscode.WebviewPanel>();
  const providerFor = (connection: Connection): ReviewProvider => {
    const current = connections.getConnection(connection.id);
    let provider = providers.get(current.id);
    if (!provider) {
      provider =
        current.provider === 'github'
          ? new GitHubAdapter(current, http)
          : new GitLabAdapter(current, http);
      providers.set(current.id, provider);
    }
    return provider;
  };
  const reviewFor = (connection: Connection): ReviewService => {
    let review = reviews.get(connection.id);
    if (!review) {
      review = new ReviewService(providerFor(connection));
      reviews.set(connection.id, review);
    }
    return review;
  };
  const repositories = new RepositoryService(connections, providerFor, workspace);
  const connectionTree = new ConnectionsTree(connections, providerFor);
  let activeFolder = selectWorkspaceFolder(allFolders());
  let activeFolderExplicitlySelected = false;
  const requestsTree = new RequestsTree(
    () => activeFolder,
    connections,
    repositories,
    (id) => providerFor(connections.getConnection(id)),
    openRequest,
  );
  const requestView = vscode.window.createTreeView('reviewdock.requests', {
    treeDataProvider: requestsTree,
    showCollapseAll: true,
  });
  const connectionView = vscode.window.createTreeView('reviewdock.connections', {
    treeDataProvider: connectionTree,
  });
  context.subscriptions.push(requestView, connectionView, requestsTree, connectionTree);
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      activeFolder = selectWorkspaceFolder(
        allFolders(),
        activeFolder,
        activeFolderExplicitlySelected,
      );
      activeFolderExplicitlySelected =
        allFolders().length > 1 && !!activeFolder && activeFolderExplicitlySelected;
      requestsTree.refresh();
    }),
  );

  async function openRequest(
    connectionId: string,
    summary: ReviewRequestSummary,
    repositoryId?: string,
  ): Promise<void> {
    const connection = connections.getConnection(connectionId);
    if (!connection.enabled)
      throw new AppError(
        'This connection is disabled. Enable it or choose another connection.',
        'connection-disabled',
      );
    const binding = activeFolder ? repositories.getBinding(activeFolder.uri.toString()) : undefined;
    if (!repositoryId && (!binding || binding.connectionId !== connectionId))
      throw new AppError(
        'The review request is no longer bound to the selected workspace folder.',
        'validation',
      );
    if (
      summary.repositoryId !== (repositoryId ?? binding?.repositoryId) ||
      (summary.connectionId && summary.connectionId !== connectionId)
    )
      throw new AppError(
        'The selected review request belongs to a different repository or connection.',
        'validation',
      );
    const provider = providerFor(connection);
    if (repositoryId && summary.connectionId && summary.connectionId !== connectionId)
      throw new AppError('The review request belongs to a different connection.', 'validation');
    const repository = await provider.getRepository(repositoryId ?? binding!.repositoryId);
    if (
      repository.id !== summary.repositoryId ||
      (repository.connectionId && repository.connectionId !== connectionId)
    )
      throw new AppError(
        'The review request belongs to a different repository or connection.',
        'validation',
      );
    const panel = openReviewRequestPanel(context.extensionUri, {
      connection,
      repository,
      summary,
      provider,
      review: reviewFor(connection),
      onDidMutate: () => {
        requestsTree.refresh();
        connectionTree.invalidate(connectionId, repository.id);
      },
    });
    panels.add(panel);
    panel.onDidDispose(() => panels.delete(panel));
  }

  const changed = () => {
    for (const panel of panels) panel.dispose();
    panels.clear();
    providers.clear();
    reviews.clear();
    connectionTree.refresh();
    requestsTree.refresh();
  };
  const commands: [string, (...args: never[]) => unknown][] = [
    ['reviewdock.addConnection', addConnection],
    ['reviewdock.manageConnections', manageConnections],
    ['reviewdock.selectConnectionRepositories', selectConnectionRepositories],
    ['reviewdock.selectConnection', selectConnection],
    ['reviewdock.selectRepository', selectRepository],
    [
      'reviewdock.refresh',
      async (node?: RequestNode) => {
        if (node?.kind === 'more') await requestsTree.loadMore(node);
        else requestsTree.refresh();
      },
    ],
    [
      'reviewdock.openReviewRequest',
      async (summary?: ReviewRequestSummary) => {
        if (!summary) summary = await chooseRequest();
        if (summary) await requestsTree.openSummary(summary);
      },
    ],
    [
      'reviewdock.openConnectionReviewRequest',
      async (node?: ConnectionNode) => {
        if (node?.kind === 'request') {
          try {
            await openRequest(node.connection.id, node.summary, node.repository.id);
          } catch (error) {
            showError(error);
          }
        }
      },
    ],
    [
      'reviewdock.loadConnectionTreeMore',
      async (node?: ConnectionNode) => {
        if (node) await connectionTree.loadMore(node);
      },
    ],
    [
      'reviewdock.retryConnectionTree',
      async (node?: ConnectionNode) => {
        if (node) await connectionTree.retry(node);
      },
    ],
    ['reviewdock.openOnProvider', openOnProvider],
    ['reviewdock.merge', mergeRequest],
    ['reviewdock.addComment', addComment],
    ['reviewdock.searchRequests', searchRequests],
  ];
  for (const [id, callback] of commands)
    context.subscriptions.push(vscode.commands.registerCommand(id, callback));

  async function addConnection(): Promise<void> {
    const provider = await vscode.window.showQuickPick(
      [
        { label: 'GitHub', value: 'github' as const },
        { label: 'GitLab', value: 'gitlab' as const },
      ],
      { placeHolder: 'Choose provider' },
    );
    if (!provider) return;
    const defaultHost = provider.value === 'github' ? 'https://github.com' : 'https://gitlab.com';
    const displayName = await vscode.window.showInputBox({
      prompt: 'Connection name',
      placeHolder: provider.label,
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim() ? undefined : 'Connection name is required'),
    });
    if (!displayName) return;
    const serverUrl = await vscode.window.showInputBox({
      prompt: 'HTTPS server URL',
      value: defaultHost,
      ignoreFocusOut: true,
      validateInput: (value) => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password
            ? undefined
            : 'Enter an HTTPS URL without credentials';
        } catch {
          return 'Enter a valid HTTPS URL';
        }
      },
    });
    if (!serverUrl) return;
    const token = await vscode.window.showInputBox({
      prompt:
        provider.value === 'github'
          ? 'Personal Access Token (fine-grained: Metadata read, Contents read, Pull requests read/write; Checks read for checks)'
          : 'Personal Access Token (requires the api scope)',
      password: true,
      ignoreFocusOut: true,
    });
    if (!token) return;
    try {
      const identity = await connections.validateConnection({
        provider: provider.value,
        serverUrl,
        token,
      });
      const save = await vscode.window.showInformationMessage(
        `${provider.label} validated as @${identity.login} on ${new URL(serverUrl).host}. Save this credential in VS Code SecretStorage?`,
        {
          modal: true,
          detail:
            provider.value === 'github'
              ? 'Required fine-grained permissions: Metadata read, Contents read, Pull requests read/write. Checks read enables CI status. Classic PAT: repo scope.'
              : 'GitLab personal, project, or group token must include the api scope.',
        },
        'Save Connection',
      );
      if (save !== 'Save Connection') return;
      await connections.createConnection({
        provider: provider.value,
        displayName,
        serverUrl,
        token,
      });
      changed();
      void vscode.window.showInformationMessage(`${provider.label} connection saved.`);
    } catch (error) {
      showError(error);
    }
  }

  async function selectConnectionRepositories(
    selection?: Connection | ConnectionNode,
  ): Promise<void> {
    let target =
      selection && 'kind' in selection
        ? 'connection' in selection
          ? selection.connection
          : undefined
        : selection;
    if (!target) {
      const chosen = await vscode.window.showQuickPick(
        connections
          .listConnections()
          .filter((item) => item.enabled && item.status === 'connected')
          .map((item) => ({
            label: item.displayName,
            description: `${item.provider} · ${item.accountLogin ?? ''}`,
            item,
          })),
        { placeHolder: 'Choose a connection to select sidebar repositories' },
      );
      target = chosen?.item;
    }
    if (!target) return;
    const connection = connections.getConnection(target.id);
    if (!connection.enabled || connection.status !== 'connected') {
      void vscode.window.showWarningMessage(
        'Connect and enable this account before selecting repositories.',
      );
      return;
    }
    pickSidebarRepositories(
      connection,
      providerFor(connection),
      async (selected) => {
        await connections.setSelectedRepositories(connection.id, selected);
        connectionTree.refresh();
      },
      showError,
    );
  }

  async function manageConnections(selection?: Connection | ConnectionNode): Promise<void> {
    let target =
      selection && 'kind' in selection
        ? selection.kind === 'connection'
          ? selection.connection
          : undefined
        : selection;
    while (true) {
      const items = connections.listConnections();
      if (!target) {
        const selected = await vscode.window.showQuickPick(
          items.map((item) => ({
            label: item.displayName,
            description: `${item.provider} · ${item.accountLogin ? `@${item.accountLogin} · ` : ''}${new URL(item.serverUrl).host} · ${item.enabled ? item.status : 'Disabled'}`,
            item,
          })),
          { placeHolder: 'Choose a connection to manage' },
        );
        if (!selected) return;
        target = selected.item;
      }
      const options = [
        target.enabled ? 'Disable' : 'Enable',
        ...(target.enabled ? ['Select Repositories', 'Test Connection', 'Set as Default'] : []),
        'Rename',
        'Re-authenticate',
        'Disconnect',
        'Delete',
        'Done',
      ];
      const action = await vscode.window.showQuickPick(options, {
        placeHolder: `${target.provider} · ${target.displayName} · ${target.accountLogin ?? 'account unavailable'}`,
      });
      if (!action || action === 'Done') return;
      try {
        if (action === 'Enable' || action === 'Disable')
          await connections.setEnabled(target.id, action === 'Enable');
        else if (action === 'Select Repositories') {
          await selectConnectionRepositories(target);
          return;
        } else if (action === 'Test Connection') await connections.testConnection(target.id);
        else if (action === 'Rename') {
          const name = await vscode.window.showInputBox({
            value: target.displayName,
            prompt: 'Connection name',
          });
          if (!name) continue;
          await connections.renameConnection(target.id, name);
        } else if (action === 'Re-authenticate') {
          const token = await vscode.window.showInputBox({
            password: true,
            prompt:
              target.provider === 'github'
                ? 'New GitHub PAT (fine-grained permissions: Metadata read, Contents read, Pull requests read/write)'
                : 'New GitLab PAT (api scope required)',
          });
          if (!token) continue;
          await connections.reauthenticate(
            target.id,
            token,
            async (old, next) =>
              (await vscode.window.showWarningMessage(
                `This token belongs to @${next.login}, while this connection is currently @${old.accountLogin}. Replace the account binding?`,
                { modal: true },
                'Change Account',
              )) === 'Change Account',
          );
        } else if (action === 'Set as Default') await connections.setDefaultConnection(target.id);
        else if (action === 'Disconnect') {
          const yes = await vscode.window.showWarningMessage(
            `Remove the saved token for ${target.displayName}? Its workspace bindings will remain unresolved.`,
            { modal: true },
            'Disconnect',
          );
          if (yes === 'Disconnect') await connections.disconnect(target.id);
        } else if (action === 'Delete') {
          const yes = await vscode.window.showWarningMessage(
            `Delete ${target.provider} connection “${target.displayName}” for @${target.accountLogin ?? 'unknown'} at ${new URL(target.serverUrl).host}? Workspace bindings will remain unresolved.`,
            { modal: true },
            'Delete Connection',
          );
          if (yes === 'Delete Connection') {
            await connections.deleteConnection(target.id);
            target = undefined;
          }
        }
        changed();
        if (!target) continue;
        target = connections.getConnection(target.id);
      } catch (error) {
        showError(error);
        target = undefined;
      }
    }
  }

  async function selectConnection(): Promise<void> {
    const folder = await chooseFolder();
    if (!folder) return;
    activeFolder = folder;
    activeFolderExplicitlySelected = allFolders().length > 1;
    const choices = connections.listConnections().filter((item) => item.enabled);
    const selected = await vscode.window.showQuickPick(
      choices.map((item) => ({
        label: item.displayName,
        description: `${item.provider} · @${item.accountLogin ?? 'unknown'} · ${new URL(item.serverUrl).host} · ${item.status}${connections.getDefaultConnection(item.provider)?.id === item.id ? ' · Default' : ''}`,
        item,
      })),
      { placeHolder: `Choose account for ${folder.name}` },
    );
    if (!selected) return;
    const binding = repositories.getBinding(folder.uri.toString());
    if (binding && binding.connectionId !== selected.item.id) {
      const proceed = await vscode.window.showWarningMessage(
        `Change the account for ${folder.name}? The repository binding will be retained until you select a repository.`,
        { modal: true },
        'Continue',
      );
      if (proceed !== 'Continue') return;
    }
    requestsTree.refresh();
    await selectRepository(folder, selected.item);
  }

  async function selectRepository(
    folderArg?: vscode.WorkspaceFolder,
    connectionArg?: Connection,
  ): Promise<void> {
    const folder = folderArg ?? (await chooseFolder());
    if (!folder) return;
    activeFolder = folder;
    activeFolderExplicitlySelected = allFolders().length > 1;
    const connection = connectionArg ?? (await chooseConnection(folder));
    if (!connection) return;
    const remotes = await remotesFor(folder);
    let matches: RemoteCandidate[] = [];
    for (const remote of remotes) {
      try {
        matches = await repositories.matchRemote(remote);
        if (connectionArg)
          matches = matches.filter((match) => match.connection.id === connectionArg.id);
      } catch {
        /* account may not have access to this remote */
      }
      if (matches.length) break;
    }
    if (matches.length) {
      const choices = matches.map((match) => ({
        label: match.repository.fullName,
        description: `${match.connection.displayName} · @${match.connection.accountLogin}`,
        match,
      }));
      const chosen = await vscode.window.showQuickPick(choices, {
        placeHolder:
          matches.length === 1
            ? `Bind detected remote to ${folder.name}?`
            : 'This remote is accessible through multiple accounts. Choose one.',
      });
      if (chosen) {
        await repositories.bind(
          folder.uri.toString(),
          chosen.match.connection.id,
          chosen.match.repository,
        );
        changed();
        return;
      }
    }
    await searchRepositories(connection, folder);
  }

  async function chooseConnection(folder: vscode.WorkspaceFolder): Promise<Connection | undefined> {
    const bound = repositories.getBinding(folder.uri.toString());
    if (bound) {
      const current = connections.listConnections().find((item) => item.id === bound.connectionId);
      if (current?.enabled) return current;
      await vscode.window.showWarningMessage(
        current
          ? `The workspace is bound to disabled connection “${current.displayName}”. Enable it or use Select Connection to change the binding.`
          : 'The workspace connection binding is unresolved. Use Select Connection to choose another account; ReviewDock will not switch accounts automatically.',
      );
      return undefined;
    }
    const enabled = connections.listConnections().filter((item) => item.enabled);
    if (!enabled.length) {
      await vscode.window.showInformationMessage('Add or enable a ReviewDock connection first.');
      return undefined;
    }
    const choice = connectionChoice(false, enabled, {
      github: connections.getDefaultConnection('github'),
      gitlab: connections.getDefaultConnection('gitlab'),
    });
    if (choice.kind === 'blocked') return undefined;
    if (choice.kind === 'selected') return choice.connection;
    const chosen = await vscode.window.showQuickPick(
      choice.connections.map((item) => ({
        label: item.displayName,
        description: `${item.provider} · @${item.accountLogin ?? 'unknown'} · ${new URL(item.serverUrl).host}${connections.getDefaultConnection(item.provider)?.id === item.id ? ' · Default' : ''}`,
        item,
      })),
      {
        placeHolder:
          choice.connections.length === 2 &&
          choice.connections.every(
            (item) => item.id === connections.getDefaultConnection(item.provider)?.id,
          )
            ? `Choose a provider default for ${folder.name}`
            : `Choose connection for ${folder.name}`,
      },
    );
    return chosen?.item;
  }

  async function searchRepositories(
    connection: Connection,
    folder: vscode.WorkspaceFolder,
  ): Promise<void> {
    const provider = providerFor(connection);
    const picker = vscode.window.createQuickPick<{
      label: string;
      description: string;
      repository?: RepositoryRef;
      page?: number;
    }>();
    picker.title = `${connection.provider === 'github' ? 'GitHub' : 'GitLab'} repositories · ${folder.name}`;
    picker.placeholder = 'Search repositories or projects';
    picker.matchOnDescription = true;
    picker.ignoreFocusOut = true;
    let generation = 0;
    let page = 0;
    let hasMore = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const run = async (append = false) => {
      const current = ++generation;
      if (!append) {
        page = 0;
        hasMore = true;
        picker.items = [];
      }
      if (!hasMore) return;
      try {
        const query = picker.value.trim();
        const result = await provider.listRepositories({
          ...(query ? { search: query } : {}),
          page: page + 1,
          perPage: 30,
        });
        if (current !== generation) return;
        page = result.page.page;
        hasMore = result.page.hasNextPage;
        const items: {
          label: string;
          description: string;
          repository?: RepositoryRef;
          page?: number;
        }[] = [
          ...(append ? picker.items : []),
          ...result.items.map((repository) => ({
            label: repository.fullName,
            description: `${repository.private ? 'Private' : 'Public'} · ${repository.defaultBranch ?? ''}`,
            repository,
          })),
        ];
        if (hasMore)
          items.push({ label: 'Load More…', description: 'Fetch another page', page: page + 1 });
        picker.items = items;
      } catch (error) {
        if (current === generation) showError(error);
      }
    };
    picker.onDidChangeValue(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void run();
      }, 300);
    });
    picker.onDidAccept(async () => {
      const selected = picker.selectedItems[0];
      if (!selected) return;
      if (selected.page) {
        await run(true);
        return;
      }
      picker.hide();
      if (!selected.repository) return;
      try {
        await repositories.bind(folder.uri.toString(), connection.id, selected.repository);
        changed();
      } catch (error) {
        showError(error);
      }
    });
    picker.onDidHide(() => {
      generation++;
      if (debounce) clearTimeout(debounce);
      picker.dispose();
    });
    picker.show();
    await run();
  }

  async function chooseRequest(): Promise<ReviewRequestSummary | undefined> {
    const folder = await chooseFolder();
    if (!folder) return undefined;
    activeFolder = folder;
    activeFolderExplicitlySelected = allFolders().length > 1;
    const resolved = repositories.resolveBinding(folder.uri.toString());
    if (!resolved) {
      await vscode.window.showWarningMessage(
        'Select a connection and repository for this workspace folder first.',
      );
      return undefined;
    }
    const provider = providerFor(resolved.connection);
    const choice = await vscode.window.showQuickPick(
      reviewFilters.map((item) => ({ label: item.label, filter: item.filter })),
      { placeHolder: `Choose review request group · ${resolved.binding.fullName}` },
    );
    if (!choice) return undefined;
    const result = await provider.listReviewRequests({
      repositoryId: resolved.binding.repositoryId,
      filter: choice.filter,
      page: 1,
      perPage: 50,
    });
    const selected = await vscode.window.showQuickPick(
      result.items.map((summary) => ({
        label: `${summary.number} · ${summary.title}`,
        description: `${summary.state} · ${summary.author.login}`,
        summary,
      })),
      { placeHolder: 'Choose a review request' },
    );
    return selected?.summary;
  }
  async function openOnProvider(summary?: ReviewRequestSummary): Promise<void> {
    const selected = summary ?? (await chooseRequest());
    if (!selected || !activeFolder) return;
    const binding = repositories.getBinding(activeFolder.uri.toString());
    if (!binding) return;
    if (
      selected.repositoryId !== binding.repositoryId ||
      (selected.connectionId && selected.connectionId !== binding.connectionId)
    ) {
      showError(
        new AppError(
          'The selected review request belongs to a different repository or connection.',
          'validation',
        ),
      );
      return;
    }
    const connection = connections.getConnection(binding.connectionId);
    try {
      const url = new URL(selected.webUrl);
      const server = new URL(connection.serverUrl);
      if (url.protocol !== 'https:' || url.origin !== server.origin || url.username || url.password)
        throw new Error();
      await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
    } catch {
      showError(new AppError('The provider returned an unsafe review URL.', 'validation'));
    }
  }
  async function searchRequests(): Promise<void> {
    const query = await vscode.window.showInputBox({
      prompt: 'Search review request titles and descriptions',
      ignoreFocusOut: true,
    });
    if (query !== undefined) {
      const folder = await chooseFolder();
      if (folder) {
        activeFolder = folder;
        activeFolderExplicitlySelected = allFolders().length > 1;
      }
      requestsTree.setSearch(query);
    }
  }
  async function mergeRequest(summary?: ReviewRequestSummary): Promise<void> {
    const selected = summary ?? (await chooseRequest());
    if (!selected) return;
    const folder = activeFolder;
    if (!folder) return;
    const binding = repositories.getBinding(folder.uri.toString());
    if (!binding) return;
    const connection = connections.getConnection(binding.connectionId);
    const review = reviewFor(connection);
    if (
      selected.repositoryId !== binding.repositoryId ||
      (selected.connectionId && selected.connectionId !== binding.connectionId)
    ) {
      showError(
        new AppError(
          'The selected review request belongs to a different repository or connection.',
          'validation',
        ),
      );
      return;
    }
    try {
      const detail = await review.detail({
        repositoryId: binding.repositoryId,
        reviewRequestId: selected.number,
      });
      const confirmed = await vscode.window.showWarningMessage(
        `Merge ${connection.provider === 'github' ? 'Pull Request' : 'Merge Request'} ${detail.number}: ${detail.title}?`,
        {
          modal: true,
          detail: `${connection.displayName} · ${binding.fullName}\n${detail.sourceBranch} → ${detail.targetBranch}\nReviewDock refreshes the current source revision before merging.`,
        },
        'Merge',
      );
      if (confirmed === 'Merge') {
        const result = await review.merge(
          {
            repositoryId: binding.repositoryId,
            reviewRequestId: detail.number,
            ...(detail.headSha ? { headSha: detail.headSha } : {}),
          },
          detail.headSha ?? '',
          true,
        );
        if (result.merged) {
          await vscode.window.showInformationMessage(result.message ?? 'Review request merged.');
        } else {
          await vscode.window.showWarningMessage(
            result.message ?? 'The provider did not confirm the merge.',
          );
        }
        await review.detail({ repositoryId: binding.repositoryId, reviewRequestId: detail.number });
        requestsTree.refresh();
      }
    } catch (error) {
      showError(error);
    }
  }
  async function addComment(summary?: ReviewRequestSummary): Promise<void> {
    const selected = summary ?? (await chooseRequest());
    if (!selected || !activeFolder) return;
    const binding = repositories.getBinding(activeFolder.uri.toString());
    if (!binding) return;
    if (
      selected.repositoryId !== binding.repositoryId ||
      (selected.connectionId && selected.connectionId !== binding.connectionId)
    ) {
      showError(
        new AppError(
          'The selected review request belongs to a different repository or connection.',
          'validation',
        ),
      );
      return;
    }
    const connection = connections.getConnection(binding.connectionId);
    const review = reviewFor(connection);
    const detail = await review.detail({
      repositoryId: binding.repositoryId,
      reviewRequestId: selected.number,
    });
    const body = await vscode.window.showInputBox({
      prompt: `General comment on ${detail.number} · ${detail.title}`,
      placeHolder: 'Write a comment',
      ignoreFocusOut: true,
    });
    if (!body?.trim()) return;
    try {
      await review.createGeneral(
        {
          repositoryId: binding.repositoryId,
          reviewRequestId: detail.number,
          ...(detail.headSha ? { headSha: detail.headSha } : {}),
        },
        body,
      );
      void vscode.window.showInformationMessage('Comment sent.');
    } catch (error) {
      showError(error);
    }
  }
  function showError(error: unknown): void {
    void vscode.window.showErrorMessage(
      error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'ReviewDock operation failed.',
    );
  }
}

export function deactivate(): void {}

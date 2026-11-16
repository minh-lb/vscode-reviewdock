import * as vscode from 'vscode';
import type { ReviewProvider } from '../../application/ports';
import type { ConnectionService } from '../../application/connectionService';
import type { RepositoryService, RepositoryBinding } from '../../application/repositoryService';
import type { ProviderType, ReviewRequestFilter, ReviewRequestSummary } from '../../domain/models';
import { resolveFolderBinding, reviewFilters, reviewRequestLabel } from './treeItems';

export type RequestNode = {
  kind: 'setup' | 'filter' | 'request' | 'more';
  label: string;
  filter?: ReviewRequestFilter;
  summary?: ReviewRequestSummary;
  page?: number;
  binding?: RepositoryBinding;
};
type CacheEntry = {
  items: ReviewRequestSummary[];
  page: number;
  hasMore: boolean;
  loading: Promise<void> | undefined;
};

export class RequestsTree implements vscode.TreeDataProvider<RequestNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private generation = 0;
  private readonly cache = new Map<ReviewRequestFilter, CacheEntry>();
  private search = '';
  constructor(
    private readonly workspaceFolder: () => vscode.WorkspaceFolder | undefined,
    private readonly connections: ConnectionService,
    private readonly repositories: RepositoryService,
    private readonly providerFor: (id: string) => ReviewProvider,
    private readonly open: (connectionId: string, summary: ReviewRequestSummary) => Promise<void>,
  ) {}
  refresh(): void {
    this.generation++;
    this.cache.clear();
    this.changed.fire();
  }
  setSearch(value: string): void {
    this.search = value.trim();
    this.refresh();
  }
  getTreeItem(node: RequestNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    if (node.kind === 'filter') {
      item.contextValue = 'reviewdock.filter';
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
    if (node.kind === 'request' && node.summary) {
      const summary = node.summary;
      item.contextValue = 'reviewdock.request';
      item.description = `${summary.author.login} · ${summary.sourceBranch} → ${summary.targetBranch}`;
      item.iconPath = new vscode.ThemeIcon(
        summary.state === 'merged'
          ? 'git-merge'
          : summary.state === 'closed'
            ? 'git-pull-request-closed'
            : 'git-pull-request',
      );
      item.command = {
        command: 'reviewdock.openReviewRequest',
        title: 'Open Review Request',
        arguments: [summary],
      };
    }
    if (node.kind === 'more') {
      item.contextValue = 'reviewdock.loadMore';
      item.command = { command: 'reviewdock.refresh', title: 'Load More', arguments: [node] };
    }
    if (node.kind === 'setup') item.contextValue = 'reviewdock.setup';
    return item;
  }
  async getChildren(node?: RequestNode): Promise<RequestNode[]> {
    if (!node) {
      const folder = this.workspaceFolder();
      if (!folder)
        return [{ kind: 'setup', label: 'Select a workspace folder to browse review requests.' }];
      let resolved;
      try {
        resolved = resolveFolderBinding(folder.uri.toString(), (uri) =>
          this.repositories.resolveBinding(uri),
        );
      } catch (error) {
        return [
          {
            kind: 'setup',
            label: `${error instanceof Error ? error.message : 'The selected connection is disabled.'} Use Select Connection.`,
          },
        ];
      }
      if (!resolved)
        return [
          { kind: 'setup', label: 'Select a connection and repository for this workspace folder.' },
        ];
      return reviewFilters.map(({ label, filter }) => ({
        kind: 'filter',
        label: `${label}${this.search ? ` · “${this.search}”` : ''}`,
        filter,
        binding: resolved.binding,
      }));
    }
    if (node.kind !== 'filter' || !node.filter || !node.binding) return [];
    const generation = this.generation;
    const provider = this.providerFor(node.binding.connectionId);
    const cached = this.cache.get(node.filter) ?? {
      items: [],
      page: 0,
      hasMore: true,
      loading: undefined,
    };
    this.cache.set(node.filter, cached);
    if (cached.page === 0)
      await this.load(node.filter, cached, provider, node.binding, generation, 1);
    if (generation !== this.generation) return [];
    return [
      ...cached.items.map((summary) => ({
        kind: 'request' as const,
        label: reviewRequestLabel(summary),
        summary,
      })),
      ...(cached.hasMore
        ? [
            {
              kind: 'more' as const,
              label: 'Load More…',
              filter: node.filter,
              binding: node.binding,
              page: cached.page + 1,
            },
          ]
        : []),
      ...(!cached.items.length && !cached.hasMore
        ? [{ kind: 'setup' as const, label: 'No review requests found.' }]
        : []),
    ];
  }
  async loadMore(node: RequestNode): Promise<void> {
    if (!node.filter || !node.binding) return;
    const cache = this.cache.get(node.filter);
    if (!cache) return;
    const folder = this.workspaceFolder();
    if (!folder) return;
    const generation = this.generation;
    await this.load(
      node.filter,
      cache,
      this.providerFor(node.binding.connectionId),
      node.binding,
      generation,
      node.page ?? cache.page + 1,
    );
    if (generation === this.generation) this.changed.fire();
  }
  private async load(
    filter: ReviewRequestFilter,
    cache: CacheEntry,
    provider: ReviewProvider,
    binding: RepositoryBinding,
    generation: number,
    page: number,
  ): Promise<void> {
    if (cache.loading) return cache.loading;
    cache.loading = (async () => {
      try {
        const result = await provider.listReviewRequests({
          repositoryId: binding.repositoryId,
          filter,
          ...(this.search ? { search: this.search } : {}),
          page,
          perPage: 20,
        });
        if (generation !== this.generation) return;
        if (result.page.limited || result.page.incomplete)
          void vscode.window.showWarningMessage(
            'The provider returned a limited or incomplete review request result. Refine the search or provider permissions.',
          );
        cache.items = page === 1 ? result.items : [...cache.items, ...result.items];
        cache.page = page;
        cache.hasMore = result.page.hasNextPage;
      } catch (error) {
        if (generation === this.generation)
          vscode.window.showErrorMessage(
            error instanceof Error ? error.message : 'Could not load review requests.',
          );
      } finally {
        cache.loading = undefined;
      }
    })();
    return cache.loading;
  }
  openSummary(summary: ReviewRequestSummary): Promise<void> {
    const folder = this.workspaceFolder();
    if (!folder) return Promise.resolve();
    const binding = this.repositories.getBinding(folder.uri.toString());
    if (!binding) return Promise.resolve();
    return this.open(binding.connectionId, summary);
  }
  dispose(): void {
    this.changed.dispose();
  }
}

export function workspaceProviderKey(
  provider: ProviderType,
  folder: vscode.WorkspaceFolder,
): string {
  return `${provider}:${folder.uri.toString()}`;
}

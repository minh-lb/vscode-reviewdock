import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type {
  CheckSummary,
  Connection,
  DiffFilePage,
  ProviderCapabilityDescriptor,
  ProviderType,
  RepositoryRef,
  ReviewConversation,
  ReviewRequestContext,
  ReviewRequestDetail,
  ReviewRequestSummary,
  ReviewCommit,
  Page,
} from '../../domain/models';
import type { ReviewService } from '../../application/reviewService';
import type { ReviewProvider } from '../../application/ports';
import { AppError } from '../../domain/errors';
import { validateWebviewRequest, type WebviewMessage } from './messageProtocol';

export interface ReviewPanelOptions {
  connection: Connection;
  repository: RepositoryRef;
  summary: ReviewRequestSummary;
  provider: ReviewProvider;
  review: ReviewService;
  onDidDispose?: () => void;
  onDidMutate?: () => void;
}

/** One panel is permanently bound to one request context. */
export function openReviewRequestPanel(
  extensionUri: vscode.Uri,
  options: ReviewPanelOptions,
): vscode.WebviewPanel {
  const contextId = randomUUID();
  const assetRoot = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist');
  const panel = vscode.window.createWebviewPanel(
    'reviewdock.reviewRequest',
    `${nativeName(options.connection.provider)} ${options.summary.number}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [assetRoot],
    },
  );
  let disposed = false;
  let context: ReviewRequestContext = {
    repositoryId: options.summary.repositoryId,
    reviewRequestId: options.summary.number,
  };
  let detail: ReviewRequestDetail | undefined;
  let files: DiffFilePage | undefined;
  let filePages = 1;
  let conversationPages = 1;
  let conversations: ReviewConversation[] = [];
  let checks: CheckSummary[] = [];
  let commits: ReviewCommit[] = [];
  let commitPage: Page<ReviewCommit> | undefined;
  let mutationPending = false;
  let initializationGeneration = 0;
  const requestIds = new Map<string, number>();
  const post = (message: WebviewMessage) => {
    if (!disposed) void panel.webview.postMessage(message);
  };
  const pageRequest = (name: string) => {
    const id = (requestIds.get(name) ?? 0) + 1;
    requestIds.set(name, id);
    return id;
  };
  const isLatest = (name: string, id: number) => !disposed && requestIds.get(name) === id;
  const capabilities = (): ProviderCapabilityDescriptor =>
    options.provider.getCapabilities(context);
  const updateContext = (current: ReviewRequestDetail, diff?: DiffFilePage) => {
    context = {
      repositoryId: current.repositoryId,
      reviewRequestId: current.number,
      ...(current.headSha ? { headSha: current.headSha } : {}),
      ...(diff?.diffVersion ? { diffVersion: diff.diffVersion } : {}),
    };
  };
  const initialize = async () => {
    const generation = ++initializationGeneration;
    try {
      const current = await options.review.detail(context);
      if (disposed || generation !== initializationGeneration) return;
      detail = current;
      updateContext(current);
      post({
        type: 'initialize',
        contextId,
        context,
        detail: current,
        providerName: options.connection.provider === 'github' ? 'GitHub' : 'GitLab',
        connectionName: options.connection.displayName,
        accountLogin: options.connection.accountLogin ?? '',
        ...(options.connection.accountId ? { accountId: options.connection.accountId } : {}),
        serverHost: new URL(options.connection.serverUrl).host,
        repositoryName: options.repository.fullName,
        capabilities: capabilities(),
      });
    } catch (error) {
      post({ type: 'notice', level: 'error', message: safeMessage(error) });
    }
  };
  const loadFiles = async (append = false) => {
    const id = pageRequest('files');
    post({ type: 'busy', action: 'files', busy: true });
    try {
      const page = append ? filePages + 1 : 1;
      const result = await options.review.files(context, page);
      if (!isLatest('files', id)) return;
      filePages = page;
      files = append && files ? { ...result, items: [...files.items, ...result.items] } : result;
      if (detail) updateContext(detail, files);
      post({ type: 'files', requestId: id, result: files });
      post({ type: 'busy', action: 'files', busy: false });
    } catch (error) {
      if (isLatest('files', id)) {
        post({ type: 'busy', action: 'files', busy: false });
        post({ type: 'notice', level: 'error', message: safeMessage(error) });
      }
    }
  };
  const loadConversations = async (append = false) => {
    const id = pageRequest('conversations');
    post({ type: 'busy', action: 'conversations', busy: true });
    try {
      const page = append ? conversationPages + 1 : 1;
      const result = await options.review.conversations(context, page);
      if (!isLatest('conversations', id)) return;
      conversationPages = page;
      conversations = append ? [...conversations, ...result.items] : result.items;
      post({ type: 'conversations', requestId: id, result: { ...result, items: conversations } });
      post({ type: 'busy', action: 'conversations', busy: false });
    } catch (error) {
      if (isLatest('conversations', id)) {
        post({ type: 'busy', action: 'conversations', busy: false });
        post({ type: 'notice', level: 'error', message: safeMessage(error) });
      }
    }
  };
  const loadChecks = async () => {
    const id = pageRequest('checks');
    try {
      const result = await options.review.checks(context);
      if (isLatest('checks', id)) {
        checks = result;
        post({ type: 'checks', requestId: id, result });
      }
    } catch (error) {
      if (isLatest('checks', id))
        post({ type: 'notice', level: 'error', message: safeMessage(error) });
    }
  };
  const loadApprovals = async () => {
    const id = pageRequest('approvals');
    try {
      const result = await options.review.approvals(context);
      if (isLatest('approvals', id)) post({ type: 'approvals', requestId: id, result });
    } catch (error) {
      if (isLatest('approvals', id))
        post({ type: 'notice', level: 'error', message: safeMessage(error) });
    }
  };
  const loadCommits = async (append = false) => {
    const id = pageRequest('commits');
    const page = append ? (commitPage?.page.page ?? 0) + 1 : 1;
    post({ type: 'busy', action: 'commits', busy: true });
    try {
      const result = await options.review.commits(context, page);
      if (!isLatest('commits', id)) return;
      commitPage = result;
      commits = append ? [...commits, ...result.items] : result.items;
      post({ type: 'commits', requestId: id, result: { ...result, items: commits } });
      post({ type: 'busy', action: 'commits', busy: false });
    } catch (error) {
      if (isLatest('commits', id)) {
        post({ type: 'commits', requestId: id, error: safeMessage(error) });
        post({ type: 'busy', action: 'commits', busy: false });
      }
    }
  };
  const refresh = async () => {
    initializationGeneration += 1;
    const id = pageRequest('refresh');
    for (const name of ['files', 'conversations', 'checks', 'approvals', 'commits'])
      pageRequest(name);
    post({ type: 'busy', action: 'refresh', busy: true });
    try {
      await options.review.reconcile(context);
      if (!isLatest('refresh', id)) return;
      post({ type: 'mutationState', uncertain: false });
      detail = await options.review.detail(context);
      updateContext(detail);
      files = undefined;
      filePages = 1;
      conversations = [];
      conversationPages = 1;
      commits = [];
      commitPage = undefined;
      await initialize();
      await Promise.all([loadFiles(), loadConversations()]);
      post({ type: 'busy', action: 'refresh', busy: false });
    } catch (error) {
      if (isLatest('refresh', id)) {
        post({ type: 'busy', action: 'refresh', busy: false });
        post({
          type: 'notice',
          level: 'warning',
          message: `Refresh could not reconcile the current request: ${safeMessage(error)}. No mutation was retried.`,
        });
      }
    }
  };
  const handleMessage = async (raw: unknown) => {
    const message = validateWebviewRequest(raw, contextId);
    if (!message || disposed) return;
    if (message.type === 'ready') {
      await initialize();
      return;
    }
    if (message.type === 'selectTab') {
      if (message.tab === 'changes') await loadFiles();
      if (message.tab === 'conversations') await loadConversations();
      if (message.tab === 'checks') await loadChecks();
      if (message.tab === 'approvals') await loadApprovals();
      if (message.tab === 'commits') await loadCommits();
      return;
    }
    if (message.type === 'refresh') {
      await refresh();
      return;
    }
    if (message.type === 'loadMoreFiles') {
      await loadFiles(true);
      return;
    }
    if (message.type === 'loadMoreConversations') {
      await loadConversations(true);
      return;
    }
    if (message.type === 'loadMoreCommits') {
      await loadCommits(true);
      return;
    }
    if (message.type === 'openExternal') {
      const uri = trustedProviderUri(options.summary.webUrl, options.connection.serverUrl);
      if (uri) await vscode.env.openExternal(uri);
      else
        post({
          type: 'notice',
          level: 'error',
          message: 'The provider returned an unsafe review URL.',
        });
      return;
    }
    if (message.type === 'openCheck') {
      const check = checks.find((item) => item.id === message.checkId);
      const uri = check?.detailsUrl
        ? trustedProviderUri(check.detailsUrl, options.connection.serverUrl)
        : undefined;
      if (uri) await vscode.env.openExternal(uri);
      else
        post({
          type: 'notice',
          level: 'warning',
          message:
            'The check details link is unavailable or does not belong to this provider host.',
        });
      return;
    }
    if (message.type === 'openCommit') {
      const commit = commits.find((item) => item.id === message.commitId);
      const uri = commit?.webUrl
        ? trustedProviderUri(commit.webUrl, options.connection.serverUrl)
        : undefined;
      if (uri) await vscode.env.openExternal(uri);
      else
        post({
          type: 'notice',
          level: 'warning',
          message: 'The commit link is unavailable or does not belong to this provider host.',
        });
      return;
    }
    if (message.type === 'openLink') {
      try {
        const url = new URL(message.url);
        if (url.protocol === 'https:' && url.hostname && !url.username && !url.password)
          await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
        else
          post({
            type: 'notice',
            level: 'warning',
            message: 'Only HTTPS links without embedded credentials can be opened.',
          });
      } catch {
        post({
          type: 'notice',
          level: 'warning',
          message: 'The link is invalid and was not opened.',
        });
      }
      return;
    }
    if (message.type === 'listMetadataOptions') {
      const requestId = pageRequest(`metadata:${message.kind}`);
      const generation = initializationGeneration;
      try {
        const result = await options.review.metadataOptions({
          ...context,
          kind: message.kind,
          ...(message.search === undefined ? {} : { search: message.search }),
          ...(message.page === undefined ? {} : { page: message.page }),
        });
        if (
          !disposed &&
          generation === initializationGeneration &&
          requestIds.get(`metadata:${message.kind}`) === requestId
        )
          post({ type: 'metadataOptions', requestId, kind: message.kind, result });
      } catch (error) {
        post({ type: 'notice', level: 'error', message: safeMessage(error) });
      }
      return;
    }
    if (message.type === 'loadMarkdownContent') {
      const generation = initializationGeneration;
      const requestId = pageRequest(`markdown:${message.path}`);
      try {
        const content = await options.review.markdownContent(context, message.path);
        if (
          !disposed &&
          generation === initializationGeneration &&
          requestIds.get(`markdown:${message.path}`) === requestId
        )
          post({ type: 'markdownContent', path: message.path, ...content });
      } catch (error) {
        if (
          !disposed &&
          generation === initializationGeneration &&
          requestIds.get(`markdown:${message.path}`) === requestId
        )
          post({ type: 'markdownContent', path: message.path, error: safeMessage(error) });
      }
      return;
    }
    if (mutationPending) return;
    mutationPending = true;
    try {
      if (message.type === 'addGeneralComment') {
        post({ type: 'busy', action: 'general', busy: true });
        await options.review.createGeneral(context, message.body);
        await loadConversations();
        options.onDidMutate?.();
        post({ type: 'notice', level: 'success', message: 'Comment sent.' });
      } else if (message.type === 'addInlineComment') {
        post({ type: 'busy', action: 'addInlineComment', busy: true });
        await options.review.createInline(context, message.body, {
          ...message.position,
          ...(message.position.side === 'new'
            ? { newPath: message.position.path }
            : { oldPath: message.position.path }),
        });
        await loadConversations();
        options.onDidMutate?.();
        post({ type: 'notice', level: 'success', message: 'Inline comment sent.' });
      } else if (message.type === 'reply') {
        post({ type: 'busy', action: 'reply', busy: true });
        await options.review.reply(context, message.conversationId, message.body);
        await loadConversations();
        options.onDidMutate?.();
        post({ type: 'notice', level: 'success', message: 'Reply sent.' });
      } else if (message.type === 'editMetadata') {
        post({ type: 'busy', action: 'metadata', busy: true });
        await options.review.updateMetadata(context, {
          ...(message.title === undefined ? {} : { title: message.title }),
          ...(message.description === undefined ? {} : { description: message.description }),
          ...(message.assigneeIds === undefined ? {} : { assigneeIds: message.assigneeIds }),
          ...(message.reviewerIds === undefined ? {} : { reviewerIds: message.reviewerIds }),
          ...(message.labels === undefined ? {} : { labels: message.labels }),
        });
        await refresh();
        options.onDidMutate?.();
        post({ type: 'notice', level: 'success', message: 'Review request updated.' });
      } else if (message.type === 'deleteComment') {
        const answer = await vscode.window.showWarningMessage(
          'Delete this comment permanently?',
          {
            modal: true,
            detail: `${options.connection.displayName} · ${options.repository.fullName} · ${nativeName(options.connection.provider)} ${detail?.number ?? ''}`,
          },
          'Delete comment',
        );
        if (answer === 'Delete comment') {
          post({ type: 'busy', action: 'deleteComment', busy: true });
          await options.review.deleteComment(context, message.conversationId, message.commentId);
          await loadConversations();
          options.onDidMutate?.();
          post({ type: 'notice', level: 'success', message: 'Comment deleted.' });
        }
      } else if (message.type === 'setThreadResolved') {
        post({ type: 'busy', action: 'resolveThread', busy: true });
        await options.review.setThreadResolved(context, message.conversationId, message.resolved);
        await loadConversations();
        options.onDidMutate?.();
        post({
          type: 'notice',
          level: 'success',
          message: message.resolved ? 'Thread resolved.' : 'Thread reopened.',
        });
      } else if (message.type === 'merge') {
        if (!detail) throw new AppError('Review request details are not loaded', 'validation');
        const answer = await vscode.window.showWarningMessage(
          `Merge ${nativeName(options.connection.provider)} ${options.connection.provider === 'github' ? `#${detail.number}` : `!${detail.number}`} — ${detail.title}?`,
          {
            modal: true,
            detail: `${options.connection.displayName} · ${options.connection.accountLogin ?? 'account unavailable'} · ${new URL(options.connection.serverUrl).host}\n${options.repository.fullName}\n${detail.sourceBranch} → ${detail.targetBranch}\nExpected source SHA: ${message.expectedHeadSha}\nReviewDock refreshes and submits the current source SHA.`,
          },
          'Confirm merge',
        );
        if (answer === 'Confirm merge') {
          post({ type: 'busy', action: 'merge', busy: true });
          const result = await options.review.merge(context, message.expectedHeadSha, true);
          await refreshAfterMerge();
          options.onDidMutate?.();
          if (result.merged)
            post({
              type: 'merged',
              message: result.message ?? `${nativeName(options.connection.provider)} merged.`,
            });
          else
            post({
              type: 'notice',
              level: 'warning',
              message: result.message ?? 'The provider did not confirm the merge.',
            });
        }
      }
    } catch (error) {
      if (message.type === 'merge') {
        await refreshAfterMerge().catch(() => undefined);
        options.onDidMutate?.();
      }
      if (
        message.type === 'addInlineComment' &&
        error instanceof AppError &&
        ['conflict', 'validation'].includes(error.code)
      )
        post({
          type: 'stale',
          message: `${safeMessage(error)} Your draft is still available. Refresh the diff and select a current line.`,
        });
      else if (
        error instanceof AppError &&
        ['timeout', 'network', 'provider-server', 'unknown'].includes(error.code)
      ) {
        post({ type: 'mutationState', uncertain: true });
        post({
          type: 'notice',
          level: 'warning',
          message: `The mutation outcome may be unknown. Refresh provider state before trying again. ${safeMessage(error)}`,
        });
      } else post({ type: 'notice', level: 'error', message: safeMessage(error) });
    } finally {
      mutationPending = false;
      post({ type: 'busy', action: 'mutation', busy: false });
    }
  };
  const refreshAfterMerge = async () => {
    detail = await options.review.detail(context);
    updateContext(detail);
    await initialize();
  };
  panel.webview.onDidReceiveMessage(handleMessage);
  panel.onDidDispose(() => {
    disposed = true;
    options.onDidDispose?.();
  });
  panel.webview.html = getHtml(panel.webview, extensionUri, contextId);
  return panel;
}

function nativeName(provider: ProviderType): string {
  return provider === 'github' ? 'Pull Request' : 'Merge Request';
}
function trustedProviderUri(value: string, server: string): vscode.Uri | undefined {
  try {
    const url = new URL(value);
    const origin = new URL(server);
    if (url.protocol !== 'https:' || url.origin !== origin.origin) return undefined;
    return vscode.Uri.parse(url.toString());
  } catch {
    return undefined;
  }
}
function safeMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return 'The provider request failed. ReviewDock did not log private response data.';
}
function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri, contextId: string): string {
  const nonce = randomUUID().replaceAll('-', '');
  const js = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist', 'index.js'),
  );
  const css = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist', 'index.css'),
  );
  const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource}; connect-src 'none'; font-src ${webview.cspSource};`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="${css}"><title>ReviewDock</title></head><body><div id="root"></div><script nonce="${nonce}">window.reviewDockContextId=${JSON.stringify(contextId)};</script><script nonce="${nonce}" src="${js}"></script></body></html>`;
}

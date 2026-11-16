import type {
  ApprovalState,
  CheckSummary,
  DiffFilePage,
  Page,
  ReviewCommit,
  ProviderCapabilityDescriptor,
  ReviewConversation,
  ReviewRequestContext,
  ReviewRequestDetail,
  ReviewRequestSummary,
  MetadataOptionKind,
  ProviderUser,
} from '../../domain/models';

type ContextBound = { contextId: string };
export type WebviewRequest =
  | (ContextBound & { type: 'ready' })
  | (ContextBound & {
      type: 'selectTab';
      tab: 'overview' | 'changes' | 'conversations' | 'checks' | 'approvals' | 'commits';
    })
  | (ContextBound & { type: 'refresh' })
  | (ContextBound & { type: 'loadMoreFiles' })
  | (ContextBound & { type: 'loadMoreConversations' })
  | (ContextBound & { type: 'loadMoreCommits' })
  | (ContextBound & { type: 'openExternal' })
  | (ContextBound & { type: 'openLink'; url: string })
  | (ContextBound & { type: 'openCheck'; checkId: string })
  | (ContextBound & { type: 'openCommit'; commitId: string })
  | (ContextBound & { type: 'addGeneralComment'; body: string })
  | (ContextBound & {
      type: 'addInlineComment';
      body: string;
      position: {
        path: string;
        oldPath?: string;
        newPath?: string;
        side: 'old' | 'new';
        line: number;
        oldLine?: number;
        newLine?: number;
      };
    })
  | (ContextBound & { type: 'reply'; conversationId: string; body: string })
  | (ContextBound & { type: 'merge'; expectedHeadSha: string })
  | (ContextBound & {
      type: 'editMetadata';
      title?: string;
      description?: string;
      assigneeIds?: string[];
      reviewerIds?: string[];
      labels?: string[];
    })
  | (ContextBound & {
      type: 'listMetadataOptions';
      kind: MetadataOptionKind;
      search?: string;
      page?: number;
    })
  | (ContextBound & { type: 'deleteComment'; conversationId: string; commentId?: string })
  | (ContextBound & { type: 'setThreadResolved'; conversationId: string; resolved: boolean })
  | (ContextBound & { type: 'loadMarkdownContent'; path: string });

export type WebviewMessage =
  | {
      type: 'initialize';
      contextId: string;
      context: ReviewRequestContext;
      detail: ReviewRequestDetail;
      providerName: string;
      connectionName: string;
      accountLogin: string;
      accountId?: string;
      serverHost: string;
      repositoryName: string;
      capabilities: ProviderCapabilityDescriptor;
    }
  | { type: 'requests'; requestId: number; result: Page<ReviewRequestSummary> }
  | { type: 'files'; requestId: number; result: DiffFilePage }
  | { type: 'conversations'; requestId: number; result: Page<ReviewConversation> }
  | { type: 'checks'; requestId: number; result: CheckSummary[] }
  | { type: 'approvals'; requestId: number; result: ApprovalState }
  | { type: 'busy'; action: string; busy: boolean }
  | { type: 'mutationState'; uncertain: boolean }
  | { type: 'notice'; level: 'info' | 'warning' | 'error' | 'success'; message: string }
  | { type: 'stale'; message: string }
  | { type: 'merged'; message: string }
  | {
      type: 'metadataOptions';
      requestId: number;
      kind: MetadataOptionKind;
      result: Page<ProviderUser | string>;
    }
  | {
      type: 'markdownContent';
      path: string;
      oldContent?: string;
      newContent?: string;
      error?: string;
    }
  | { type: 'commits'; requestId: number; result?: Page<ReviewCommit>; error?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max = 20_000): value is string =>
  typeof value === 'string' && value.length <= max;

/** Runtime validation at the untrusted Webview boundary. Unknown keys are ignored. */
export function parseWebviewRequest(value: unknown): WebviewRequest | undefined {
  if (
    !isRecord(value) ||
    !isText(value.type, 80) ||
    !isText(value.contextId, 100) ||
    !value.contextId
  )
    return undefined;
  const contextId = value.contextId;
  switch (value.type) {
    case 'ready':
    case 'refresh':
    case 'loadMoreFiles':
    case 'loadMoreConversations':
    case 'loadMoreCommits':
    case 'openExternal':
      return { type: value.type, contextId };
    case 'openCheck':
      return isText(value.checkId, 500) && !!value.checkId
        ? { type: 'openCheck', contextId, checkId: value.checkId }
        : undefined;
    case 'openCommit':
      return isText(value.commitId, 500) && !!value.commitId
        ? { type: 'openCommit', contextId, commitId: value.commitId }
        : undefined;
    case 'openLink':
      return isText(value.url, 2048) && /^https:\/\//i.test(value.url)
        ? { type: 'openLink', contextId, url: value.url }
        : undefined;
    case 'selectTab':
      return ['overview', 'changes', 'conversations', 'checks', 'approvals', 'commits'].includes(
        String(value.tab),
      )
        ? {
            type: 'selectTab',
            tab: value.tab as
              'overview' | 'changes' | 'conversations' | 'checks' | 'approvals' | 'commits',
            contextId,
          }
        : undefined;
    case 'addGeneralComment':
      return isText(value.body) && value.body.trim()
        ? { type: value.type, body: value.body, contextId }
        : undefined;
    case 'addInlineComment': {
      const p = value.position;
      if (
        !isRecord(p) ||
        !isText(p.path, 4096) ||
        !p.path ||
        (p.side !== 'old' && p.side !== 'new') ||
        !Number.isSafeInteger(p.line) ||
        Number(p.line) < 1
      )
        return undefined;
      if (p.oldLine !== undefined && (!Number.isSafeInteger(p.oldLine) || Number(p.oldLine) < 1))
        return undefined;
      if (p.newLine !== undefined && (!Number.isSafeInteger(p.newLine) || Number(p.newLine) < 1))
        return undefined;
      if (p.oldPath !== undefined && !isText(p.oldPath, 4096)) return undefined;
      if (p.newPath !== undefined && !isText(p.newPath, 4096)) return undefined;
      return isText(value.body) && !!value.body.trim()
        ? {
            type: value.type,
            body: value.body,
            contextId,
            position: {
              path: p.path,
              side: p.side,
              line: Number(p.line),
              ...(p.oldPath === undefined ? {} : { oldPath: p.oldPath }),
              ...(p.newPath === undefined ? {} : { newPath: p.newPath }),
              ...(p.oldLine === undefined ? {} : { oldLine: Number(p.oldLine) }),
              ...(p.newLine === undefined ? {} : { newLine: Number(p.newLine) }),
            },
          }
        : undefined;
    }
    case 'reply':
      return isText(value.conversationId, 500) &&
        !!value.conversationId &&
        isText(value.body) &&
        !!value.body.trim()
        ? { type: value.type, contextId, conversationId: value.conversationId, body: value.body }
        : undefined;
    case 'merge':
      return isText(value.expectedHeadSha, 200) && !!value.expectedHeadSha
        ? { type: value.type, contextId, expectedHeadSha: value.expectedHeadSha }
        : undefined;
    case 'editMetadata': {
      const result: Extract<WebviewRequest, { type: 'editMetadata' }> = {
        type: value.type,
        contextId,
      };
      for (const key of ['title', 'description'] as const) {
        if (value[key] !== undefined) {
          if (!isText(value[key], key === 'title' ? 256 : 20_000)) return undefined;
          result[key] = value[key];
        }
      }
      for (const key of ['assigneeIds', 'reviewerIds', 'labels'] as const) {
        if (value[key] !== undefined) {
          if (
            !Array.isArray(value[key]) ||
            value[key].length > 100 ||
            !value[key].every((item) => isText(item, 500))
          )
            return undefined;
          result[key] = value[key] as string[];
        }
      }
      return Object.keys(result).length > 2 ? result : undefined;
    }
    case 'listMetadataOptions':
      return ['assignees', 'reviewers', 'labels'].includes(String(value.kind)) &&
        (value.search === undefined || isText(value.search, 200)) &&
        (value.page === undefined || (Number.isSafeInteger(value.page) && Number(value.page) > 0))
        ? {
            type: value.type,
            contextId,
            kind: value.kind as MetadataOptionKind,
            ...(value.search === undefined ? {} : { search: value.search }),
            ...(value.page === undefined ? {} : { page: Number(value.page) }),
          }
        : undefined;
    case 'deleteComment':
      return isText(value.conversationId, 500) &&
        !!value.conversationId &&
        (value.commentId === undefined || (isText(value.commentId, 500) && !!value.commentId))
        ? {
            type: value.type,
            contextId,
            conversationId: value.conversationId,
            ...(value.commentId === undefined ? {} : { commentId: value.commentId }),
          }
        : undefined;
    case 'setThreadResolved':
      return isText(value.conversationId, 500) &&
        !!value.conversationId &&
        typeof value.resolved === 'boolean'
        ? {
            type: value.type,
            contextId,
            conversationId: value.conversationId,
            resolved: value.resolved,
          }
        : undefined;
    case 'loadMarkdownContent':
      return isText(value.path, 4096) && !!value.path
        ? { type: value.type, contextId, path: value.path }
        : undefined;
    default:
      return undefined;
  }
}

export function validateWebviewRequest(
  value: unknown,
  expectedContextId: string,
): WebviewRequest | undefined {
  const request = parseWebviewRequest(value);
  return request?.contextId === expectedContextId ? request : undefined;
}

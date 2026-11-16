import type {
  ApprovalState,
  CheckSummary,
  DiffFilePage,
  Page,
  ProviderCapabilityDescriptor,
  ReviewConversation,
  ReviewRequestContext,
  ReviewRequestDetail,
  ReviewRequestSummary,
} from '../../domain/models';

type ContextBound = { contextId: string };
export type WebviewRequest =
  | (ContextBound & { type: 'ready' })
  | (ContextBound & {
      type: 'selectTab';
      tab: 'overview' | 'changes' | 'conversations' | 'checks' | 'approvals';
    })
  | (ContextBound & { type: 'refresh' })
  | (ContextBound & { type: 'loadMoreFiles' })
  | (ContextBound & { type: 'loadMoreConversations' })
  | (ContextBound & { type: 'openExternal' })
  | (ContextBound & { type: 'openLink'; url: string })
  | (ContextBound & { type: 'openCheck'; checkId: string })
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
  | (ContextBound & { type: 'merge'; expectedHeadSha: string });

export type WebviewMessage =
  | {
      type: 'initialize';
      contextId: string;
      context: ReviewRequestContext;
      detail: ReviewRequestDetail;
      providerName: string;
      connectionName: string;
      accountLogin: string;
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
  | { type: 'merged'; message: string };

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
    case 'openExternal':
      return { type: value.type, contextId };
    case 'openCheck':
      return isText(value.checkId, 500) && !!value.checkId
        ? { type: 'openCheck', contextId, checkId: value.checkId }
        : undefined;
    case 'openLink':
      return isText(value.url, 2048) && /^https:\/\//i.test(value.url)
        ? { type: 'openLink', contextId, url: value.url }
        : undefined;
    case 'selectTab':
      return ['overview', 'changes', 'conversations', 'checks', 'approvals'].includes(
        String(value.tab),
      )
        ? {
            type: 'selectTab',
            tab: value.tab as 'overview' | 'changes' | 'conversations' | 'checks' | 'approvals',
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

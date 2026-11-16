// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WebviewMessage,
  WebviewRequest,
} from '../../src/presentation/webview/messageProtocol';

const messages: WebviewRequest[] = [];

const detail = {
  id: 'pr-42',
  number: '42',
  repositoryId: 'repo-1',
  title: 'Review title',
  state: 'open' as const,
  author: { id: 'user-1', login: 'minh', name: 'Minh' },
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
  webUrl: 'https://example.test/repo/pull/42',
  description: undefined,
  headSha: 'head-sha',
  mergeable: null,
  assignees: undefined,
  reviewers: undefined,
  labels: undefined,
};

const capabilities = {
  generalComments: { support: 'supported' as const },
  inlineComments: { support: 'supported' as const },
  replyByResource: {
    'github-issue-comment': { support: 'unsupported' as const },
    'github-review-comment': { support: 'supported' as const },
  },
  resolveThreads: { support: 'unsupported' as const },
  checks: { support: 'unknown' as const },
  approvals: { support: 'unknown' as const },
  reviewDecisions: { support: 'unsupported' as const },
  merge: { support: 'supported' as const },
};

const initialize: WebviewMessage = {
  type: 'initialize',
  contextId: 'context-42',
  context: { repositoryId: 'repo-1', reviewRequestId: 'pr-42', headSha: 'head-sha' },
  detail,
  providerName: 'GitHub',
  connectionName: 'Work account',
  accountLogin: 'minh',
  serverHost: 'github.com',
  repositoryName: 'minh/reviewdock',
  capabilities,
};

const files: WebviewMessage = {
  type: 'files',
  requestId: 1,
  result: {
    items: [
      {
        path: 'src/example.ts',
        change: 'modified',
        additions: 1,
        deletions: 1,
        patch: '@@ -1,2 +1,2 @@\n context\n-old value\n+new value',
      },
    ],
    page: { page: 1, perPage: 50, hasNextPage: false },
  },
};

function send(message: WebviewMessage) {
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function mountWebview() {
  document.body.innerHTML = '<div id="root"></div>';
  messages.length = 0;
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (window as Window & { reviewDockContextId: string }).reviewDockContextId = 'preview-context';
  (globalThis as typeof globalThis & { acquireVsCodeApi: () => unknown }).acquireVsCodeApi =
    () => ({
      postMessage: (message: WebviewRequest) => messages.push(message),
      getState: () => undefined,
      setState: () => undefined,
    });
  vi.resetModules();
  await act(async () => {
    await import('../../webview-ui/src/main');
  });
}

beforeEach(async () => {
  await mountWebview();
});

afterEach(() => {
  document.body.innerHTML = '';
  delete (globalThis as typeof globalThis & { acquireVsCodeApi?: () => unknown }).acquireVsCodeApi;
});

describe('ReviewDock webview entry point', () => {
  it('renders optional overview fields as unavailable and escapes provider text as text', () => {
    const maliciousInitialize: WebviewMessage = {
      ...initialize,
      detail: {
        ...detail,
        title: '<img src=x onerror="window.injected=true">',
        description: '<script>window.injected=true</script>',
      },
    };
    send(maliciousInitialize);

    expect(document.querySelector('h1')?.textContent).toBe(
      '<img src=x onerror="window.injected=true">',
    );
    expect(document.querySelector('h1 img')).toBeNull();
    expect(document.querySelector('.markdown script')).toBeNull();
    expect(document.querySelector('.markdown')?.textContent).toBe(
      '<script>window.injected=true</script>',
    );
    expect(document.body.textContent).toContain('AssigneesUnavailable');
    expect(document.body.textContent).toContain('ReviewersUnavailable');
    expect(document.body.textContent).toContain('LabelsUnavailable');
    expect((window as Window & { injected?: boolean }).injected).toBeUndefined();
  });

  it('loads changed files on tab selection and submits the parsed added-line position with context', () => {
    send(initialize);
    act(() => button('Changes').click());
    expect(messages.at(-1)).toMatchObject({
      type: 'selectTab',
      tab: 'changes',
      contextId: 'context-42',
    });
    send(files);

    const commentLine = document.querySelector<HTMLButtonElement>(
      '.diff-row.added button[aria-label="Comment on src/example.ts line 2"]',
    );
    expect(commentLine).not.toBeNull();
    act(() => commentLine!.click());
    const editor = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Inline comment"]',
    );
    expect(editor).not.toBeNull();
    typeInto(editor!, 'Check this change');
    act(() => button('Send comment').click());

    expect(messages.at(-1)).toEqual({
      type: 'addInlineComment',
      contextId: 'context-42',
      body: 'Check this change',
      position: {
        path: 'src/example.ts',
        newPath: 'src/example.ts',
        side: 'new',
        line: 2,
        newLine: 2,
      },
    });
    expect(button('Sending…').disabled).toBe(true);
  });

  it('keeps an inline draft visible after the host reports a stale diff', () => {
    send(initialize);
    act(() => button('Changes').click());
    send(files);
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          '.diff-row.added [aria-label="Comment on src/example.ts line 2"]',
        )!
        .click(),
    );
    const editor = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Inline comment"]',
    )!;
    typeInto(editor, 'Keep this draft');

    send({ type: 'stale', message: 'The review changed. Refresh and choose a current line.' });

    expect(
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Inline comment"]')?.value,
    ).toBe('Keep this draft');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('The review changed');
    expect(button('Send comment').disabled).toBe(true);
    act(() => button('Choose another line').click());
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          '.diff-row.added [aria-label="Comment on src/example.ts line 2"]',
        )!
        .click(),
    );
    expect(
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Inline comment"]')?.value,
    ).toBe('Keep this draft');
    expect(button('Send comment').disabled).toBe(false);
  });

  it('gives the inline composer dialog semantics, traps tab focus, and restores focus on Escape', () => {
    send(initialize);
    act(() => button('Changes').click());
    send(files);
    const trigger = document.querySelector<HTMLButtonElement>(
      '.diff-row.added [aria-label="Comment on src/example.ts line 2"]',
    )!;
    act(() => trigger.focus());
    act(() => trigger.click());

    const dialog = document.querySelector<HTMLFormElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('inline-comment-title');
    expect(document.activeElement).toBe(
      document.querySelector('textarea[aria-label="Inline comment"]'),
    );

    const last = button('Send comment');
    act(() => last.focus());
    act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(
      document.querySelector('textarea[aria-label="Inline comment"]'),
    );
    act(() =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('submits general comments and replies with their supported native request kinds', () => {
    send(initialize);
    act(() => button('Conversations').click());
    const general = document.querySelector<HTMLTextAreaElement>('#general-comment')!;
    typeInto(general, 'A general note');
    act(() => button('Comment').click());
    expect(messages.at(-1)).toEqual({
      type: 'addGeneralComment',
      contextId: 'context-42',
      body: 'A general note',
    });

    send({ type: 'busy', action: 'general', busy: false });
    const conversation: WebviewMessage = {
      type: 'conversations',
      requestId: 1,
      result: {
        items: [
          {
            id: 'comment-1',
            provider: 'github',
            resourceType: 'github-review-comment',
            author: { id: 'reviewer', login: 'reviewer' },
            body: 'Please clarify this.',
            createdAt: '2026-11-02T00:00:00.000Z',
            replies: [],
          },
          {
            id: 'child-comment-1',
            provider: 'github',
            resourceType: 'github-review-comment',
            parentId: 'comment-1',
            author: { id: 'author', login: 'author' },
            body: 'A child reply cannot start another reply thread.',
            createdAt: '2026-11-02T00:05:00.000Z',
            replies: [],
          },
        ],
        page: { page: 1, perPage: 50, hasNextPage: false },
      },
    };
    send(conversation);
    const threadCards = document.querySelectorAll<HTMLElement>('.conversation');
    expect(threadCards[0]?.querySelector('button')?.textContent).toBe('Reply');
    expect(threadCards[1]?.querySelector('button')).toBeNull();
    act(() => button('Reply').click());
    const reply = document.querySelector<HTMLTextAreaElement>('#reply');
    expect(reply).not.toBeNull();
    typeInto(reply!, 'Here is more detail.');
    act(() => button('Send reply').click());
    expect(messages.at(-1)).toEqual({
      type: 'reply',
      contextId: 'context-42',
      conversationId: 'comment-1',
      body: 'Here is more detail.',
    });
  });

  it('omits reply on GitHub general issue comments', () => {
    send(initialize);
    send({
      type: 'conversations',
      requestId: 1,
      result: {
        items: [
          {
            id: 'issue-comment-1',
            provider: 'github',
            resourceType: 'github-issue-comment',
            author: { id: 'reviewer', login: 'reviewer' },
            body: 'General timeline comment',
            createdAt: '2026-11-02T00:00:00.000Z',
            replies: [],
          },
        ],
        page: { page: 1, perPage: 50, hasNextPage: false },
      },
    });
    expect(
      [...document.querySelectorAll('button')].some((item) => item.textContent?.trim() === 'Reply'),
    ).toBe(false);
  });

  it('does not resend an uncertain comment when the user refreshes', () => {
    send(initialize);
    act(() => button('Conversations').click());
    typeInto(
      document.querySelector<HTMLTextAreaElement>('#general-comment')!,
      'May have reached the provider',
    );
    act(() => button('Comment').click());
    expect(messages.filter((message) => message.type === 'addGeneralComment')).toHaveLength(1);

    send({ type: 'busy', action: 'general', busy: false });
    send({
      type: 'notice',
      level: 'warning',
      message: 'The outcome is unknown. Refresh to check the conversation.',
    });
    expect(document.querySelector<HTMLTextAreaElement>('#general-comment')?.value).toBe(
      'May have reached the provider',
    );
    act(() => button('Changes').click());
    send(files);
    act(() => button('Refresh').click());

    expect(messages.filter((message) => message.type === 'addGeneralComment')).toHaveLength(1);
    expect(messages.filter((message) => message.type === 'refresh')).toHaveLength(1);
  });

  it('shows a retry action when the initial host load fails', async () => {
    expect(document.querySelector('.spinner')).not.toBeNull();
    send({ type: 'notice', level: 'error', message: 'Could not load this review request.' });

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load this review request.',
    );
    expect(document.querySelector('.spinner')).toBeNull();
    act(() => button('Retry').click());
    expect(messages.at(-1)).toEqual({ type: 'refresh', contextId: 'preview-context' });
  });
});

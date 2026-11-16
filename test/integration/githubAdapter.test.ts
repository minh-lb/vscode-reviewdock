import { describe, expect, it, vi } from 'vitest';
import type { Connection } from '../../src/domain/models';
import { GitHubAdapter } from '../../src/infrastructure/providers/github/githubAdapter';
import type { ProviderHttpClient } from '../../src/infrastructure/http/providerHttpClient';

const connection: Connection = {
  id: 'connection-1',
  provider: 'github',
  displayName: 'Work',
  serverUrl: 'https://github.com',
  enabled: true,
  status: 'connected',
  createdAt: '',
  updatedAt: '',
};
const repo = {
  id: 17,
  name: 'demo',
  full_name: 'octo/demo',
  owner: { login: 'octo' },
  private: false,
  html_url: 'https://github.com/octo/demo',
};
const pr = (fields: Record<string, unknown> = {}) => ({
  id: 81,
  number: 5,
  title: 'Feature',
  body: 'description',
  state: 'open',
  draft: false,
  user: { id: 1, login: 'octo' },
  head: { ref: 'feature', sha: 'head-1' },
  base: { ref: 'main', sha: 'base-1' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  html_url: 'https://github.com/octo/demo/pull/5',
  commits: 6,
  changed_files: 4,
  additions: 12,
  deletions: 3,
  ...fields,
});

function setup(handler: (path: string, init?: { method?: string; body?: string }) => unknown) {
  const calls: Array<{ path: string; method?: string; body?: string }> = [];
  const http = {
    request: vi.fn(
      async (
        _connection: Connection,
        path: string,
        options?: { method?: string; body?: BodyInit | null },
      ) => {
        const call = {
          path,
          method: options?.method,
          body: typeof options?.body === 'string' ? options.body : undefined,
        };
        calls.push(call);
        const result = handler(path, call) as
          { data?: unknown; headers?: Headers; status?: number } | unknown[] | unknown;
        if (result && typeof result === 'object' && 'data' in result) {
          const response = result as { data: unknown; headers?: Headers; status?: number };
          return {
            data: response.data,
            headers: response.headers ?? new Headers(),
            status: response.status ?? 200,
          };
        }
        return { data: result, headers: new Headers(), status: 200 };
      },
    ),
  } as unknown as ProviderHttpClient;
  return { adapter: new GitHubAdapter(connection, http), calls };
}

describe('GitHubAdapter contract', () => {
  it('discovers current-user repositories with validated Link pagination and maps stable IDs', async () => {
    const { adapter } = setup((path) => {
      if (path.startsWith('/user/repos?'))
        return {
          data: [repo],
          headers: new Headers({
            Link: '<https://api.github.com/user/repos?page=2&per_page=100>; rel="next"',
          }),
        };
      if (path === 'https://api.github.com/user/repos?page=2&per_page=100')
        return {
          data: [{ ...repo, id: 18, name: 'next', full_name: 'octo/next' }],
          headers: new Headers(),
        };
      return [];
    });
    const first = await adapter.listRepositories({ perPage: 100 });
    const second = await adapter.listRepositories({ perPage: 100, page: 2 });
    expect(first.items.map((item) => item.id)).toEqual(['17']);
    expect(first.page.hasNextPage).toBe(true);
    expect(second.items.map((item) => item.id)).toEqual(['18']);
    expect(first.items[0]).toMatchObject({
      provider: 'github',
      fullName: 'octo/demo',
      owner: 'octo',
    });
  });

  it('uses scoped Search API filters and distinguishes merged from closed PRs', async () => {
    const { adapter, calls } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.startsWith('/search/issues?'))
        return {
          data: {
            total_count: 2,
            items: [
              pr({ merged: true }),
              pr({ id: 82, number: 6, state: 'closed', merged: false, merged_at: null }),
            ],
          },
        };
      if (path.includes('/pulls?'))
        return [
          pr({ merged: true }),
          pr({ id: 82, number: 6, state: 'closed', merged: false, merged_at: null }),
        ];
      return [];
    });
    const created = await adapter.listReviewRequests({
      repositoryId: '17',
      filter: 'created-by-me',
      page: 1,
      perPage: 30,
    });
    expect(
      calls.some((call) => call.path.includes('repo%3Aocto%2Fdemo%20is%3Apr%20author%3A%40me')),
    ).toBe(true);
    expect(created.items).toHaveLength(2);
    const merged = await adapter.listReviewRequests({ repositoryId: '17', filter: 'merged' });
    expect(merged.items.map((item) => item.state)).toEqual(['merged']);
  });

  it('preserves unknown PR state when the provider omits merge metadata', async () => {
    const { adapter, calls } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.includes('/pulls?')) return [pr({ state: 'closed' })];
      if (path.startsWith('/search/issues?')) {
        return {
          data: {
            total_count: 1,
            items: [pr({ state: 'closed', merged: undefined, merged_at: undefined })],
          },
        };
      }
      return [];
    });
    const closed = await adapter.listReviewRequests({ repositoryId: '17', filter: 'closed' });
    expect(closed.items[0].state).toBe('unknown');
    const searchedClosed = await adapter.listReviewRequests({
      repositoryId: '17',
      filter: 'closed',
      search: 'feature',
    });
    expect(searchedClosed.items[0].state).toBe('closed');
    expect(
      calls.some(
        (call) =>
          call.path.startsWith('/search/issues?') &&
          decodeURIComponent(call.path).includes('is:closed -is:merged'),
      ),
    ).toBe(true);
    const merged = await adapter.listReviewRequests({
      repositoryId: '17',
      filter: 'merged',
      search: 'feature',
    });
    expect(merged.items[0].state).toBe('merged');
  });

  it('marks file pagination capped at 3,000 while leaving missing patches unavailable', async () => {
    const { adapter } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.includes('/pulls/5/files?'))
        return {
          data: Array.from({ length: 100 }, (_, i) => ({
            filename: `image-${i}.png`,
            status: 'modified',
            additions: 0,
            deletions: 0,
            changes: 0,
          })),
          headers: new Headers({
            Link: '<https://api.github.com/repos/octo/demo/pulls/5/files?page=31&per_page=100>; rel="next"',
          }),
        };
      return pr();
    });
    const result = await adapter.listChangedFiles(
      { repositoryId: '17', reviewRequestId: '5' },
      30,
      100,
    );
    expect(result.items[0]).toMatchObject({ path: 'image-0.png', change: 'modified' });
    expect(result.items[0].patch).toBeUndefined();
    expect(result.page.incomplete).toBe(true);
    expect(result.page.hasNextPage).toBe(false);
  });

  it('groups review replies under their root and keeps issue comments distinct', async () => {
    const { adapter } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.endsWith('/issues/5/comments?per_page=100'))
        return [
          { id: 20, body: 'general', user: { id: 2, login: 'reviewer' }, created_at: '2026-01-01' },
        ];
      if (path.endsWith('/pulls/5/reviews?per_page=100'))
        return [
          {
            id: 30,
            state: 'APPROVED',
            body: 'looks good',
            user: { id: 2, login: 'reviewer' },
            submitted_at: '2026-01-02',
          },
        ];
      if (path.endsWith('/pulls/5/comments?per_page=100'))
        return [
          {
            id: 40,
            body: 'inline',
            path: 'src/a.ts',
            line: 3,
            side: 'RIGHT',
            user: { id: 2, login: 'reviewer' },
            created_at: '2026-01-03',
          },
          {
            id: 41,
            in_reply_to_id: 40,
            body: 'reply',
            user: { id: 1, login: 'octo' },
            created_at: '2026-01-04',
          },
          {
            id: 42,
            in_reply_to_id: 41,
            body: 'reply-to-reply',
            user: { id: 2, login: 'reviewer' },
            created_at: '2026-01-05',
          },
        ];
      return [];
    });
    const result = await adapter.listConversations({ repositoryId: '17', reviewRequestId: '5' });
    expect(result.items.map((item) => item.resourceType)).toEqual([
      'github-issue-comment',
      'github-review',
      'github-review-comment',
    ]);
    expect(result.items[1].reviewState).toBe('approved');
    const inline = result.items[2];
    expect(inline.id).toBe('40');
    expect(inline.position).toMatchObject({ path: 'src/a.ts', line: 3, side: 'new' });
    expect(inline.replies.map((reply) => reply.id)).toEqual(['41']);
  });

  it('sends exact inline/reply/decision/merge payloads and rejects stale merge SHA', async () => {
    const { adapter, calls } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.endsWith('/pulls/5')) return { data: pr() };
      if (path.endsWith('/pulls/5/comments'))
        return { id: 51, body: 'inline', user: { id: 1, login: 'octo' }, created_at: 'now' };
      if (path.endsWith('/issues/5/comments'))
        return { id: 54, body: 'general', user: { id: 1, login: 'octo' }, created_at: 'now' };
      if (path.endsWith('/pulls/comments/40'))
        return { id: 40, body: 'root', user: { id: 2, login: 'reviewer' }, created_at: 'now' };
      if (path.endsWith('/comments/40/replies'))
        return { id: 52, body: 'reply', user: { id: 1, login: 'octo' }, created_at: 'now' };
      if (path.endsWith('/pulls/5/reviews'))
        return { id: 53, body: '', user: { id: 1, login: 'octo' }, submitted_at: 'now' };
      if (path.endsWith('/pulls/5/merge')) return { merged: true, sha: 'merge-1' };
      return [];
    });
    const context = { repositoryId: '17', reviewRequestId: '5', headSha: 'head-1' };
    await adapter.createGeneralComment({ ...context, body: 'general note' });
    await adapter.createInlineComment({
      ...context,
      body: 'line note',
      position: { path: 'src/a.ts', side: 'old', line: 8 },
    });
    await adapter.replyToConversation({ ...context, conversationId: '40', body: 'reply' });
    await adapter.submitReviewDecision({ ...context, decision: 'approve' });
    const merged = await adapter.merge({ ...context, expectedHeadSha: 'head-1' });
    expect(merged).toMatchObject({ merged: true, mergeCommitSha: 'merge-1' });
    expect(calls.find((call) => call.path.endsWith('/issues/5/comments'))?.body).toBe(
      JSON.stringify({ body: 'general note' }),
    );
    expect(calls.find((call) => call.path.endsWith('/pulls/5/comments'))?.body).toBe(
      JSON.stringify({
        body: 'line note',
        commit_id: 'head-1',
        path: 'src/a.ts',
        line: 8,
        side: 'LEFT',
      }),
    );
    expect(calls.find((call) => call.path.endsWith('/comments/40/replies'))?.body).toBe(
      JSON.stringify({ body: 'reply' }),
    );
    expect(calls.find((call) => call.path.endsWith('/pulls/5/reviews'))?.body).toBe(
      JSON.stringify({ commit_id: 'head-1', event: 'APPROVE' }),
    );
    expect(calls.find((call) => call.path.endsWith('/pulls/5/merge'))?.body).toBe(
      JSON.stringify({ sha: 'head-1' }),
    );
    expect(calls.find((call) => call.path.endsWith('/pulls/5/merge'))?.body).not.toContain(
      'delete_branch',
    );
  });

  it('loads checks, commit statuses, Actions runs, and approvals for the refreshed current head only', async () => {
    const { adapter, calls } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.endsWith('/pulls/5')) return { data: pr() };
      if (path.includes('/check-runs?'))
        return {
          data: {
            check_runs: [
              {
                id: 1,
                name: 'build',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://github.com/check/1',
              },
            ],
          },
        };
      if (path.endsWith('/status?per_page=100'))
        return {
          data: {
            statuses: [
              {
                id: 2,
                context: 'ci/test',
                state: 'success',
                target_url: 'https://github.com/status/2',
              },
            ],
          },
        };
      if (path.includes('/actions/runs?'))
        return {
          data: {
            workflow_runs: [
              {
                id: 3,
                name: 'CI',
                status: 'completed',
                conclusion: 'failure',
                html_url: 'https://github.com/actions/3',
              },
            ],
          },
        };
      if (path.endsWith('/pulls/5/reviews?per_page=100'))
        return [
          {
            id: 9,
            state: 'APPROVED',
            commit_id: 'head-1',
            user: { id: 2, login: 'reviewer' },
            submitted_at: '2026-01-02',
          },
          {
            id: 10,
            state: 'PENDING',
            commit_id: 'head-1',
            user: { id: 2, login: 'reviewer' },
            submitted_at: '2026-01-03',
          },
        ];
      if (path === '/user') return { id: 1, login: 'octo' };
      return [];
    });
    const checks = await adapter.getChecks({
      repositoryId: '17',
      reviewRequestId: '5',
      headSha: 'head-1',
    });
    await expect(adapter.getReviewRequest('17', '5')).resolves.toMatchObject({
      commitsCount: 6,
      changedFiles: 4,
      additions: 12,
      deletions: 3,
    });
    expect(checks.map((check) => check.source)).toEqual(['check-run', 'commit-status', 'actions']);
    expect(checks.every((check) => check.headSha === 'head-1')).toBe(true);
    expect(
      calls
        .filter((call) => call.path.includes('/commits/'))
        .every((call) => call.path.includes('/commits/head-1/')),
    ).toBe(true);
    await expect(
      adapter.getChecks({ repositoryId: '17', reviewRequestId: '5', headSha: 'stale' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const approval = await adapter.getApprovalState({
      repositoryId: '17',
      reviewRequestId: '5',
      headSha: 'head-1',
    });
    expect(approval).toMatchObject({
      available: true,
      approvedBy: [{ login: 'reviewer' }],
    });
    expect(approval.userHasApproved).toBe(false);
  });

  it('does not submit a review decision or merge with a stale head SHA', async () => {
    const { adapter, calls } = setup((path) => {
      if (path.startsWith('/repositories/')) return { data: repo };
      if (path.endsWith('/pulls/5')) return { data: pr() };
      return [];
    });
    await expect(
      adapter.submitReviewDecision({
        repositoryId: '17',
        reviewRequestId: '5',
        headSha: 'stale',
        decision: 'approve',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      adapter.createInlineComment({
        repositoryId: '17',
        reviewRequestId: '5',
        headSha: 'stale',
        body: 'stale comment',
        position: { path: 'src/a.ts', side: 'new', line: 4 },
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      adapter.merge({ repositoryId: '17', reviewRequestId: '5', expectedHeadSha: 'stale' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(calls.every((call) => call.method !== 'POST' && call.method !== 'PUT')).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AppError, UnsupportedCapabilityError, ValidationError } from '../../src/domain/errors';
import type { Connection } from '../../src/domain/models';
import type { ProviderHttpClient } from '../../src/infrastructure/http/providerHttpClient';
import { GitLabAdapter } from '../../src/infrastructure/providers/gitlab/gitlabAdapter';

const connection: Connection = {
  id: 'conn-1',
  provider: 'gitlab',
  displayName: 'GitLab',
  serverUrl: 'https://gitlab.example',
  enabled: true,
  status: 'connected',
  createdAt: '',
  updatedAt: '',
};

function fixture(responses: unknown[], responseHeaders: HeadersInit[] = []) {
  let index = 0;
  const request = vi.fn(async () => {
    const current = index++;
    return { data: responses.shift(), status: 200, headers: new Headers(responseHeaders[current]) };
  });
  return {
    adapter: new GitLabAdapter(connection, { request } as unknown as ProviderHttpClient),
    request,
  };
}

describe('GitLabAdapter', () => {
  it('maps the authenticated GitLab user and resolves encoded project paths', async () => {
    const { adapter, request } = fixture([
      { id: 9, username: 'minh', name: 'Minh' },
      {
        id: 17,
        name: 'App',
        path_with_namespace: 'team/sub/app',
        web_url: 'https://gitlab.example/team/sub/app',
      },
    ]);
    expect(await adapter.getCurrentUser()).toMatchObject({ id: '9', login: 'minh', name: 'Minh' });
    expect((await adapter.getRepository('team/sub/app')).fullName).toBe('team/sub/app');
    expect(request.mock.calls.map((call) => call[1])).toEqual([
      'user',
      'projects/team%2Fsub%2Fapp',
    ]);
  });

  it('lists authenticated user projects using explicit membership and pagination', async () => {
    const { adapter, request } = fixture([
      [
        {
          id: 7,
          name: 'App',
          path_with_namespace: 'team/app',
          web_url: 'https://gitlab.example/team/app',
          namespace: { name: 'Team' },
          visibility: 'private',
          archived: false,
        },
      ],
    ]);
    const page = await adapter.listRepositories({ search: 'app', page: 2, perPage: 10 });
    expect(request).toHaveBeenCalledWith(connection, expect.stringContaining('projects?'));
    expect(page.items[0]).toMatchObject({
      id: '7',
      fullName: 'team/app',
      owner: 'Team',
      private: true,
    });
    expect(page.page).toMatchObject({ page: 2, perPage: 10, hasNextPage: false });
  });

  it('follows the provider next-page cursor and maps GitLab change counts when numeric', async () => {
    const { adapter } = fixture(
      [
        [
          {
            id: 7,
            iid: 3,
            state: 'opened',
            title: 'MR',
            author: { id: 1, username: 'dev' },
            source_branch: 'feature',
            target_branch: 'main',
            created_at: 'now',
            updated_at: 'now',
            web_url: 'https://gitlab.example/mr/3',
            changes_count: 4,
          },
        ],
      ],
      [{ 'x-next-page': '3', 'x-total': '31', 'x-total-pages': '3' }],
    );
    const page = await adapter.listReviewRequests({ repositoryId: '7', page: 1, perPage: 10 });
    expect(page.page.hasNextPage).toBe(true);
    const detail = await fixture([
      {
        id: 7,
        iid: 3,
        state: 'opened',
        title: 'MR',
        author: { id: 1, username: 'dev' },
        source_branch: 'feature',
        target_branch: 'main',
        created_at: 'now',
        updated_at: 'now',
        web_url: 'https://gitlab.example/mr/3',
        changes_count: 4,
      },
    ]).adapter.getReviewRequest('7', '3');
    expect(detail).toMatchObject({ state: 'open', changedFiles: 4 });
  });

  it('maps MR filters, search and the response without inventing missing fields', async () => {
    const { adapter, request } = fixture([[]]);
    await adapter.listReviewRequests({
      repositoryId: '7',
      filter: 'review-requested-from-me',
      search: 'bug',
      page: 3,
      perPage: 15,
    });
    const url = new URL(request.mock.calls[0][1] as string, `${connection.serverUrl}/api/v4/`);
    expect(url.pathname).toBe('/api/v4/projects/7/merge_requests');
    expect(url.searchParams.get('scope')).toBe('reviews_for_me');
    expect(url.searchParams.get('state')).toBe('opened');
    expect(url.searchParams.get('search')).toBe('bug');
    expect(url.searchParams.get('page')).toBe('3');
  });

  it('keeps an unknown MR state unknown and reports full pages without pagination metadata as incomplete', async () => {
    const { adapter } = fixture([
      [
        {
          id: 4,
          iid: 2,
          state: 'preparing',
          title: 'MR',
          author: { id: 1, username: 'author' },
          source_branch: 'feature',
          target_branch: 'main',
          created_at: 'now',
          updated_at: 'now',
          web_url: 'https://gitlab.example/mr/2',
        },
      ],
    ]);
    const requests = await adapter.listReviewRequests({ repositoryId: '7', page: 1, perPage: 1 });
    expect(requests.items[0].state).toBe('unknown');

    const projects = fixture([[{ id: 1 }, { id: 2 }]]).adapter;
    const page = await projects.listRepositories({ page: 4, perPage: 2 });
    expect(page.page).toMatchObject({ page: 4, perPage: 2, hasNextPage: false, incomplete: true });
    expect(page.page.totalCount).toBeUndefined();
  });

  it('uses GitLab pagination headers and loads all pipeline pages with forward progress', async () => {
    const { adapter, request } = fixture(
      [
        [{ id: 1, sha: 'stale', status: 'success' }],
        [{ id: 2, sha: 'head', status: 'running' }],
        [
          {
            id: 11,
            name: 'build',
            stage: 'test',
            status: 'success',
            web_url: 'https://gitlab.example/job/11',
          },
        ],
        [{ id: 12, name: 'deploy', stage: 'deploy', status: 'running' }],
        [{ id: 21, name: 'build', stage: 'test', status: 'success' }],
        [{ id: 22, name: 'deploy', stage: 'deploy', status: 'running' }],
      ],
      [
        { 'x-next-page': '3', 'x-total': '2', 'x-total-pages': '3' },
        {},
        { 'x-next-page': '2', 'x-total-pages': '2' },
        {},
        { 'x-next-page': '2', 'x-total-pages': '2' },
        {},
      ],
    );
    const checks = await adapter.getChecks({
      repositoryId: '7',
      reviewRequestId: '3',
      headSha: 'head',
    });
    expect(checks.map(({ id }) => id)).toEqual(['pipeline:2', 'job:2:11', 'job:2:12']);
    expect(
      checks.filter(({ source }) => source === 'job').every(({ headSha }) => headSha === 'head'),
    ).toBe(true);
    expect(checks[1]).toMatchObject({
      source: 'job',
      name: 'test: build',
      status: 'completed',
      conclusion: 'success',
      headSha: 'head',
      detailsUrl: 'https://gitlab.example/job/11',
    });
    expect(request.mock.calls.slice(0, 2).map((call) => call[1])).toEqual([
      expect.stringContaining('page=1'),
      expect.stringContaining('page=3'),
    ]);
    expect(request.mock.calls.slice(2, 4).map((call) => call[1])).toEqual([
      expect.stringContaining('/pipelines/2/jobs?page=1'),
      expect.stringContaining('/pipelines/2/jobs?page=2'),
    ]);
    const jobs = await adapter.listAllPipelineJobs('7', '8');
    expect(jobs.map(({ id }) => id)).toEqual(['21', '22']);
    expect(request.mock.calls.slice(4).map((call) => call[1])).toEqual([
      expect.stringContaining('page=1'),
      expect.stringContaining('page=2'),
    ]);
    const stalled = new GitLabAdapter(connection, {
      request: vi.fn(async () => ({
        data: [],
        status: 200,
        headers: new Headers({ 'x-next-page': '1' }),
      })),
    } as unknown as ProviderHttpClient);
    await expect(stalled.listAllPipelineJobs('7', '8')).rejects.toBeInstanceOf(AppError);
  });

  it('groups discussion notes, keeping system and resolution data', async () => {
    const { adapter } = fixture([
      [
        {
          id: 'discussion-1',
          individual_note: false,
          notes: [
            {
              id: 11,
              body: 'system event',
              system: true,
              author: { id: 1, username: 'bot' },
              created_at: '2026-01-01',
            },
            {
              id: 12,
              body: 'reply',
              system: false,
              author: { id: 2, username: 'dev' },
              created_at: '2026-01-02',
            },
          ],
          resolved: false,
          resolvable: true,
        },
      ],
    ]);
    const page = await adapter.listConversations({ repositoryId: '7', reviewRequestId: '3' });
    expect(page.items[0]).toMatchObject({
      id: 'discussion-1',
      resourceType: 'gitlab-discussion',
      resolved: false,
      systemNote: true,
    });
    expect(page.items[0].replies).toMatchObject([{ id: '12', body: 'reply' }]);
    expect(page.items[0].rootCommentId).toBe('11');
    expect(page.items[0].parentId).toBeUndefined();
  });

  it('updates only supplied MR metadata and deletes a discussion note by native note ID', async () => {
    const { adapter, request } = fixture([{}, undefined]);
    await adapter.updateMetadata(
      { repositoryId: 'team/app', reviewRequestId: '3' },
      {
        title: 'Updated title',
        labels: ['bug', 'ready'],
      },
    );
    await adapter.deleteComment(
      { repositoryId: 'team/app', reviewRequestId: '3' },
      'gitlab-discussion',
      'discussion-id',
      'note-id',
    );
    const calls = request.mock.calls as unknown as Array<
      [Connection, string, { method?: string; body?: BodyInit | null }?]
    >;
    expect(calls[0]?.[1]).toBe('projects/team%2Fapp/merge_requests/3');
    expect(calls[0]?.[2]?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.[2]?.body))).toEqual({
      title: 'Updated title',
      labels: 'bug,ready',
    });
    expect(calls[1]?.[1]).toBe(
      'projects/team%2Fapp/merge_requests/3/discussions/discussion-id/notes/note-id',
    );
    expect(calls[1]?.[2]?.method).toBe('DELETE');
  });

  it('loads full MR file content using the exact displayed diff refs', async () => {
    const { adapter, request } = fixture([
      [{ id: 1, base_commit_sha: 'base', start_commit_sha: 'start', head_commit_sha: 'head' }],
      'full markdown',
    ]);
    const context = {
      repositoryId: '7',
      reviewRequestId: '3',
      headSha: 'head',
      diffVersion: { baseSha: 'base', startSha: 'start', headSha: 'head' },
    };
    await expect(
      adapter.getFileContent({ ...context, path: 'docs/readme.md', side: 'old' }),
    ).resolves.toBe('full markdown');
    const calls = request.mock.calls as unknown as Array<
      [Connection, string, { responseText?: boolean }?]
    >;
    expect(calls[0]?.[1]).toContain('/versions?page=1&per_page=1');
    expect(calls[1]?.[1]).toContain('/repository/files/docs%2Freadme.md/raw?ref=base');
    expect(calls[1]?.[2]?.responseText).toBe(true);
  });

  it('posts inline discussions with exact GitLab paths, line sides and version SHAs', async () => {
    const { adapter, request } = fixture([
      {
        id: 'd',
        notes: [{ id: 13, body: 'note', author: { id: 1, username: 'me' }, created_at: 'now' }],
      },
    ]);
    await adapter.createInlineComment({
      repositoryId: '7',
      reviewRequestId: '3',
      body: 'note',
      diffVersion: { baseSha: 'base', startSha: 'start', headSha: 'head' },
      position: {
        path: 'new.ts',
        oldPath: 'old.ts',
        newPath: 'new.ts',
        side: 'new',
        line: 5,
        oldLine: 4,
        newLine: 5,
      },
    });
    const options = request.mock.calls[0][2] as { body: URLSearchParams; headers: HeadersInit };
    expect(new Headers(options.headers).get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(options.body.get('position[position_type]')).toBe('text');
    expect(options.body.get('position[old_line]')).toBe('4');
    expect(options.body.get('position[new_line]')).toBe('5');
    expect(options.body.get('position[old_path]')).toBe('old.ts');
    expect(options.body.get('position[new_path]')).toBe('new.ts');
    expect(options.body.get('position[head_sha]')).toBe('head');
  });

  it('loads the latest version and expands only collapsed files without using deprecated changes', async () => {
    const version = {
      id: 22,
      base_commit_sha: 'base',
      start_commit_sha: 'start',
      head_commit_sha: 'head',
    };
    const { adapter, request } = fixture([
      [version],
      [{ old_path: 'a.ts', new_path: 'a.ts', diff: '', collapsed: true }],
      { diffs: [{ old_path: 'a.ts', new_path: 'a.ts', diff: '@@ -1 +1 @@\n-old\n+new' }] },
    ]);
    const result = await adapter.listChangedFiles({ repositoryId: '7', reviewRequestId: '3' });
    expect(result.diffVersion).toEqual({
      id: '22',
      baseSha: 'base',
      startSha: 'start',
      headSha: 'head',
    });
    expect(result.items[0]).toMatchObject({ patch: '@@ -1 +1 @@\n-old\n+new', collapsed: false });
    expect(request.mock.calls.map((call) => call[1])).toEqual([
      expect.stringContaining('/versions?'),
      expect.stringContaining('/diffs?'),
      expect.stringContaining('/versions/22?'),
    ]);
    expect(request.mock.calls.every((call) => !(call[1] as string).includes('/changes'))).toBe(
      true,
    );
  });

  it('keeps too-large diffs unavailable and rejects incomplete inline anchors locally', async () => {
    const { adapter, request } = fixture([
      [],
      [{ old_path: 'large.bin', new_path: 'large.bin', too_large: true }],
    ]);
    const page = await adapter.listChangedFiles({ repositoryId: '7', reviewRequestId: '3' });
    expect(page.items[0]).toMatchObject({ tooLarge: true });
    await expect(
      adapter.createInlineComment({
        repositoryId: '7',
        reviewRequestId: '3',
        body: 'x',
        position: { path: 'a.ts', side: 'new', line: 1 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('matches pipeline checks to current head SHA and surfaces a missing endpoint as unsupported', async () => {
    const { adapter } = fixture([
      [
        { id: 1, sha: 'old', status: 'success' },
        {
          id: 2,
          sha: 'head',
          ref: 'main',
          status: 'failed',
          web_url: 'https://gitlab.example/pipeline/2',
        },
      ],
      [],
    ]);
    const checks = await adapter.getChecks({
      repositoryId: '7',
      reviewRequestId: '3',
      headSha: 'head',
    });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      id: 'pipeline:2',
      source: 'pipeline',
      headSha: 'head',
      conclusion: 'failure',
    });
    const missing = new GitLabAdapter(connection, {
      request: vi.fn().mockRejectedValue(new AppError('missing', 'not-found')),
    } as unknown as ProviderHttpClient);
    await expect(
      missing.getChecks({ repositoryId: '7', reviewRequestId: '3' }),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError);

    const forbiddenJobs = new GitLabAdapter(connection, {
      request: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: 2, sha: 'head', status: 'success' }],
          status: 200,
          headers: new Headers(),
        })
        .mockRejectedValueOnce(new AppError('forbidden', 'authorization')),
    } as unknown as ProviderHttpClient);
    await expect(
      forbiddenJobs.getChecks({ repositoryId: '7', reviewRequestId: '3', headSha: 'head' }),
    ).rejects.toMatchObject({ code: 'authorization' });
  });

  it('merges with the expected source SHA and omits unsafe optional behavior', async () => {
    const { adapter, request } = fixture([
      { state: 'merged', merge_commit_sha: 'merge-sha', web_url: 'https://gitlab.example/mr/3' },
    ]);
    const result = await adapter.merge({
      repositoryId: '7',
      reviewRequestId: '3',
      expectedHeadSha: 'source-sha',
    });
    expect(request.mock.calls[0][1]).toContain('/merge');
    expect(request.mock.calls[0][2]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ sha: 'source-sha' }),
    });
    expect(result).toMatchObject({ merged: true, mergeCommitSha: 'merge-sha' });
    expect(String((request.mock.calls[0][2] as { body: string }).body)).not.toMatch(
      /auto_merge|remove_source_branch/,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Connection, RepositoryRef, ReviewRequestContext } from '../../src/domain/models';
import type { ProviderHttpClient } from '../../src/infrastructure/http/providerHttpClient';
import {
  listGitHubCommits,
  listGitLabCommits,
} from '../../src/infrastructure/providers/reviewCommits';

const context: ReviewRequestContext = {
  repositoryId: '42',
  reviewRequestId: '7',
};
const repository: RepositoryRef = {
  id: '42',
  provider: 'github',
  name: 'repo',
  fullName: 'org/repo',
  owner: 'org',
  webUrl: 'https://github.com/org/repo',
};
const connection = (provider: Connection['provider']): Connection => ({
  id: `connection-${provider}`,
  provider,
  displayName: 'Work',
  serverUrl: provider === 'github' ? 'https://github.com' : 'https://gitlab.example',
  enabled: true,
  status: 'connected',
  createdAt: '',
  updatedAt: '',
});
const client = (request: ProviderHttpClient['request']) =>
  ({ request }) as unknown as ProviderHttpClient;

describe('review commit listing', () => {
  it('maps GitHub commit identity and derives pagination from the Link header', async () => {
    const request = vi.fn(async () => ({
      data: [
        {
          sha: 'abc123',
          html_url: 'https://github.com/org/repo/commit/abc123',
          commit: {
            message: 'Fix bug',
            author: { name: 'Dev', email: 'dev@example.test', date: '2026-10-01T10:00:00Z' },
            committer: { name: 'Release Bot', date: '2026-10-01T10:01:00Z' },
          },
          author: { id: 9, login: 'dev', avatar_url: 'https://avatar.test/dev.png' },
          committer: { id: 10, login: 'release-bot', avatar_url: 'https://avatar.test/bot.png' },
        },
      ],
      headers: new Headers({
        link: '<https://api.github.com/repos/org/repo/pulls/7/commits?page=2&per_page=20>; rel="next"',
      }),
    }));

    const result = await listGitHubCommits(
      client(request),
      connection('github'),
      repository,
      context,
      1,
      20,
    );

    expect(request).toHaveBeenCalledWith(
      connection('github'),
      '/repos/org/repo/pulls/7/commits?page=1&per_page=20',
    );
    expect(result.page).toEqual({ page: 1, perPage: 20, hasNextPage: true });
    expect(result.items[0]).toMatchObject({
      id: 'abc123',
      sha: 'abc123',
      message: 'Fix bug',
      authorName: 'Dev',
      authorEmail: 'dev@example.test',
      authoredAt: '2026-10-01T10:00:00Z',
      committerName: 'Release Bot',
      committedAt: '2026-10-01T10:01:00Z',
      author: { id: '9', login: 'dev' },
      committer: { id: '10', login: 'release-bot' },
      webUrl: 'https://github.com/org/repo/commit/abc123',
    });
  });

  it('maps GitLab commits and uses provider pagination headers', async () => {
    const request = vi.fn(async () => ({
      data: [
        {
          id: 'def456',
          short_id: 'def456',
          title: 'Add feature',
          message: 'Add feature\n\nDetails',
          author_name: 'Dev',
          committer_name: 'Release Bot',
          author_email: 'dev@example.test',
          authored_date: '2026-10-02T10:00:00Z',
          committed_date: '2026-10-02T10:02:00Z',
          web_url: 'https://gitlab.example/team/repo/-/commit/def456',
        },
      ],
      headers: new Headers({ 'x-next-page': '2' }),
    }));

    const result = await listGitLabCommits(client(request), connection('gitlab'), context, 1, 20);

    expect(request).toHaveBeenCalledWith(
      connection('gitlab'),
      'projects/42/merge_requests/7/commits?page=1&per_page=20',
    );
    expect(result.page).toEqual({ page: 1, perPage: 20, hasNextPage: true });
    expect(result.items[0]).toMatchObject({
      id: 'def456',
      sha: 'def456',
      message: 'Add feature\n\nDetails',
      authorName: 'Dev',
      authorEmail: 'dev@example.test',
      authoredAt: '2026-10-02T10:00:00Z',
      committerName: 'Release Bot',
      committedAt: '2026-10-02T10:02:00Z',
      webUrl: 'https://gitlab.example/team/repo/-/commit/def456',
    });
  });

  it('marks provider pagination limits and missing GitLab pagination metadata', async () => {
    const githubRequest = vi.fn(async () => ({ data: [], headers: new Headers() }));
    const github = await listGitHubCommits(
      client(githubRequest),
      connection('github'),
      repository,
      context,
      3,
      100,
    );
    expect(github.page).toEqual({ page: 3, perPage: 100, hasNextPage: false, limited: true });

    const gitlabRequest = vi.fn(async () => ({
      data: Array.from({ length: 20 }, (_, index) => ({ id: `sha-${index}`, message: 'Commit' })),
      headers: new Headers(),
    }));
    const gitlab = await listGitLabCommits(
      client(gitlabRequest),
      connection('gitlab'),
      context,
      1,
      20,
    );
    expect(gitlab.page).toEqual({ page: 1, perPage: 20, hasNextPage: false, incomplete: true });
  });
});

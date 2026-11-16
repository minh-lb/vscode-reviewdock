import type {
  Page,
  PageInfo,
  ProviderUser,
  RepositoryRef,
  ReviewCommit,
  ReviewRequestContext,
  Connection,
} from '../../domain/models';
import { AppError } from '../../domain/errors';
import type { ProviderHttpClient } from '../http/providerHttpClient';

type Json = Record<string, unknown>;

const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' ? (value as Json) : {};
const string = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length ? value : undefined;
const pageNumber = (value: number | undefined, fallback: number): number =>
  Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
const perPageNumber = (value: number | undefined): number => Math.min(100, pageNumber(value, 30));
const pageInfo = (
  page: number,
  perPage: number,
  hasNextPage: boolean,
  flags: Pick<PageInfo, 'limited' | 'incomplete'> = {},
): PageInfo => ({ page, perPage, hasNextPage, ...flags });
const pathSegment = (value: string): string => encodeURIComponent(value);

function mapGitHubCommit(raw: Json): ReviewCommit {
  const commit = object(raw.commit);
  const authorData = object(commit.author);
  const committerData = object(commit.committer);
  const userData = object(raw.author);
  const committerUserData = object(raw.committer);
  const login = string(userData.login);
  const committerLogin = string(committerUserData.login);
  const sha = string(raw.sha) ?? '';
  const author: ProviderUser | undefined = login
    ? {
        id: typeof userData.id === 'number' ? String(userData.id) : (string(userData.id) ?? login),
        login,
        ...(string(userData.name) ? { name: string(userData.name)! } : {}),
        ...(string(userData.avatar_url) ? { avatarUrl: string(userData.avatar_url)! } : {}),
      }
    : undefined;
  const committer: ProviderUser | undefined = committerLogin
    ? {
        id:
          typeof committerUserData.id === 'number'
            ? String(committerUserData.id)
            : (string(committerUserData.id) ?? committerLogin),
        login: committerLogin,
        ...(string(committerUserData.name) ? { name: string(committerUserData.name)! } : {}),
        ...(string(committerUserData.avatar_url)
          ? { avatarUrl: string(committerUserData.avatar_url)! }
          : {}),
      }
    : undefined;
  return {
    id: sha,
    sha,
    message: string(commit.message) ?? '',
    ...(author ? { author } : {}),
    ...(committer ? { committer } : {}),
    ...(string(authorData.name) ? { authorName: string(authorData.name)! } : {}),
    ...(string(committerData.name) ? { committerName: string(committerData.name)! } : {}),
    ...(string(authorData.email) ? { authorEmail: string(authorData.email)! } : {}),
    ...(string(authorData.date) ? { authoredAt: string(authorData.date)! } : {}),
    ...(string(committerData.date) ? { committedAt: string(committerData.date)! } : {}),
    ...(string(raw.html_url) ? { webUrl: string(raw.html_url)! } : {}),
  };
}

function linkHasNext(headers: Headers): boolean {
  const link = headers.get('link');
  if (!link) return false;
  return link.split(/,(?=\s*<)/).some((part) => {
    const relation = /;\s*rel="?([^";]+)"?/i.exec(part)?.[1];
    return relation?.split(/\s+/).includes('next') ?? false;
  });
}

function requestPath(repository: RepositoryRef, context: ReviewRequestContext): string {
  if (repository.id !== context.repositoryId)
    throw new AppError('Repository does not match review request context', 'validation');
  const [owner, name] = repository.fullName.split('/').filter(Boolean);
  if (!owner || !name) throw new AppError('GitHub repository path is invalid', 'validation');
  return `/repos/${pathSegment(owner)}/${pathSegment(name)}/pulls/${pathSegment(context.reviewRequestId)}/commits`;
}

export async function listGitHubCommits(
  client: ProviderHttpClient,
  connection: Connection,
  repository: RepositoryRef,
  context: ReviewRequestContext,
  requestedPage?: number,
  requestedPerPage?: number,
): Promise<Page<ReviewCommit>> {
  if (
    connection.provider !== 'github' ||
    (repository.provider && repository.provider !== 'github') ||
    (repository.connectionId && repository.connectionId !== connection.id)
  )
    throw new AppError('Repository does not belong to this GitHub connection', 'validation');
  const page = pageNumber(requestedPage, 1);
  const perPage = perPageNumber(requestedPerPage);
  const path = `${requestPath(repository, context)}?page=${page}&per_page=${perPage}`;
  const { data, headers } = await client.request<Json[]>(connection, path);
  if (!Array.isArray(data))
    throw new AppError('GitHub returned an unexpected commit list', 'provider-server');
  return {
    items: data.map(mapGitHubCommit),
    page: pageInfo(page, perPage, linkHasNext(headers), {
      ...(page * perPage >= 250 ? { limited: true } : {}),
    }),
  };
}

function mapGitLabCommit(raw: Json): ReviewCommit {
  const sha = string(raw.id) ?? '';
  const message = string(raw.message) ?? string(raw.title) ?? '';
  return {
    id: sha,
    sha,
    message,
    ...(string(raw.author_name) ? { authorName: string(raw.author_name)! } : {}),
    ...(string(raw.committer_name) ? { committerName: string(raw.committer_name)! } : {}),
    ...(string(raw.author_email) ? { authorEmail: string(raw.author_email)! } : {}),
    ...(string(raw.authored_date) ? { authoredAt: string(raw.authored_date)! } : {}),
    ...(string(raw.committed_date) ? { committedAt: string(raw.committed_date)! } : {}),
    ...(string(raw.web_url) ? { webUrl: string(raw.web_url)! } : {}),
  };
}

function gitLabPageInfo(
  headers: Headers,
  data: unknown[],
  page: number,
  perPage: number,
): PageInfo {
  const next = headers.get('x-next-page');
  const totalPages = headers.get('x-total-pages');
  const total = headers.get('x-total');
  const parsedTotal = total === null ? undefined : Number(total);
  const parsedPages = totalPages === null ? undefined : Number(totalPages);
  const hasNextPage =
    (next !== null && next !== '' && Number.isSafeInteger(Number(next)) && Number(next) > page) ||
    (parsedPages !== undefined && Number.isFinite(parsedPages) && parsedPages > page) ||
    (parsedTotal !== undefined && Number.isFinite(parsedTotal) && page * perPage < parsedTotal);
  const invalidNext =
    next !== null && next !== '' && (!Number.isSafeInteger(Number(next)) || Number(next) <= page);
  const paginationKnown = (next !== null && !invalidNext) || totalPages !== null || total !== null;
  return {
    page,
    perPage,
    hasNextPage,
    ...(parsedTotal !== undefined && Number.isFinite(parsedTotal) && parsedTotal >= 0
      ? { totalCount: parsedTotal }
      : {}),
    ...(data.length === perPage && !paginationKnown && !hasNextPage ? { incomplete: true } : {}),
  };
}

export async function listGitLabCommits(
  client: ProviderHttpClient,
  connection: Connection,
  context: ReviewRequestContext,
  requestedPage?: number,
  requestedPerPage?: number,
): Promise<Page<ReviewCommit>> {
  if (connection.provider !== 'gitlab')
    throw new AppError('Commits require a GitLab connection', 'validation');
  const page = pageNumber(requestedPage, 1);
  const perPage = perPageNumber(requestedPerPage);
  const path = `projects/${pathSegment(context.repositoryId)}/merge_requests/${pathSegment(context.reviewRequestId)}/commits?page=${page}&per_page=${perPage}`;
  const { data, headers } = await client.request<Json[]>(connection, path);
  if (!Array.isArray(data))
    throw new AppError('GitLab returned an unexpected commit list', 'provider-server');
  return {
    items: data.map(mapGitLabCommit),
    page: gitLabPageInfo(headers, data, page, perPage),
  };
}

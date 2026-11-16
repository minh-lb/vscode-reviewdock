import type {
  ReviewProvider,
  ReviewConversationManagement,
  ReviewRequestManagement,
  ReviewFileContentProvider,
  ReviewCommitProvider,
} from '../../../application/ports';
import type { Connection } from '../../../domain/models';
import type {
  ApprovalState,
  CheckSummary,
  ConversationQuery,
  CreateGeneralCommentInput,
  CreateInlineCommentInput,
  DiffFilePage,
  MergeInput,
  MergeResult,
  Page,
  PageInfo,
  ProviderCapabilityDescriptor,
  ProviderUser,
  ReplyInput,
  RepositoryQuery,
  RepositoryRef,
  ReviewComment,
  ReviewConversation,
  ReviewDecision,
  ReviewRequestContext,
  ReviewRequestDetail,
  ReviewRequestQuery,
  ReviewRequestSummary,
  SubmitReviewDecisionInput,
  MetadataOptionQuery,
  ReviewRequestMetadataInput,
  ReviewFileContentContext,
} from '../../../domain/models';
import { AppError, UnsupportedCapabilityError, ValidationError } from '../../../domain/errors';
import { ProviderHttpClient } from '../../http/providerHttpClient';
import { listGitHubCommits } from '../reviewCommits';
import {
  groupGitHubConversations,
  mapGitHubApprovalState,
  mapGitHubCheck,
  mapGitHubFile,
  mapGitHubRepository,
  mapGitHubRequestDetail,
  mapGitHubRequestSummary,
  mapGitHubReviewComment,
  mapGitHubUser,
} from './githubMappers';

// GitHub's response DTOs are endpoint-specific and optional; keep raw provider shapes at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const PER_PAGE_MAX = 100;
const SEARCH_MAX = 1000;

function encodePath(value: string): string {
  return encodeURIComponent(value);
}
function pageInfo(
  page: number,
  perPage: number,
  hasNextPage: boolean,
  totalCount?: number,
  limited = false,
  incomplete = false,
): PageInfo {
  return {
    page,
    perPage,
    hasNextPage,
    ...(totalCount === undefined ? {} : { totalCount }),
    ...(limited ? { limited: true } : {}),
    ...(incomplete ? { incomplete: true } : {}),
  };
}
function sameDiffVersion(
  left: NonNullable<DiffFilePage['diffVersion']>,
  right: NonNullable<DiffFilePage['diffVersion']>,
): boolean {
  return (
    left.baseSha === right.baseSha &&
    left.startSha === right.startSha &&
    left.headSha === right.headSha
  );
}
function linkNext(headers: Headers): string | undefined {
  const link = headers.get('link');
  if (!link) return undefined;
  for (const part of link.split(/,(?=\s*<)/)) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?([^";]+)"?/i);
    if (match?.[2]?.split(/\s+/).includes('next') && match[1]) return match[1];
  }
  return undefined;
}

/** GitHub REST API v3 adapter. All HTTP and credential handling remains in ProviderHttpClient. */
export class GitHubAdapter
  implements
    ReviewProvider,
    ReviewConversationManagement,
    ReviewRequestManagement,
    ReviewFileContentProvider,
    ReviewCommitProvider
{
  readonly provider = 'github' as const;
  private readonly repositories = new Map<string, RepositoryRef>();

  constructor(
    private readonly connection: Connection,
    private readonly http: ProviderHttpClient,
  ) {
    if (connection.provider !== 'github')
      throw new ValidationError('GitHubAdapter requires a GitHub connection');
  }

  private async request<T>(path: string, options?: Parameters<ProviderHttpClient['request']>[2]) {
    return this.http.request<T>(this.connection, path, options);
  }

  private async allPages<T>(
    path: string,
    perPage = PER_PAGE_MAX,
    maxItems = Infinity,
  ): Promise<{ items: T[]; capped: boolean }> {
    let url = `${path}${path.includes('?') ? '&' : '?'}per_page=${Math.min(PER_PAGE_MAX, perPage)}`;
    const items: T[] = [];
    while (url && items.length < maxItems) {
      const { data, headers } = await this.request<T[]>(url);
      if (!Array.isArray(data))
        throw new AppError('GitHub returned an unexpected list response', 'provider-server');
      items.push(...data.slice(0, Math.max(0, maxItems - items.length)));
      url = linkNext(headers) ?? '';
    }
    return { items, capped: items.length >= maxItems && !!url };
  }

  private async allEnvelopePages<T>(path: string, key: string): Promise<T[]> {
    let url = `${path}${path.includes('?') ? '&' : '?'}per_page=${PER_PAGE_MAX}`;
    const items: T[] = [];
    while (url) {
      const { data, headers } = await this.request<Json>(url);
      const pageItems = data?.[key];
      if (!Array.isArray(pageItems))
        throw new AppError('GitHub returned an unexpected list response', 'provider-server');
      items.push(...pageItems);
      url = linkNext(headers) ?? '';
    }
    return items;
  }

  private async requestedArrayPage<T>(
    path: string,
    page: number,
    perPage: number,
  ): Promise<{ items: T[]; next?: string }> {
    let url = `${path}${path.includes('?') ? '&' : '?'}page=1&per_page=${perPage}`;
    let response: { data: T[]; headers: Headers } | undefined;
    for (let current = 1; current <= page; current++) {
      response = await this.request<T[]>(url);
      if (!Array.isArray(response.data))
        throw new AppError('GitHub returned an unexpected list response', 'provider-server');
      const next = linkNext(response.headers);
      if (current < page) {
        if (!next) return { items: [] };
        url = next;
      }
    }
    const next = response ? linkNext(response.headers) : undefined;
    return { items: response?.data ?? [], ...(next ? { next } : {}) };
  }

  private async searchIssues(
    path: string,
    page: number,
    perPage: number,
  ): Promise<{ items: Json[]; totalCount: number; incomplete: boolean }> {
    let url = `${path}&page=1&per_page=${perPage}`;
    let data: Json | undefined;
    let next: string | undefined;
    for (let current = 1; current <= page; current++) {
      const response = await this.request<Json>(url);
      data = response.data;
      if (!Array.isArray(data?.items) || typeof data.total_count !== 'number')
        throw new AppError('GitHub returned an unexpected search response', 'provider-server');
      next = linkNext(response.headers);
      if (current < page) {
        if (!next)
          return {
            items: [],
            totalCount: data.total_count,
            incomplete: data.incomplete_results === true || data.total_count >= SEARCH_MAX,
          };
        url = next;
      }
    }
    const totalCount = data?.total_count ?? 0;
    return {
      items: data?.items ?? [],
      totalCount,
      incomplete: data?.incomplete_results === true || (totalCount >= SEARCH_MAX && !!next),
    };
  }

  private async repository(repositoryId: string): Promise<RepositoryRef> {
    const cached = this.repositories.get(repositoryId);
    if (cached) return cached;
    const path = /^\d+$/.test(repositoryId)
      ? `/repositories/${encodePath(repositoryId)}`
      : `/repos/${repositoryId.split('/').map(encodePath).join('/')}`;
    const { data } = await this.request<Json>(path);
    const repo = mapGitHubRepository(data, this.connection.serverUrl, this.connection.id);
    this.repositories.set(repo.id, repo);
    return repo;
  }

  private repoPath(repo: RepositoryRef): string {
    return `/repos/${encodePath(repo.owner)}/${encodePath(repo.name)}`;
  }
  private async requestContext(context: ReviewRequestContext) {
    const repo = await this.repository(context.repositoryId);
    const path = `${this.repoPath(repo)}/pulls/${encodePath(context.reviewRequestId)}`;
    return { repo, path };
  }

  private graphqlUrl(): string {
    const server = new URL(this.connection.serverUrl);
    return server.hostname === 'github.com' && server.pathname === '/'
      ? 'https://api.github.com/graphql'
      : `${this.connection.serverUrl.replace(/\/$/, '')}/api/graphql`;
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
    cancellable = false,
  ): Promise<T> {
    const { data } = await this.request<{ data?: T; errors?: unknown[] }>(this.graphqlUrl(), {
      method: 'POST',
      graphql: true,
      cancellable,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!data.data || data.errors?.length)
      throw new AppError('GitHub GraphQL request failed', 'provider-server');
    return data.data;
  }

  private async reviewThreads(
    repository: RepositoryRef,
    number: string,
  ): Promise<
    Map<number, { id: string; resolved?: boolean; canResolve?: boolean; canUnresolve?: boolean }>
  > {
    const result = new Map<
      number,
      { id: string; resolved?: boolean; canResolve?: boolean; canUnresolve?: boolean }
    >();
    const query = `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{id isResolved viewerCanResolve viewerCanUnresolve comments(first:100){nodes{databaseId}}} pageInfo{hasNextPage endCursor}}}}}`;
    let cursor: string | null = null;
    for (;;) {
      const data: Json = await this.graphql<Json>(
        query,
        { owner: repository.owner, name: repository.name, number: Number(number), cursor },
        true,
      );
      const connection: Json = data.repository?.pullRequest?.reviewThreads;
      if (!connection || !Array.isArray(connection.nodes))
        throw new AppError('GitHub did not return pull request review threads', 'provider-server');
      for (const thread of connection.nodes) {
        if (typeof thread.id !== 'string') continue;
        const value = {
          id: thread.id,
          ...(typeof thread.isResolved === 'boolean' ? { resolved: thread.isResolved } : {}),
          ...(typeof thread.viewerCanResolve === 'boolean'
            ? { canResolve: thread.viewerCanResolve }
            : {}),
          ...(typeof thread.viewerCanUnresolve === 'boolean'
            ? { canUnresolve: thread.viewerCanUnresolve }
            : {}),
        };
        for (const comment of thread.comments?.nodes ?? [])
          if (Number.isSafeInteger(comment.databaseId))
            result.set(Number(comment.databaseId), value);
      }
      if (connection.pageInfo?.hasNextPage !== true) return result;
      if (
        typeof connection.pageInfo.endCursor !== 'string' ||
        connection.pageInfo.endCursor === cursor
      )
        throw new AppError('GitHub review thread pagination did not advance', 'provider-server');
      cursor = connection.pageInfo.endCursor;
    }
  }

  async getCurrentUser(): Promise<ProviderUser> {
    const { data } = await this.request<Json>('/user');
    return mapGitHubUser(data);
  }

  async listRepositories(query: RepositoryQuery): Promise<Page<RepositoryRef>> {
    const requestedPage = Math.max(1, query.page ?? 1),
      perPage = Math.min(PER_PAGE_MAX, Math.max(1, query.perPage ?? PER_PAGE_MAX));
    const base =
      '/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated';
    if (!query.search) {
      const { items: rawItems, next } = await this.requestedArrayPage<Json>(
        base,
        requestedPage,
        perPage,
      );
      const items = rawItems.map((raw) =>
        mapGitHubRepository(raw, this.connection.serverUrl, this.connection.id),
      );
      for (const repo of items) this.repositories.set(repo.id, repo);
      return { items, page: pageInfo(requestedPage, perPage, !!next) };
    }
    const { items, capped } = await this.allPages<Json>(base, perPage);
    const repos = items.map((raw) =>
      mapGitHubRepository(raw, this.connection.serverUrl, this.connection.id),
    );
    for (const repo of repos) this.repositories.set(repo.id, repo);
    const filtered = repos.filter((r) =>
      r.fullName.toLowerCase().includes(query.search!.toLowerCase()),
    );
    const start = (requestedPage - 1) * perPage;
    return {
      items: filtered.slice(start, start + perPage),
      page: pageInfo(
        requestedPage,
        perPage,
        start + perPage < filtered.length || capped,
        filtered.length,
      ),
    };
  }

  async getRepository(repositoryId: string): Promise<RepositoryRef> {
    return this.repository(repositoryId);
  }

  async listReviewRequests(query: ReviewRequestQuery): Promise<Page<ReviewRequestSummary>> {
    const repo = await this.repository(query.repositoryId);
    const requestedPage = Math.max(1, query.page ?? 1),
      perPage = Math.min(PER_PAGE_MAX, Math.max(1, query.perPage ?? 30));
    if (/^\d+$/.test(query.search ?? '')) {
      const detail = await this.getReviewRequest(repo.id, query.search!);
      const matches =
        query.filter === 'merged'
          ? detail.state === 'merged'
          : query.filter === 'closed'
            ? detail.state === 'closed'
            : query.filter === 'open' || !query.filter
              ? detail.state === 'open'
              : true;
      const items = requestedPage === 1 && matches ? [detail] : [];
      return { items, page: pageInfo(requestedPage, perPage, false, items.length) };
    }
    const scoped =
      query.search ||
      ['created-by-me', 'assigned-to-me', 'review-requested-from-me'].includes(query.filter ?? '');
    if (scoped) {
      const qualifier =
        query.filter === 'created-by-me'
          ? ' author:@me'
          : query.filter === 'assigned-to-me'
            ? ' assignee:@me'
            : query.filter === 'review-requested-from-me'
              ? ' user-review-requested:@me'
              : '';
      const title = query.search ? ` in:title ${query.search}` : '';
      const stateQualifier =
        query.filter === 'open'
          ? ' is:open'
          : query.filter === 'closed'
            ? ' is:closed -is:merged'
            : query.filter === 'merged'
              ? ' is:merged'
              : '';
      const q = `repo:${repo.fullName} is:pr${qualifier}${stateQualifier}${title}`;
      const path = `/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc`;
      const { items, totalCount, incomplete } = await this.searchIssues(
        path,
        requestedPage,
        perPage,
      );
      const stateHint =
        query.filter === 'merged'
          ? 'merged'
          : query.filter === 'closed'
            ? 'closed'
            : query.filter === 'open'
              ? 'open'
              : undefined;
      const results = items.map((raw) =>
        mapGitHubRequestSummary(raw, repo.id, this.connection.id, stateHint),
      );
      return {
        items: results,
        page: pageInfo(
          requestedPage,
          perPage,
          requestedPage * perPage < Math.min(SEARCH_MAX, totalCount),
          Math.min(SEARCH_MAX, totalCount),
          totalCount >= SEARCH_MAX,
          incomplete,
        ),
      };
    }
    const filter = query.filter ?? 'open';
    const state =
      filter === 'merged' || filter === 'closed' ? 'closed' : filter === 'all' ? 'all' : 'open';
    const path = `${this.repoPath(repo)}/pulls?state=${state}&sort=updated&direction=desc`;
    const filteredState = filter === 'merged' || filter === 'closed';
    let pageItems: Json[];
    let nextUrl: string | undefined;
    if (filteredState) {
      const first = await this.requestedArrayPage<Json>(path, 1, perPage);
      pageItems = first.items;
      nextUrl = first.next;
      const wanted = requestedPage * perPage;
      const matched: ReviewRequestSummary[] = [];
      const appendMatches = (rawItems: Json[]) => {
        const summaries = rawItems.map((raw) =>
          mapGitHubRequestSummary(raw, repo.id, this.connection.id),
        );
        matched.push(
          ...summaries.filter((item) =>
            filter === 'merged'
              ? item.state === 'merged'
              : item.state === 'closed' || item.state === 'unknown',
          ),
        );
      };
      appendMatches(pageItems);
      while (matched.length < wanted && nextUrl) {
        const response = await this.request<Json[]>(nextUrl);
        pageItems = response.data;
        appendMatches(pageItems);
        nextUrl = linkNext(response.headers);
      }
      const offset = (requestedPage - 1) * perPage;
      return {
        items: matched.slice(offset, offset + perPage),
        page: pageInfo(requestedPage, perPage, matched.length > offset + perPage || !!nextUrl),
      };
    }
    const result = await this.requestedArrayPage<Json>(path, requestedPage, perPage);
    pageItems = result.items;
    nextUrl = result.next;
    return {
      items: pageItems.map((raw) => mapGitHubRequestSummary(raw, repo.id, this.connection.id)),
      page: pageInfo(requestedPage, perPage, !!nextUrl),
    };
  }

  async getReviewRequest(
    repositoryId: string,
    reviewRequestId: string,
  ): Promise<ReviewRequestDetail> {
    const repo = await this.repository(repositoryId);
    const { data } = await this.request<Json>(
      `${this.repoPath(repo)}/pulls/${encodePath(reviewRequestId)}`,
    );
    return mapGitHubRequestDetail(data, repo.id, this.connection.id);
  }

  async listChangedFiles(
    context: ReviewRequestContext,
    page = 1,
    perPage = 100,
  ): Promise<DiffFilePage> {
    const { path } = await this.requestContext(context);
    const size = Math.min(PER_PAGE_MAX, Math.max(1, perPage));
    const requestedPage = Math.max(1, page);
    const { items: files, next } = await this.requestedArrayPage<Json>(
      `${path}/files`,
      requestedPage,
      size,
    );
    const count = (requestedPage - 1) * size + files.length;
    const limited = count >= 3000 || requestedPage * size > 3000;
    const result: DiffFilePage = {
      items: files.map(mapGitHubFile),
      page: pageInfo(
        requestedPage,
        size,
        !!next && !limited,
        Math.min(3000, count),
        limited,
        limited,
      ),
      ...(limited ? { truncated: true } : {}),
    };
    if (context.headSha) result.diffVersion = await this.currentDiffVersion(context);
    return result;
  }

  private async currentDiffVersion(
    context: ReviewRequestContext,
  ): Promise<NonNullable<DiffFilePage['diffVersion']>> {
    const detail = await this.getReviewRequest(context.repositoryId, context.reviewRequestId);
    if (!detail.headSha || !detail.baseSha || detail.headSha !== context.headSha)
      throw new AppError('Pull request changed; refresh before using its diff.', 'conflict');
    const repo = await this.repository(context.repositoryId);
    const { data } = await this.request<Json>(
      `${this.repoPath(repo)}/compare/${encodePath(detail.baseSha)}...${encodePath(detail.headSha)}`,
    );
    const mergeBaseSha = String(data.merge_base_commit?.sha ?? '');
    if (!mergeBaseSha)
      throw new AppError('GitHub did not provide the diff base revision.', 'provider-server');
    return { baseSha: mergeBaseSha, startSha: detail.baseSha, headSha: detail.headSha };
  }

  async listConversations(query: ConversationQuery): Promise<Page<ReviewConversation>> {
    const { repo, path } = await this.requestContext(query);
    const perPage = Math.min(PER_PAGE_MAX, Math.max(1, query.perPage ?? PER_PAGE_MAX));
    const [issues, reviews, comments] = await Promise.all([
      this.allPages<Json>(
        `${this.repoPath(repo)}/issues/${encodePath(query.reviewRequestId)}/comments`,
        perPage,
      ),
      this.allPages<Json>(`${path}/reviews`, perPage),
      this.allPages<Json>(`${path}/comments`, perPage),
    ]);
    let threadMap = new Map<
      number,
      { id: string; resolved?: boolean; canResolve?: boolean; canUnresolve?: boolean }
    >();
    try {
      threadMap = await this.reviewThreads(repo, query.reviewRequestId);
    } catch {
      /* Preserve REST conversations when GraphQL is unavailable; thread controls stay hidden. */
    }
    const conversations = groupGitHubConversations(issues.items, reviews.items, comments.items).map(
      (item) => {
        if (item.resourceType !== 'github-review-comment') return item;
        const thread = threadMap.get(Number(item.id));
        if (!thread) return item;
        return {
          ...item,
          threadId: thread.id,
          ...(thread.resolved === undefined ? {} : { resolved: thread.resolved }),
          ...(thread.canResolve === undefined ? {} : { canResolve: thread.canResolve }),
          ...(thread.canUnresolve === undefined ? {} : { canUnresolve: thread.canUnresolve }),
          replies: item.replies.map((reply) => ({ ...reply, threadId: thread.id })),
        };
      },
    );
    const page = Math.max(1, query.page ?? 1),
      start = (page - 1) * perPage;
    return {
      items: conversations.slice(start, start + perPage),
      page: pageInfo(
        page,
        perPage,
        start + perPage < conversations.length ||
          issues.capped ||
          reviews.capped ||
          comments.capped,
        conversations.length,
      ),
    };
  }

  async listMetadataOptions(query: MetadataOptionQuery) {
    const { repo } = await this.requestContext(query);
    const page = Math.max(1, query.page ?? 1),
      perPage = 50;
    const path =
      query.kind === 'labels'
        ? `${this.repoPath(repo)}/labels`
        : query.kind === 'assignees'
          ? `${this.repoPath(repo)}/assignees`
          : `${this.repoPath(repo)}/collaborators?affiliation=all`;
    const { items, capped } = await this.allPages<Json>(path, PER_PAGE_MAX, 2000);
    const normalized = items
      .filter((item) => query.kind !== 'labels' || item.name)
      .filter(
        (item) =>
          !query.search ||
          String(query.kind === 'labels' ? item.name : item.login)
            .toLowerCase()
            .includes(query.search.toLowerCase()),
      );
    const mapped: ProviderUser[] | string[] =
      query.kind === 'labels'
        ? normalized.map((item) => String(item.name))
        : normalized.map(mapGitHubUser);
    const start = (page - 1) * perPage;
    return {
      items: mapped.slice(start, start + perPage),
      page: pageInfo(
        page,
        perPage,
        start + perPage < mapped.length || capped,
        mapped.length,
        capped,
        capped,
      ),
    };
  }

  async updateMetadata(
    context: ReviewRequestContext,
    input: ReviewRequestMetadataInput,
  ): Promise<void> {
    const { repo, path } = await this.requestContext(context);
    const resolveLogins = async (kind: 'assignees' | 'reviewers', ids: string[]) => {
      if (!ids.length) return [];
      const endpoint =
        kind === 'assignees'
          ? `${this.repoPath(repo)}/assignees`
          : `${this.repoPath(repo)}/collaborators?affiliation=all`;
      const { items } = await this.allPages<Json>(endpoint, PER_PAGE_MAX, 2000);
      const users = new Map(items.map((user) => [String(user.id), String(user.login ?? '')]));
      return ids.map((id) => {
        const login = users.get(id);
        if (!login)
          throw new ValidationError(
            `Selected ${kind.slice(0, -1)} is no longer available`,
            `${kind}Ids`,
          );
        return login;
      });
    };
    let dispatched = false;
    try {
      if (input.title !== undefined || input.description !== undefined) {
        dispatched = true;
        await this.request(path, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { body: input.description }),
          }),
        });
      }
      if (input.assigneeIds !== undefined || input.labels !== undefined) {
        const assignees =
          input.assigneeIds === undefined
            ? undefined
            : await resolveLogins('assignees', input.assigneeIds);
        dispatched = true;
        await this.request(`${this.repoPath(repo)}/issues/${encodePath(context.reviewRequestId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(assignees === undefined ? {} : { assignees }),
            ...(input.labels === undefined ? {} : { labels: input.labels }),
          }),
        });
      }
      if (input.reviewerIds !== undefined) {
        const requestedLogins = await resolveLogins('reviewers', input.reviewerIds);
        const { data: current } = await this.request<Json>(`${path}/requested_reviewers`);
        const currentLogins = (Array.isArray(current.users) ? current.users : [])
          .map((user: Json) => String(user.login ?? ''))
          .filter(Boolean);
        const add = requestedLogins.filter((login) => !currentLogins.includes(login));
        const remove = currentLogins.filter((login) => !requestedLogins.includes(login));
        if (add.length) {
          dispatched = true;
          await this.request(`${path}/requested_reviewers`, {
            method: 'POST',
            body: JSON.stringify({ reviewers: add }),
          });
        }
        if (remove.length) {
          dispatched = true;
          await this.request(`${path}/requested_reviewers`, {
            method: 'DELETE',
            body: JSON.stringify({ reviewers: remove }),
          });
        }
      }
    } catch (error) {
      if (dispatched)
        throw new AppError(
          'GitHub metadata update may be partially applied; refresh before retrying.',
          'unknown',
          { cause: error },
        );
      throw error;
    }
  }

  async deleteComment(
    context: ReviewRequestContext,
    resourceType: ReviewConversation['resourceType'],
    conversationId: string,
    commentId?: string,
  ): Promise<void> {
    const { repo } = await this.requestContext(context);
    const id = commentId ?? conversationId;
    if (resourceType === 'github-issue-comment') {
      await this.request(`${this.repoPath(repo)}/issues/comments/${encodePath(id)}`, {
        method: 'DELETE',
      });
    } else if (resourceType === 'github-review-comment') {
      await this.request(`${this.repoPath(repo)}/pulls/comments/${encodePath(id)}`, {
        method: 'DELETE',
      });
    } else throw new UnsupportedCapabilityError('delete this comment');
  }

  async setConversationResolved(
    _context: ReviewRequestContext,
    threadId: string,
    resolved: boolean,
  ): Promise<void> {
    const field = resolved ? 'resolveReviewThread' : 'unresolveReviewThread';
    await this.graphql(
      `mutation($threadId:ID!){${field}(input:{threadId:$threadId}){thread{id isResolved}}}`,
      { threadId },
    );
  }

  async getFileContent(input: ReviewFileContentContext): Promise<string> {
    if (!input.diffVersion || !input.headSha || input.diffVersion.headSha !== input.headSha)
      throw new AppError('Displayed diff revision is unavailable; refresh the diff.', 'conflict');
    const version = await this.currentDiffVersion(input);
    if (!sameDiffVersion(version, input.diffVersion))
      throw new AppError(
        'Pull request head changed; refresh the diff before viewing file content.',
        'conflict',
      );
    const { repo } = await this.requestContext(input);
    const ref = input.side === 'new' ? version.headSha : version.baseSha;
    if (!ref)
      throw new AppError('GitHub did not provide an immutable base revision.', 'provider-server');
    const path = input.path.split('/').map(encodePath).join('/');
    const { data } = await this.request<Json>(
      `${this.repoPath(repo)}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (typeof data.size === 'number' && data.size > 1_000_000)
      throw new ValidationError('This file is too large to display as full content', 'path');
    if (data.encoding !== 'base64' || typeof data.content !== 'string')
      throw new AppError('GitHub did not return full file content.', 'provider-server');
    return Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
  }

  async listCommits(context: ReviewRequestContext, page?: number, perPage?: number) {
    const repository = await this.repository(context.repositoryId);
    return listGitHubCommits(this.http, this.connection, repository, context, page, perPage);
  }

  async createGeneralComment(input: CreateGeneralCommentInput): Promise<ReviewComment> {
    const { repo } = await this.requestContext(input);
    const { data } = await this.request<Json>(
      `${this.repoPath(repo)}/issues/${encodePath(input.reviewRequestId)}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.body }),
      },
    );
    return {
      id: String(data.id),
      provider: 'github',
      resourceType: 'github-issue-comment',
      body: String(data.body),
      author: mapGitHubUser(data.user),
      createdAt: String(data.created_at),
      ...(data.updated_at ? { updatedAt: String(data.updated_at) } : {}),
      ...(data.html_url ? { webUrl: String(data.html_url) } : {}),
    };
  }

  async createInlineComment(input: CreateInlineCommentInput): Promise<ReviewComment> {
    if (!input.headSha)
      throw new ValidationError('Current head SHA is required for an inline comment', 'headSha');
    if (!input.position.path || !Number.isInteger(input.position.line) || input.position.line < 1)
      throw new ValidationError('A valid diff path and line are required', 'position');
    const detail = await this.getReviewRequest(input.repositoryId, input.reviewRequestId);
    if (detail.headSha !== input.headSha)
      throw new AppError('Pull request head changed; refresh before commenting', 'conflict');
    const { path } = await this.requestContext(input);
    const { data } = await this.request<Json>(`${path}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: input.body,
        commit_id: input.headSha,
        path: input.position.path,
        line: input.position.line,
        side: input.position.side === 'old' ? 'LEFT' : 'RIGHT',
      }),
    });
    return mapGitHubReviewComment(data);
  }

  async replyToConversation(input: ReplyInput): Promise<ReviewComment> {
    if (input.parentCommentId)
      throw new UnsupportedCapabilityError(
        'reply-to-reply',
        'GitHub supports replies only to top-level review comments',
      );
    const { repo, path } = await this.requestContext(input);
    const { data: target } = await this.request<Json>(
      `${this.repoPath(repo)}/pulls/comments/${encodePath(input.conversationId)}`,
    );
    if (target.in_reply_to_id != null)
      throw new UnsupportedCapabilityError(
        'reply-to-reply',
        'GitHub supports replies only to top-level review comments',
      );
    const { data } = await this.request<Json>(
      `${path}/comments/${encodePath(input.conversationId)}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.body }),
      },
    );
    return mapGitHubReviewComment(data);
  }

  async getChecks(context: ReviewRequestContext): Promise<CheckSummary[]> {
    const detail = await this.getReviewRequest(context.repositoryId, context.reviewRequestId);
    const sha = context.headSha ?? detail.headSha;
    if (!sha) throw new ValidationError('Current pull request head SHA is unavailable', 'headSha');
    if (context.headSha && context.headSha !== detail.headSha)
      throw new AppError('Pull request head changed; refresh before loading checks', 'conflict');
    const { repo } = await this.requestContext(context);
    const path = this.repoPath(repo);
    const [checks, statuses, actions] = await Promise.all([
      this.allEnvelopePages<Json>(`${path}/commits/${encodePath(sha)}/check-runs`, 'check_runs'),
      this.allEnvelopePages<Json>(`${path}/commits/${encodePath(sha)}/status`, 'statuses'),
      this.allEnvelopePages<Json>(
        `${path}/actions/runs?head_sha=${encodeURIComponent(sha)}`,
        'workflow_runs',
      ),
    ]);
    return [
      ...checks.map((item) => mapGitHubCheck(item, 'check-run', sha)),
      ...statuses.map((item: Json) => mapGitHubCheck(item, 'status', sha)),
      ...actions.map((item) => mapGitHubCheck(item, 'action', sha)),
    ];
  }

  async getApprovalState(context: ReviewRequestContext): Promise<ApprovalState> {
    const detail = await this.getReviewRequest(context.repositoryId, context.reviewRequestId);
    if (!detail.headSha)
      throw new ValidationError('Current pull request head SHA is unavailable', 'headSha');
    if (context.headSha && context.headSha !== detail.headSha)
      throw new AppError('Pull request head changed; refresh before loading reviews', 'conflict');
    const { path } = await this.requestContext(context);
    const { items } = await this.allPages<Json>(`${path}/reviews`);
    const user = await this.getCurrentUser();
    return mapGitHubApprovalState(items, user.login, detail.headSha);
  }

  async submitReviewDecision(input: SubmitReviewDecisionInput): Promise<ReviewComment | void> {
    const detail = await this.getReviewRequest(input.repositoryId, input.reviewRequestId);
    if (!detail.headSha || input.headSha !== detail.headSha)
      throw new AppError(
        'Pull request head changed; refresh before submitting a review',
        'conflict',
      );
    const { path } = await this.requestContext(input);
    const event: Record<ReviewDecision, string> = {
      approve: 'APPROVE',
      'request-changes': 'REQUEST_CHANGES',
      comment: 'COMMENT',
    };
    const { data } = await this.request<Json>(`${path}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commit_id: detail.headSha,
        event: event[input.decision],
        ...(input.body ? { body: input.body } : {}),
      }),
    });
    if (!data?.id) return;
    return {
      id: String(data.id),
      provider: 'github',
      resourceType: 'github-review-comment',
      author: mapGitHubUser(data.user),
      body: String(data.body ?? ''),
      createdAt: String(data.submitted_at ?? data.created_at ?? ''),
    };
  }

  async merge(input: MergeInput): Promise<MergeResult> {
    const detail = await this.getReviewRequest(input.repositoryId, input.reviewRequestId);
    if (!detail.headSha || input.expectedHeadSha !== detail.headSha)
      throw new AppError(
        'Pull request head changed; refresh and confirm the merge again',
        'conflict',
      );
    const { repo, path } = await this.requestContext(input);
    const { data } = await this.request<Json>(`${path}/merge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: detail.headSha }),
    });
    return {
      merged: data.merged === true,
      ...(data.message ? { message: String(data.message) } : {}),
      ...(data.sha ? { mergeCommitSha: String(data.sha) } : {}),
      webUrl: detail.webUrl || repo.webUrl,
    };
  }

  getCapabilities(): ProviderCapabilityDescriptor {
    const supported = { support: 'supported' as const };
    const unsupported = { support: 'unsupported' as const };
    return {
      generalComments: supported,
      inlineComments: supported,
      replyByResource: {
        'github-issue-comment': unsupported,
        'github-review-comment': supported,
        'github-review': unsupported,
      },
      resolveThreads: {
        support: 'conditional',
        reason:
          'GitHub GraphQL permissions and repository policy determine whether threads can be resolved.',
      },
      checks: supported,
      approvals: { support: 'unknown' },
      reviewDecisions: supported,
      merge: supported,
      editMetadata: {
        support: 'conditional',
        reason: 'The user must have permission to update pull request metadata.',
      },
      commits: { support: 'supported' },
      deleteByResource: {
        'github-issue-comment': {
          support: 'conditional',
          reason: 'The user must own the comment and have permission to delete it.',
        },
        'github-review-comment': {
          support: 'conditional',
          reason: 'The user must own the comment and have permission to delete it.',
        },
        'github-review': unsupported,
      },
    };
  }
}

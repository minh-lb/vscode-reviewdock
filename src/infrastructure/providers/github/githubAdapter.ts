import type { ReviewProvider } from '../../../application/ports';
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
} from '../../../domain/models';
import { AppError, UnsupportedCapabilityError, ValidationError } from '../../../domain/errors';
import { ProviderHttpClient } from '../../http/providerHttpClient';
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
export class GitHubAdapter implements ReviewProvider {
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
    return {
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
    const conversations = groupGitHubConversations(issues.items, reviews.items, comments.items);
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
      resolveThreads: unsupported,
      checks: supported,
      approvals: { support: 'unknown' },
      reviewDecisions: supported,
      merge: supported,
    };
  }
}

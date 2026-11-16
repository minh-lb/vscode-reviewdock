import { AppError, UnsupportedCapabilityError, ValidationError } from '../../../domain/errors';
import type {
  ApprovalState,
  CheckSummary,
  Connection,
  DiffFilePage,
  DiffPosition,
  DiffVersion,
  Page,
  PageInfo,
  ProviderCapabilityDescriptor,
  ProviderUser,
  RepositoryRef,
  ReviewComment,
  ReviewConversation,
  ReviewRequestContext,
  ReviewRequestDetail,
  ReviewRequestQuery,
  ReviewRequestSummary,
  MetadataOptionQuery,
  ReviewRequestMetadataInput,
  ReviewFileContentContext,
  SubmitReviewDecisionInput,
} from '../../../domain/models';
import type {
  ReviewProvider,
  ReviewConversationManagement,
  ReviewRequestManagement,
  ReviewFileContentProvider,
  ReviewCommitProvider,
} from '../../../application/ports';
import { ProviderHttpClient } from '../../http/providerHttpClient';
import { listGitLabCommits } from '../reviewCommits';
import {
  mapGitLabComment,
  mapGitLabDiff,
  mapGitLabDiscussion,
  mapGitLabJob,
  mapGitLabPipeline,
  mapGitLabRepository,
  mapGitLabRequestDetail,
  mapGitLabRequestSummary,
  mapGitLabUser,
  mapGitLabVersion,
} from './gitlabMappers';

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' ? (value as Json) : {};
type Response<T> = { data: T; status: number; headers: Headers };

export interface GitLabPipelineJob {
  id: string;
  name: string;
  stage: string;
  status: string;
  allowFailure?: boolean;
  webUrl?: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
}

const param = (value: string) => encodeURIComponent(value);
const endpoint = (projectId: string, iid: string, suffix = '') =>
  `projects/${param(projectId)}/merge_requests/${param(iid)}${suffix}`;
const queryPath = (path: string, values: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) query.set(key, String(value));
  return `${path}?${query}`;
};
const pageInfo = <T>(response: Response<T[]>, page: number, perPage: number): PageInfo => {
  const next = response.headers.get('x-next-page');
  const rawTotal = response.headers.get('x-total');
  const total = rawTotal === null ? undefined : Number(rawTotal);
  const totalPagesHeader = response.headers.get('x-total-pages');
  const totalPages = totalPagesHeader === null ? undefined : Number(totalPagesHeader);
  const hasNextPage =
    (next !== null && next !== '' && Number.isSafeInteger(Number(next)) && Number(next) > page) ||
    (totalPages !== undefined && Number.isFinite(totalPages) && totalPages > page) ||
    (total !== undefined && Number.isFinite(total) && page * perPage < total);
  const invalidNext =
    next !== null && next !== '' && (!Number.isSafeInteger(Number(next)) || Number(next) <= page);
  const paginationKnown =
    (next !== null && !invalidNext) || totalPagesHeader !== null || rawTotal !== null;
  return {
    page,
    perPage,
    hasNextPage,
    ...(total !== undefined && Number.isFinite(total) && total >= 0 ? { totalCount: total } : {}),
    ...(response.data.length === perPage && !paginationKnown && !hasNextPage
      ? { incomplete: true }
      : {}),
  };
};
const nextPage = (
  response: Response<unknown[]>,
  page: number,
  perPage: number,
): number | undefined => {
  const next = response.headers.get('x-next-page');
  if (next) {
    const parsed = Number(next);
    if (!Number.isSafeInteger(parsed) || parsed <= page)
      throw new AppError(
        `GitLab returned a non-forward pagination cursor at page ${page}`,
        'provider-server',
      );
    return parsed;
  }
  const pagesHeader = response.headers.get('x-total-pages');
  if (pagesHeader !== null && Number(pagesHeader) > page) return page + 1;
  const totalHeader = response.headers.get('x-total');
  if (totalHeader !== null && Number(totalHeader) > page * perPage) return page + 1;
  return undefined;
};
const assertPaginationCanFinish = (
  response: Response<unknown[]>,
  page: number,
  perPage: number,
  next: number | undefined,
) => {
  if (next !== undefined) return;
  if (
    response.data.length === perPage &&
    response.headers.get('x-next-page') === null &&
    response.headers.get('x-total-pages') === null &&
    response.headers.get('x-total') === null
  ) {
    throw new AppError(
      `GitLab returned a full page without pagination metadata at page ${page}`,
      'provider-server',
    );
  }
};
const MAX_PAGINATION_PAGES = 1000;
const normalizedPage = (page?: number, perPage?: number) => ({
  page: Number.isSafeInteger(page) && page! > 0 ? page! : 1,
  perPage: Number.isSafeInteger(perPage) && perPage! > 0 ? Math.min(perPage!, 100) : 20,
});
const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);
const form = (fields: Record<string, string | number | undefined>): URLSearchParams => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) body.set(key, String(value));
  return body;
};
const sameDiffVersion = (left: DiffVersion, right: DiffVersion) =>
  left.baseSha === right.baseSha &&
  left.startSha === right.startSha &&
  left.headSha === right.headSha;
const notFoundFeature = (error: unknown): boolean =>
  error instanceof AppError &&
  (error.code === 'not-found' || error.code === 'operation-not-allowed');

export class GitLabAdapter
  implements
    ReviewProvider,
    ReviewConversationManagement,
    ReviewRequestManagement,
    ReviewFileContentProvider,
    ReviewCommitProvider
{
  readonly provider = 'gitlab' as const;

  constructor(
    private readonly connection: Connection,
    private readonly http: ProviderHttpClient,
  ) {
    if (connection.provider !== 'gitlab')
      throw new ValidationError('GitLabAdapter requires a GitLab connection');
  }

  async getCurrentUser(): Promise<ProviderUser> {
    const { data } = await this.http.request<Json>(this.connection, 'user');
    return mapGitLabUser(data);
  }

  async listRepositories(query: {
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<Page<RepositoryRef>> {
    const { page, perPage } = normalizedPage(query.page, query.perPage);
    const path = queryPath('projects', {
      membership: true,
      search: query.search,
      simple: true,
      page,
      per_page: perPage,
    });
    const response = await this.http.request<Json[]>(this.connection, path);
    return {
      items: asArray<Json>(response.data).map((raw) =>
        mapGitLabRepository(raw, this.connection.serverUrl),
      ),
      page: pageInfo(response, page, perPage),
    };
  }

  async getRepository(repositoryId: string): Promise<RepositoryRef> {
    const { data } = await this.http.request<Json>(
      this.connection,
      `projects/${param(repositoryId)}`,
    );
    return mapGitLabRepository(data, this.connection.serverUrl);
  }

  async listReviewRequests(query: ReviewRequestQuery): Promise<Page<ReviewRequestSummary>> {
    const { page, perPage } = normalizedPage(query.page, query.perPage);
    const filter = query.filter ?? 'open';
    const states: Record<string, string> = {
      open: 'opened',
      closed: 'closed',
      merged: 'merged',
      all: 'all',
    };
    const scopes: Record<string, string> = {
      'created-by-me': 'created_by_me',
      'assigned-to-me': 'assigned_to_me',
      'review-requested-from-me': 'reviews_for_me',
    };
    const path = queryPath(`projects/${param(query.repositoryId)}/merge_requests`, {
      state: states[filter] ?? 'opened',
      scope: scopes[filter] ?? 'all',
      order_by: 'updated_at',
      sort: 'desc',
      search: query.search,
      in: query.search ? 'title,description' : undefined,
      page,
      per_page: perPage,
    });
    const response = await this.http.request<Json[]>(this.connection, path);
    return {
      items: asArray<Json>(response.data).map((raw) =>
        mapGitLabRequestSummary(raw, query.repositoryId),
      ),
      page: pageInfo(response, page, perPage),
    };
  }

  async getReviewRequest(
    repositoryId: string,
    reviewRequestId: string,
  ): Promise<ReviewRequestDetail> {
    const { data } = await this.http.request<Json>(
      this.connection,
      endpoint(repositoryId, reviewRequestId),
    );
    return mapGitLabRequestDetail(data, repositoryId);
  }

  async getLatestDiffVersion(
    repositoryId: string,
    reviewRequestId: string,
  ): Promise<DiffVersion | undefined> {
    const versionsPath = queryPath(endpoint(repositoryId, reviewRequestId, '/versions'), {
      page: 1,
      per_page: 1,
    });
    try {
      const { data } = await this.http.request<Json[]>(this.connection, versionsPath);
      const version = asArray<Json>(data)[0];
      return version ? mapGitLabVersion(version) : undefined;
    } catch (error) {
      if (notFoundFeature(error)) return undefined;
      throw error;
    }
  }

  async listChangedFiles(
    context: ReviewRequestContext,
    page = 1,
    perPage = 20,
  ): Promise<DiffFilePage> {
    const latest = await this.getLatestDiffVersion(context.repositoryId, context.reviewRequestId);
    const { data, headers } = await this.http.request<Json[]>(
      this.connection,
      queryPath(endpoint(context.repositoryId, context.reviewRequestId, '/diffs'), {
        page,
        per_page: perPage,
        unidiff: true,
      }),
    );
    const responseData = data as unknown;
    let overflow = false;
    let files = asArray<Json>(responseData);
    if (!Array.isArray(responseData) && responseData && typeof responseData === 'object') {
      const object = responseData as Json;
      files = asArray<Json>(object.diffs);
      overflow = object.overflow === true;
    }
    if (files.some((file) => file.collapsed === true) && latest?.id) {
      const version = await this.http.request<Json>(
        this.connection,
        queryPath(
          endpoint(context.repositoryId, context.reviewRequestId, `/versions/${param(latest.id)}`),
          { unidiff: true },
        ),
      );
      const fullDiffs = asArray<Json>(object(version.data).diffs);
      const byPath = new Map(fullDiffs.map((file) => [`${file.old_path}\0${file.new_path}`, file]));
      files = files.map((file) => {
        if (file.collapsed !== true || file.too_large === true) return file;
        const expanded = byPath.get(`${file.old_path}\0${file.new_path}`);
        return expanded && typeof expanded.diff === 'string'
          ? { ...expanded, collapsed: false }
          : file;
      });
    }
    const response = { data: files, headers, status: 200 };
    return {
      items: files.map(mapGitLabDiff),
      page: pageInfo(response, page, perPage),
      ...(latest ? { diffVersion: latest } : {}),
      ...(overflow || files.some((file) => file.overflow === true) ? { truncated: true } : {}),
    };
  }

  async listConversations(query: {
    repositoryId: string;
    reviewRequestId: string;
    page?: number;
    perPage?: number;
  }): Promise<Page<ReviewConversation>> {
    const page = query.page ?? 1,
      perPage = query.perPage ?? 20;
    const response = await this.http.request<Json[]>(
      this.connection,
      queryPath(endpoint(query.repositoryId, query.reviewRequestId, '/discussions'), {
        page,
        per_page: perPage,
      }),
    );
    return {
      items: asArray<Json>(response.data).map(mapGitLabDiscussion),
      page: pageInfo(response, page, perPage),
    };
  }

  async createGeneralComment(input: {
    repositoryId: string;
    reviewRequestId: string;
    body: string;
  }): Promise<ReviewComment> {
    const { data } = await this.http.request<Json>(
      this.connection,
      endpoint(input.repositoryId, input.reviewRequestId, '/discussions'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ body: input.body }),
      },
    );
    const discussionId = String(data.id ?? '');
    const note = asArray<Json>(data.notes)[0];
    if (!discussionId || !note)
      throw new AppError('GitLab returned an incomplete discussion response', 'provider-server');
    return mapGitLabComment(note, discussionId);
  }

  async createInlineComment(input: {
    repositoryId: string;
    reviewRequestId: string;
    body: string;
    position: DiffPosition;
    diffVersion?: DiffVersion;
  }): Promise<ReviewComment> {
    const version = input.diffVersion;
    if (!version?.baseSha || !version.startSha || !version.headSha)
      throw new ValidationError('Inline comment requires a complete current GitLab diff version');
    const position = input.position;
    const oldPath = position.oldPath ?? position.path;
    const newPath = position.newPath ?? position.path;
    if (!oldPath || !newPath || !Number.isInteger(position.line) || position.line < 1)
      throw new ValidationError('Inline comment position is incomplete');
    if ((position.oldPath || position.newPath) && (!position.oldPath || !position.newPath))
      throw new ValidationError('Both GitLab paths are required for a renamed file');
    const oldLine = position.oldLine ?? (position.side === 'old' ? position.line : undefined);
    const newLine = position.newLine ?? (position.side === 'new' ? position.line : undefined);
    if (!oldLine && !newLine) throw new ValidationError('Inline comment position has no diff line');
    const { data } = await this.http.request<Json>(
      this.connection,
      endpoint(input.repositoryId, input.reviewRequestId, '/discussions'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({
          body: input.body,
          'position[position_type]': 'text',
          'position[base_sha]': version.baseSha,
          'position[start_sha]': version.startSha,
          'position[head_sha]': version.headSha,
          'position[old_path]': oldPath,
          'position[new_path]': newPath,
          'position[old_line]': oldLine,
          'position[new_line]': newLine,
        }),
      },
    );
    const discussionId = String(data.id ?? '');
    const note = asArray<Json>(data.notes)[0];
    if (!discussionId || !note)
      throw new AppError(
        'GitLab returned an incomplete inline discussion response',
        'provider-server',
      );
    return mapGitLabComment(note, discussionId);
  }

  async replyToConversation(input: {
    repositoryId: string;
    reviewRequestId: string;
    conversationId: string;
    parentCommentId?: string;
    body: string;
  }): Promise<ReviewComment> {
    const discussion = param(input.conversationId);
    const { data } = await this.http.request<Json>(
      this.connection,
      endpoint(input.repositoryId, input.reviewRequestId, `/discussions/${discussion}/notes`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ body: input.body }),
      },
    );
    return mapGitLabComment(data, input.conversationId);
  }

  async setConversationResolved(
    context: ReviewRequestContext,
    conversationId: string,
    resolved: boolean,
  ): Promise<void> {
    await this.http.request(
      this.connection,
      endpoint(
        context.repositoryId,
        context.reviewRequestId,
        `/discussions/${param(conversationId)}`,
      ),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ resolved: String(resolved) }),
      },
    );
  }

  async listMetadataOptions(query: MetadataOptionQuery) {
    const { page, perPage } = normalizedPage(query.page, 50);
    const labels = query.kind === 'labels';
    const path = labels
      ? queryPath(`projects/${param(query.repositoryId)}/labels`, {
          search: query.search,
          page,
          per_page: perPage,
        })
      : queryPath(`projects/${param(query.repositoryId)}/members/all`, {
          query: query.search,
          page,
          per_page: perPage,
        });
    const response = await this.http.request<Json[]>(this.connection, path);
    const items = asArray<Json>(response.data);
    return {
      items: labels ? items.map((item) => String(item.name ?? '')) : items.map(mapGitLabUser),
      page: pageInfo(response, page, perPage),
    };
  }

  async updateMetadata(
    context: ReviewRequestContext,
    input: ReviewRequestMetadataInput,
  ): Promise<void> {
    await this.http.request(
      this.connection,
      endpoint(context.repositoryId, context.reviewRequestId),
      {
        method: 'PUT',
        body: JSON.stringify({
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.assigneeIds === undefined
            ? {}
            : { assignee_ids: input.assigneeIds.map(Number) }),
          ...(input.reviewerIds === undefined
            ? {}
            : { reviewer_ids: input.reviewerIds.map(Number) }),
          ...(input.labels === undefined ? {} : { labels: input.labels.join(',') }),
        }),
      },
    );
  }

  async deleteComment(
    context: ReviewRequestContext,
    resourceType: ReviewConversation['resourceType'],
    conversationId: string,
    commentId?: string,
  ): Promise<void> {
    if (resourceType !== 'gitlab-discussion' || !commentId)
      throw new UnsupportedCapabilityError('delete this comment');
    await this.http.request(
      this.connection,
      endpoint(
        context.repositoryId,
        context.reviewRequestId,
        `/discussions/${param(conversationId)}/notes/${param(commentId)}`,
      ),
      { method: 'DELETE' },
    );
  }

  async getFileContent(input: ReviewFileContentContext): Promise<string> {
    const version = await this.getLatestDiffVersion(input.repositoryId, input.reviewRequestId);
    if (
      !version ||
      !input.diffVersion ||
      !sameDiffVersion(version, input.diffVersion) ||
      (input.headSha && input.headSha !== version.headSha)
    )
      throw new AppError(
        'Merge request diff changed; refresh before viewing full file content.',
        'conflict',
      );
    const ref = input.side === 'old' ? version.baseSha : version.headSha;
    const { data } = await this.http.request<string>(
      this.connection,
      queryPath(`projects/${param(input.repositoryId)}/repository/files/${param(input.path)}/raw`, {
        ref,
      }),
      { responseText: true },
    );
    if (Buffer.byteLength(data, 'utf8') > 1_000_000)
      throw new ValidationError('This file is too large to display as full content', 'path');
    return data;
  }

  async listCommits(context: ReviewRequestContext, page?: number, perPage?: number) {
    return listGitLabCommits(this.http, this.connection, context, page, perPage);
  }

  async getChecks(context: ReviewRequestContext): Promise<CheckSummary[]> {
    const result: CheckSummary[] = [];
    const currentHeadPipelines: Json[] = [];
    let page = 1;
    let pagesRead = 0;
    for (;;) {
      let response: Response<Json[]>;
      try {
        response = await this.http.request<Json[]>(
          this.connection,
          queryPath(endpoint(context.repositoryId, context.reviewRequestId, '/pipelines'), {
            page,
            per_page: 100,
          }),
        );
      } catch (error) {
        if (notFoundFeature(error))
          throw new UnsupportedCapabilityError(
            'GitLab MR pipelines',
            'This GitLab instance does not expose the merge request pipelines endpoint',
          );
        throw error;
      }
      for (const pipeline of asArray<Json>(response.data)) {
        const check = mapGitLabPipeline(pipeline, context.headSha);
        if (check) result.push(check);
        if (
          context.headSha &&
          String(pipeline.sha ?? '') === context.headSha &&
          pipeline.id != null
        )
          currentHeadPipelines.push(pipeline);
      }
      pagesRead += 1;
      const upcoming = nextPage(response, page, 100);
      assertPaginationCanFinish(response, page, 100, upcoming);
      if (upcoming === undefined) break;
      if (pagesRead >= MAX_PAGINATION_PAGES)
        throw new AppError(
          'GitLab pipeline pagination exceeded the safety limit',
          'provider-server',
        );
      page = upcoming;
    }
    if (context.headSha && currentHeadPipelines.length) {
      const headSha = context.headSha;
      const latest = currentHeadPipelines.reduce((selected, candidate) => {
        const selectedAt = Date.parse(String(selected.created_at ?? ''));
        const candidateAt = Date.parse(String(candidate.created_at ?? ''));
        if (
          Number.isFinite(candidateAt) &&
          (!Number.isFinite(selectedAt) || candidateAt > selectedAt)
        )
          return candidate;
        if (Number.isFinite(selectedAt) && candidateAt < selectedAt) return selected;
        return Number(candidate.id) > Number(selected.id) ? candidate : selected;
      });
      const pipelineId = String(latest.id);
      let jobs: GitLabPipelineJob[];
      try {
        jobs = await this.listAllPipelineJobs(context.repositoryId, pipelineId);
      } catch (error) {
        if (notFoundFeature(error))
          throw new UnsupportedCapabilityError(
            'GitLab pipeline jobs',
            'This GitLab instance does not expose the pipeline jobs endpoint',
          );
        throw error;
      }
      result.push(...jobs.map((job) => mapGitLabJob(job, pipelineId, headSha)));
    }
    return result;
  }

  async listAllPipelineJobs(
    repositoryId: string,
    pipelineId: string,
  ): Promise<GitLabPipelineJob[]> {
    const result: GitLabPipelineJob[] = [];
    let page = 1,
      pagesRead = 0;
    for (;;) {
      const response = await this.fetchPipelineJobs(repositoryId, pipelineId, page, 100);
      result.push(...this.mapPipelineJobs(response.data));
      pagesRead += 1;
      const upcoming = nextPage(response, page, 100);
      assertPaginationCanFinish(response, page, 100, upcoming);
      if (upcoming === undefined) break;
      if (pagesRead >= MAX_PAGINATION_PAGES)
        throw new AppError('GitLab job pagination exceeded the safety limit', 'provider-server');
      page = upcoming;
    }
    return result;
  }

  async listPipelineJobs(
    repositoryId: string,
    pipelineId: string,
    page = 1,
    perPage = 20,
  ): Promise<Page<GitLabPipelineJob>> {
    ({ page, perPage } = normalizedPage(page, perPage));
    const response = await this.fetchPipelineJobs(repositoryId, pipelineId, page, perPage);
    return { items: this.mapPipelineJobs(response.data), page: pageInfo(response, page, perPage) };
  }

  private fetchPipelineJobs(
    repositoryId: string,
    pipelineId: string,
    page: number,
    perPage: number,
  ): Promise<Response<Json[]>> {
    const path = queryPath(`projects/${param(repositoryId)}/pipelines/${param(pipelineId)}/jobs`, {
      page,
      per_page: perPage,
    });
    return this.http.request<Json[]>(this.connection, path);
  }

  private mapPipelineJobs(data: unknown): GitLabPipelineJob[] {
    return asArray<Json>(data).map((job) => ({
      id: String(job.id),
      name: String(job.name ?? ''),
      stage: String(job.stage ?? ''),
      status: String(job.status ?? 'unknown'),
      ...(typeof job.allow_failure === 'boolean' ? { allowFailure: job.allow_failure } : {}),
      ...(job.web_url ? { webUrl: String(job.web_url) } : {}),
      ...(job.started_at ? { startedAt: String(job.started_at) } : {}),
      ...(job.finished_at ? { finishedAt: String(job.finished_at) } : {}),
      ...(typeof job.duration === 'number' && Number.isFinite(job.duration)
        ? { duration: job.duration }
        : {}),
    }));
  }

  async getApprovalState(context: ReviewRequestContext): Promise<ApprovalState> {
    const { data } = await this.http.request<Json>(
      this.connection,
      endpoint(context.repositoryId, context.reviewRequestId, '/approvals'),
    );
    return {
      available: true,
      ...(typeof data.approved === 'boolean' ? { approved: data.approved } : {}),
      ...(typeof data.user_can_approve === 'boolean'
        ? { userCanApprove: data.user_can_approve }
        : {}),
      ...(typeof data.user_has_approved === 'boolean'
        ? { userHasApproved: data.user_has_approved }
        : {}),
      ...(Array.isArray(data.approved_by)
        ? {
            approvedBy: data.approved_by.map((entry) =>
              mapGitLabUser(object(entry).user ? object(object(entry).user) : object(entry)),
            ),
          }
        : {}),
      ...(typeof data.approvals_required === 'number' && Number.isFinite(data.approvals_required)
        ? { requiredApprovals: data.approvals_required }
        : {}),
      ...(typeof data.approvals_left === 'number' && Number.isFinite(data.approvals_left)
        ? { approvalsLeft: data.approvals_left }
        : {}),
    };
  }

  async getDetailedApprovalState(context: ReviewRequestContext): Promise<Json | undefined> {
    try {
      const { data } = await this.http.request<Json>(
        this.connection,
        endpoint(context.repositoryId, context.reviewRequestId, '/approval_state'),
      );
      return data;
    } catch (error) {
      if (notFoundFeature(error)) return undefined;
      throw error;
    }
  }

  async submitReviewDecision(input: SubmitReviewDecisionInput): Promise<ReviewComment | void> {
    if (input.decision !== 'approve')
      throw new UnsupportedCapabilityError(
        'GitLab review decision',
        'GitLab supports approval, but not GitHub-style comment or request-changes review submissions',
      );
    const sha = input.headSha;
    if (!sha) throw new ValidationError('GitLab approval requires the current source HEAD SHA');
    await this.http.request(
      this.connection,
      endpoint(input.repositoryId, input.reviewRequestId, '/approve'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ sha }),
      },
    );
  }

  async merge(input: {
    repositoryId: string;
    reviewRequestId: string;
    expectedHeadSha: string;
  }): Promise<{ merged: boolean; message?: string; mergeCommitSha?: string; webUrl?: string }> {
    if (!input.expectedHeadSha)
      throw new ValidationError('GitLab merge requires the current source HEAD SHA');
    const { data } = await this.http.request<Json>(
      this.connection,
      endpoint(input.repositoryId, input.reviewRequestId, '/merge'),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: input.expectedHeadSha }),
      },
    );
    return {
      merged: data.state === 'merged' || data.merged_at != null,
      ...(data.merge_error ? { message: String(data.merge_error) } : {}),
      ...(data.merge_commit_sha ? { mergeCommitSha: String(data.merge_commit_sha) } : {}),
      ...(data.web_url ? { webUrl: String(data.web_url) } : {}),
    };
  }

  getCapabilities(): ProviderCapabilityDescriptor {
    const cap = (
      support: ProviderCapabilityDescriptor['generalComments']['support'],
      reason?: string,
    ) => ({ support, ...(reason ? { reason } : {}) });
    return {
      generalComments: cap('supported'),
      inlineComments: cap('supported'),
      replyByResource: { 'gitlab-discussion': cap('supported') },
      resolveThreads: cap(
        'conditional',
        'GitLab permissions and instance policy determine whether discussions can be resolved',
      ),
      checks: cap(
        'conditional',
        'Pipeline endpoint availability and project CI configuration are instance/project dependent',
      ),
      approvals: cap(
        'conditional',
        'Approval rules and detailed state vary by GitLab edition and permissions',
      ),
      reviewDecisions: cap(
        'conditional',
        'GitLab supports approve; request-changes and review-submission comments are unsupported',
      ),
      merge: cap('supported'),
      editMetadata: cap(
        'conditional',
        'The user must have permission to update this merge request.',
      ),
      commits: cap('supported'),
      deleteByResource: {
        'gitlab-discussion': cap(
          'conditional',
          'The user must own the note and have permission to delete it.',
        ),
      },
    };
  }
}

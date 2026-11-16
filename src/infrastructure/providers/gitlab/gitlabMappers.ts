import type {
  CheckSummary,
  DiffFile,
  DiffPosition,
  DiffVersion,
  ProviderUser,
  RepositoryRef,
  ReviewComment,
  ReviewConversation,
  ReviewRequestDetail,
  ReviewRequestSummary,
} from '../../../domain/models';

type Json = Record<string, unknown>;
const str = (value: unknown): string => (value == null ? '' : String(value));
const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' ? (value as Json) : {};

export function mapGitLabUser(raw: Json | null | undefined): ProviderUser {
  return {
    id: str(raw?.id),
    login: str(raw?.username),
    ...(raw?.name ? { name: str(raw.name) } : {}),
    ...(raw?.avatar_url ? { avatarUrl: str(raw.avatar_url) } : {}),
    ...(raw?.web_url ? { webUrl: str(raw.web_url) } : {}),
  };
}

export function mapGitLabRepository(raw: Json, serverUrl: string): RepositoryRef {
  const namespace = object(raw.namespace);
  const fullName = str(raw.path_with_namespace || raw.path || raw.name);
  return {
    id: str(raw.id),
    provider: 'gitlab',
    serverUrl,
    name: str(raw.name),
    fullName,
    owner: str(namespace.full_path || namespace.name || fullName.split('/').slice(0, -1).join('/')),
    ...(typeof raw.visibility === 'string' ? { private: raw.visibility === 'private' } : {}),
    ...(typeof raw.archived === 'boolean' ? { archived: raw.archived } : {}),
    ...(raw.default_branch ? { defaultBranch: str(raw.default_branch) } : {}),
    webUrl: str(raw.web_url),
  };
}

export function mapGitLabRequestSummary(raw: Json, repositoryId: string): ReviewRequestSummary {
  const state =
    raw.state === 'merged'
      ? 'merged'
      : raw.state === 'closed'
        ? 'closed'
        : raw.state === 'opened'
          ? 'open'
          : 'unknown';
  return {
    id: str(raw.id),
    number: str(raw.iid),
    repositoryId,
    provider: 'gitlab',
    title: str(raw.title),
    state,
    author: mapGitLabUser(object(raw.author)),
    sourceBranch: str(raw.source_branch),
    targetBranch: str(raw.target_branch),
    ...(typeof raw.draft === 'boolean'
      ? { draft: raw.draft }
      : typeof raw.work_in_progress === 'boolean'
        ? { draft: raw.work_in_progress }
        : {}),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
    webUrl: str(raw.web_url),
    ...(Array.isArray(raw.labels) ? { labels: raw.labels.map(str) } : {}),
  };
}

export function mapGitLabRequestDetail(raw: Json, repositoryId: string): ReviewRequestDetail {
  const summary = mapGitLabRequestSummary(raw, repositoryId);
  return {
    ...summary,
    ...(raw.description != null ? { description: str(raw.description) } : {}),
    ...(raw.sha
      ? { headSha: str(raw.sha) }
      : object(raw.diff_refs).head_sha
        ? { headSha: str(object(raw.diff_refs).head_sha) }
        : {}),
    ...(object(raw.diff_refs).base_sha ? { baseSha: str(object(raw.diff_refs).base_sha) } : {}),
    ...(typeof raw.mergeable === 'boolean' || raw.mergeable === null
      ? { mergeable: raw.mergeable }
      : {}),
    ...(raw.detailed_merge_status ? { mergeStatus: str(raw.detailed_merge_status) } : {}),
    ...(typeof raw.changes_count === 'number' ? { changedFiles: raw.changes_count } : {}),
    ...(Array.isArray(raw.assignees) ? { assignees: raw.assignees.map(mapGitLabUser) } : {}),
    ...(Array.isArray(raw.reviewers) ? { reviewers: raw.reviewers.map(mapGitLabUser) } : {}),
    ...(raw.closed_at ? { closedAt: str(raw.closed_at) } : {}),
    ...(raw.merged_at ? { mergedAt: str(raw.merged_at) } : {}),
  };
}

export function mapGitLabDiff(raw: Json): DiffFile {
  const diff = typeof raw.diff === 'string' ? raw.diff : undefined;
  const binary = diff?.includes('Binary files ') || diff?.includes('GIT binary patch') || undefined;
  const change: DiffFile['change'] = raw.new_file
    ? 'added'
    : raw.deleted_file
      ? 'removed'
      : raw.renamed_file
        ? 'renamed'
        : diff === undefined
          ? 'unknown'
          : 'modified';
  return {
    path: str(raw.new_path || raw.old_path),
    ...(raw.old_path && raw.old_path !== raw.new_path ? { previousPath: str(raw.old_path) } : {}),
    change,
    ...(diff !== undefined ? { patch: diff } : {}),
    ...(typeof raw.collapsed === 'boolean' ? { collapsed: raw.collapsed } : {}),
    ...(typeof raw.too_large === 'boolean' ? { tooLarge: raw.too_large } : {}),
    ...(binary ? { binary: true } : {}),
  };
}

function mapPosition(raw: Json): DiffPosition | undefined {
  const position = object(raw.position);
  if (position?.position_type !== 'text') return undefined;
  const oldLine =
    typeof position.old_line === 'number' && Number.isInteger(position.old_line)
      ? position.old_line
      : undefined;
  const newLine =
    typeof position.new_line === 'number' && Number.isInteger(position.new_line)
      ? position.new_line
      : undefined;
  const line = newLine ?? oldLine;
  const path = str(position.new_path || position.old_path);
  if (!line || !path) return undefined;
  return {
    path,
    side: newLine === undefined ? 'old' : 'new',
    line,
    ...(oldLine !== undefined ? { oldLine } : {}),
    ...(newLine !== undefined ? { newLine } : {}),
    ...(position.old_path ? { oldPath: str(position.old_path) } : {}),
    ...(position.new_path ? { newPath: str(position.new_path) } : {}),
  };
}

export function mapGitLabComment(raw: Json, discussionId: string): ReviewComment {
  const mappedPosition = mapPosition(raw);
  return {
    id: str(raw.id),
    provider: 'gitlab',
    resourceType: 'gitlab-discussion',
    threadId: discussionId,
    author: mapGitLabUser(object(raw.author)),
    body: str(raw.body),
    createdAt: str(raw.created_at),
    ...(raw.updated_at ? { updatedAt: str(raw.updated_at) } : {}),
    ...(raw.web_url ? { webUrl: str(raw.web_url) } : {}),
    ...(raw.system === true ? { systemNote: true } : {}),
    ...(mappedPosition ? { position: mappedPosition } : {}),
  };
}

export function mapGitLabDiscussion(raw: Json): ReviewConversation {
  const notes: Json[] = Array.isArray(raw.notes) ? raw.notes : [];
  const root = notes[0] ?? {};
  const rootComment = mapGitLabComment(root, str(raw.id));
  return {
    ...rootComment,
    id: str(raw.id),
    ...(root.id == null ? {} : { rootCommentId: str(root.id) }),
    threadId: str(raw.id),
    resolved: typeof raw.resolved === 'boolean' ? raw.resolved : null,
    ...(root.system === true ? { systemNote: true } : {}),
    replies: notes.slice(1).map((note) => mapGitLabComment(note, str(raw.id))),
  };
}

export function mapGitLabVersion(raw: Json): DiffVersion | undefined {
  const baseSha = str(raw.base_commit_sha),
    startSha = str(raw.start_commit_sha),
    headSha = str(raw.head_commit_sha);
  if (!baseSha || !startSha || !headSha) return undefined;
  return { ...(raw.id != null ? { id: str(raw.id) } : {}), baseSha, startSha, headSha };
}

export function mapGitLabPipeline(raw: Json, expectedHeadSha?: string): CheckSummary | undefined {
  const sha = raw.sha == null ? undefined : str(raw.sha);
  if (expectedHeadSha && sha !== expectedHeadSha) return undefined;
  const status =
    raw.status === 'success' ||
    raw.status === 'failed' ||
    raw.status === 'canceled' ||
    raw.status === 'skipped' ||
    raw.status === 'manual'
      ? 'completed'
      : raw.status === 'running'
        ? 'in_progress'
        : raw.status === 'created' ||
            raw.status === 'pending' ||
            raw.status === 'preparing' ||
            raw.status === 'waiting_for_resource'
          ? 'queued'
          : 'unknown';
  const conclusion =
    raw.status === 'success'
      ? 'success'
      : raw.status === 'failed'
        ? 'failure'
        : raw.status === 'canceled'
          ? 'cancelled'
          : raw.status === 'skipped'
            ? 'skipped'
            : undefined;
  return {
    id: `pipeline:${str(raw.id)}`,
    source: 'pipeline',
    name: str(raw.ref || raw.name || `Pipeline ${raw.id}`),
    status,
    ...(sha ? { headSha: sha } : {}),
    ...(conclusion ? { conclusion } : {}),
    ...(raw.web_url ? { detailsUrl: str(raw.web_url) } : {}),
    ...(raw.created_at ? { startedAt: str(raw.created_at) } : {}),
    ...(raw.updated_at ? { completedAt: str(raw.updated_at) } : {}),
  };
}

export function mapGitLabJob(
  job: {
    id: string;
    name: string;
    stage: string;
    status: string;
    webUrl?: string;
    startedAt?: string;
    finishedAt?: string;
  },
  pipelineId: string,
  headSha: string,
): CheckSummary {
  const status =
    job.status === 'success' ||
    job.status === 'failed' ||
    job.status === 'canceled' ||
    job.status === 'skipped' ||
    job.status === 'manual'
      ? 'completed'
      : job.status === 'running'
        ? 'in_progress'
        : job.status === 'created' ||
            job.status === 'pending' ||
            job.status === 'preparing' ||
            job.status === 'waiting_for_resource'
          ? 'queued'
          : 'unknown';
  const conclusion =
    job.status === 'success'
      ? 'success'
      : job.status === 'failed'
        ? 'failure'
        : job.status === 'canceled'
          ? 'cancelled'
          : job.status === 'skipped'
            ? 'skipped'
            : job.status === 'manual'
              ? 'action_required'
              : undefined;
  return {
    id: `job:${pipelineId}:${job.id}`,
    source: 'job',
    headSha,
    name: job.stage ? `${job.stage}: ${job.name}` : job.name,
    status,
    ...(conclusion ? { conclusion } : {}),
    ...(job.webUrl ? { detailsUrl: job.webUrl } : {}),
    ...(job.startedAt ? { startedAt: job.startedAt } : {}),
    ...(job.finishedAt ? { completedAt: job.finishedAt } : {}),
  };
}

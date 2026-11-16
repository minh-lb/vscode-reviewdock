import type {
  ApprovalState,
  CheckSummary,
  DiffFile,
  ProviderUser,
  RepositoryRef,
  ReviewComment,
  ReviewConversation,
  ReviewRequestDetail,
  ReviewRequestSummary,
} from '../../../domain/models';

// GitHub's response DTOs are endpoint-specific and optional; keep raw provider shapes at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const str = (value: unknown): string => (value == null ? '' : String(value));

export function mapGitHubUser(raw: Json | null | undefined): ProviderUser {
  return {
    id: str(raw?.id),
    login: str(raw?.login),
    ...(raw?.name ? { name: str(raw.name) } : {}),
    ...(raw?.avatar_url ? { avatarUrl: str(raw.avatar_url) } : {}),
    ...(raw?.html_url ? { webUrl: str(raw.html_url) } : {}),
  };
}

export function mapGitHubRepository(
  raw: Json,
  serverUrl: string,
  connectionId?: string,
): RepositoryRef {
  return {
    id: str(raw.id),
    provider: 'github',
    ...(connectionId ? { connectionId } : {}),
    serverUrl,
    name: str(raw.name),
    fullName: str(raw.full_name),
    owner: str(raw.owner?.login),
    ...(typeof raw.private === 'boolean' ? { private: raw.private } : {}),
    ...(typeof raw.archived === 'boolean' ? { archived: raw.archived } : {}),
    ...(raw.default_branch ? { defaultBranch: str(raw.default_branch) } : {}),
    webUrl: str(raw.html_url),
  };
}

function requestState(raw: Json): 'open' | 'closed' | 'merged' | 'unknown' {
  if (raw.merged === true || raw.merged_at != null) return 'merged';
  if (raw.state === 'open') return 'open';
  if (
    raw.state === 'closed' &&
    (typeof raw.merged === 'boolean' || Object.hasOwn(raw, 'merged_at'))
  )
    return 'closed';
  return 'unknown';
}

export function mapGitHubRequestSummary(
  raw: Json,
  repositoryId: string,
  connectionId?: string,
  stateHint?: 'open' | 'closed' | 'merged',
): ReviewRequestSummary {
  return {
    id: str(raw.id),
    number: str(raw.number),
    repositoryId,
    provider: 'github',
    ...(connectionId ? { connectionId } : {}),
    title: str(raw.title),
    state: stateHint ?? requestState(raw),
    author: mapGitHubUser(raw.user),
    sourceBranch: str(raw.head?.ref),
    targetBranch: str(raw.base?.ref),
    ...(typeof raw.draft === 'boolean' ? { draft: raw.draft } : {}),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
    webUrl: str(raw.html_url),
    ...(Array.isArray(raw.labels)
      ? { labels: raw.labels.map((label: Json) => str(label.name)) }
      : {}),
  };
}

export function mapGitHubRequestDetail(
  raw: Json,
  repositoryId: string,
  connectionId?: string,
): ReviewRequestDetail {
  return {
    ...mapGitHubRequestSummary(raw, repositoryId, connectionId),
    ...(raw.body != null ? { description: str(raw.body) } : {}),
    ...(raw.head?.sha ? { headSha: str(raw.head.sha) } : {}),
    ...(raw.base?.sha ? { baseSha: str(raw.base.sha) } : {}),
    ...(typeof raw.mergeable === 'boolean' || raw.mergeable === null
      ? { mergeable: raw.mergeable }
      : {}),
    ...(raw.mergeable_state ? { mergeStatus: str(raw.mergeable_state) } : {}),
    ...(Array.isArray(raw.assignees) ? { assignees: raw.assignees.map(mapGitHubUser) } : {}),
    ...(Array.isArray(raw.requested_reviewers)
      ? { reviewers: raw.requested_reviewers.map(mapGitHubUser) }
      : {}),
    ...(Number.isFinite(raw.commits) ? { commitsCount: raw.commits } : {}),
    ...(Number.isFinite(raw.changed_files) ? { changedFiles: raw.changed_files } : {}),
    ...(Number.isFinite(raw.additions) ? { additions: raw.additions } : {}),
    ...(Number.isFinite(raw.deletions) ? { deletions: raw.deletions } : {}),
    ...(raw.closed_at ? { closedAt: str(raw.closed_at) } : {}),
    ...(raw.merged_at ? { mergedAt: str(raw.merged_at) } : {}),
  };
}

export function mapGitHubFile(raw: Json): DiffFile {
  const status = raw.status;
  const change =
    status === 'added' ||
    status === 'modified' ||
    status === 'removed' ||
    status === 'renamed' ||
    status === 'copied'
      ? status
      : 'unknown';
  return {
    path: str(raw.filename),
    ...(raw.previous_filename ? { previousPath: str(raw.previous_filename) } : {}),
    change,
    ...(typeof raw.patch === 'string' ? { patch: raw.patch } : {}),
    ...(Number.isFinite(raw.additions) ? { additions: raw.additions } : {}),
    ...(Number.isFinite(raw.deletions) ? { deletions: raw.deletions } : {}),
    ...(Number.isFinite(raw.changes) ? { changes: raw.changes } : {}),
  };
}

function position(raw: Json) {
  if (!raw.path || !Number.isInteger(raw.line) || !['LEFT', 'RIGHT'].includes(raw.side))
    return undefined;
  return {
    path: str(raw.path),
    line: raw.line,
    side: raw.side === 'LEFT' ? ('old' as const) : ('new' as const),
  };
}

export function mapGitHubReviewComment(raw: Json): ReviewComment {
  const diffPosition = position(raw);
  return {
    id: str(raw.id),
    provider: 'github',
    resourceType: 'github-review-comment',
    ...(raw.in_reply_to_id != null ? { parentId: str(raw.in_reply_to_id) } : {}),
    author: mapGitHubUser(raw.user),
    body: str(raw.body),
    createdAt: str(raw.created_at),
    ...(raw.updated_at ? { updatedAt: str(raw.updated_at) } : {}),
    ...(raw.html_url ? { webUrl: str(raw.html_url) } : {}),
    ...(diffPosition ? { position: diffPosition } : {}),
  };
}

export function mapGitHubIssueComment(raw: Json): ReviewConversation {
  return {
    id: str(raw.id),
    provider: 'github',
    resourceType: 'github-issue-comment',
    author: mapGitHubUser(raw.user),
    body: str(raw.body),
    createdAt: str(raw.created_at),
    ...(raw.updated_at ? { updatedAt: str(raw.updated_at) } : {}),
    ...(raw.html_url ? { webUrl: str(raw.html_url) } : {}),
    replies: [],
  };
}

export function mapGitHubReview(raw: Json): ReviewConversation {
  const reviewState = (
    {
      APPROVED: 'approved',
      CHANGES_REQUESTED: 'changes-requested',
      COMMENTED: 'commented',
      DISMISSED: 'dismissed',
      PENDING: 'pending',
    } as const
  )[raw.state as 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'];
  return {
    id: str(raw.id),
    provider: 'github',
    resourceType: 'github-review',
    author: mapGitHubUser(raw.user),
    body: str(raw.body),
    createdAt: str(raw.submitted_at ?? raw.created_at),
    ...(raw.html_url ? { webUrl: str(raw.html_url) } : {}),
    replies: [],
    ...(reviewState ? { reviewState } : {}),
  };
}

export function groupGitHubConversations(
  issues: Json[],
  reviews: Json[],
  comments: Json[],
): ReviewConversation[] {
  const conversations: ReviewConversation[] = issues.map(mapGitHubIssueComment);
  conversations.push(
    ...reviews.filter((r) => r.state && r.state !== 'PENDING').map(mapGitHubReview),
  );
  const byId = new Map<string, ReviewConversation>();
  for (const raw of comments) {
    if (raw.in_reply_to_id != null) continue;
    const root = mapGitHubReviewComment(raw);
    byId.set(root.id, {
      ...root,
      resourceType: 'github-review-comment',
      threadId: root.id,
      author: root.author,
      replies: comments
        .filter((reply) => str(reply.in_reply_to_id) === root.id)
        .map(mapGitHubReviewComment),
    });
  }
  conversations.push(...byId.values());
  return conversations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function mapGitHubCheck(
  raw: Json,
  source: 'check-run' | 'status' | 'action',
  headSha?: string,
): CheckSummary {
  const status =
    raw.status === 'completed' || ['success', 'failure', 'error'].includes(raw.state)
      ? 'completed'
      : raw.status === 'in_progress'
        ? 'in_progress'
        : raw.status === 'queued' || raw.status === 'pending' || raw.state === 'pending'
          ? 'queued'
          : 'unknown';
  const conclusion =
    raw.conclusion ??
    (raw.state === 'success'
      ? 'success'
      : raw.state === 'failure' || raw.state === 'error'
        ? 'failure'
        : undefined);
  const valid = [
    'success',
    'failure',
    'cancelled',
    'skipped',
    'neutral',
    'action_required',
    'timed_out',
  ].includes(conclusion);
  return {
    id: `${source}:${str(raw.id ?? raw.context ?? raw.name)}`,
    source: source === 'status' ? 'commit-status' : source === 'action' ? 'actions' : 'check-run',
    ...(headSha ? { headSha } : {}),
    name: str(raw.name ?? raw.context ?? raw.workflow_name),
    status,
    ...(valid ? { conclusion } : conclusion ? { conclusion: 'unknown' as const } : {}),
    ...(raw.html_url || raw.details_url || raw.target_url
      ? { detailsUrl: str(raw.html_url ?? raw.details_url ?? raw.target_url) }
      : {}),
    ...(raw.started_at ? { startedAt: str(raw.started_at) } : {}),
    ...(raw.completed_at ? { completedAt: str(raw.completed_at) } : {}),
  };
}

export function mapGitHubApprovalState(
  reviews: Json[],
  login: string,
  headSha: string,
): ApprovalState {
  const latest = new Map<string, Json>();
  const ordered = reviews
    .filter((review) => review.commit_id === headSha && review.state !== 'PENDING')
    .sort((a, b) =>
      str(a.submitted_at ?? a.created_at).localeCompare(str(b.submitted_at ?? b.created_at)),
    );
  for (const review of ordered) {
    if (review.user?.login) latest.set(str(review.user.login), review);
  }
  const approvedBy = [...latest.values()]
    .filter((r) => r.state === 'APPROVED')
    .map((r) => mapGitHubUser(r.user));
  const own = latest.get(login);
  return {
    available: true,
    userHasApproved: own?.state === 'APPROVED',
    approvedBy,
  };
}

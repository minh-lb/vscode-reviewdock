/** Provider-neutral domain contracts. Provider-native identifiers remain opaque strings. */
export type ProviderType = 'github' | 'gitlab';
export type CapabilitySupport = 'supported' | 'unsupported' | 'conditional' | 'unknown';
export type ConnectionStatus =
  | 'connected'
  | 'reauthentication-required'
  | 'unreachable'
  | 'configuration-error'
  | 'disconnected';
export interface Connection {
  id: string;
  provider: ProviderType;
  displayName: string;
  serverUrl: string;
  accountId?: string;
  accountLogin?: string;
  accountName?: string;
  enabled: boolean;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
}

export interface ProviderUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
  webUrl?: string;
}
export interface RepositoryRef {
  id: string;
  provider?: ProviderType;
  connectionId?: string;
  serverUrl?: string;
  name: string;
  fullName: string;
  owner: string;
  private?: boolean;
  archived?: boolean;
  defaultBranch?: string;
  webUrl: string;
}
export type ReviewRequestState = 'open' | 'closed' | 'merged' | 'unknown';
export interface ReviewRequestSummary {
  id: string;
  number: string;
  repositoryId: string;
  provider?: ProviderType;
  connectionId?: string;
  title: string;
  state: ReviewRequestState;
  author: ProviderUser;
  sourceBranch: string;
  targetBranch: string;
  draft?: boolean;
  createdAt: string;
  updatedAt: string;
  webUrl: string;
  labels?: string[];
}
export interface ReviewRequestDetail extends ReviewRequestSummary {
  description?: string;
  headSha?: string;
  baseSha?: string;
  mergeable?: boolean | null;
  mergeStatus?: string;
  assignees?: ProviderUser[];
  reviewers?: ProviderUser[];
  commitsCount?: number;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
  closedAt?: string;
  mergedAt?: string;
}
export interface ReviewCommit {
  id: string;
  sha: string;
  message: string;
  author?: ProviderUser;
  authorName?: string;
  authorEmail?: string;
  authoredAt?: string;
  committedAt?: string;
  webUrl?: string;
}
export interface ReviewRequestMetadataInput {
  title?: string;
  description?: string;
  assigneeIds?: string[];
  reviewerIds?: string[];
  labels?: string[];
}
export type MetadataOptionKind = 'assignees' | 'reviewers' | 'labels';
export interface MetadataOptionQuery {
  repositoryId: string;
  reviewRequestId: string;
  kind: MetadataOptionKind;
  search?: string;
  page?: number;
}
export interface ReviewFileContentContext extends ReviewRequestContext {
  path: string;
  side: 'old' | 'new';
  baseSha?: string;
}
export interface ReviewRequestContext {
  repositoryId: string;
  reviewRequestId: string;
  headSha?: string;
  /** GitLab diff-version SHAs; absent when the provider has not collected a usable version. */
  diffVersion?: DiffVersion;
}
export interface DiffVersion {
  id?: string;
  baseSha: string;
  startSha: string;
  headSha: string;
}
export interface DiffFile {
  path: string;
  previousPath?: string;
  change: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'unknown';
  patch?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  binary?: boolean;
  collapsed?: boolean;
  tooLarge?: boolean;
}
export interface DiffFilePage {
  items: DiffFile[];
  page: PageInfo;
  diffVersion?: DiffVersion;
  truncated?: boolean;
}
export interface DiffPosition {
  path: string;
  oldPath?: string;
  newPath?: string;
  side: 'old' | 'new';
  line: number;
  oldLine?: number;
  newLine?: number;
}

export type ConversationResourceType =
  'github-issue-comment' | 'github-review-comment' | 'github-review' | 'gitlab-discussion';
export interface ReviewConversation {
  id: string;
  provider: ProviderType;
  resourceType: ConversationResourceType;
  reviewState?: 'approved' | 'changes-requested' | 'commented' | 'dismissed' | 'pending';
  threadId?: string;
  /** Provider-native root comment ID when conversation ID represents a discussion/thread. */
  rootCommentId?: string;
  parentId?: string;
  replyToId?: string;
  position?: DiffPosition;
  author: ProviderUser;
  body: string;
  createdAt: string;
  updatedAt?: string;
  webUrl?: string;
  systemNote?: boolean;
  resolved?: boolean | null;
  canResolve?: boolean;
  canUnresolve?: boolean;
  replies: ReviewComment[];
}
export interface ReviewComment {
  id: string;
  provider: ProviderType;
  resourceType: Exclude<ConversationResourceType, 'github-review'>;
  threadId?: string;
  parentId?: string;
  author: ProviderUser;
  body: string;
  createdAt: string;
  updatedAt?: string;
  webUrl?: string;
  position?: DiffPosition;
  systemNote?: boolean;
}
export interface CheckSummary {
  id: string;
  name: string;
  source?: 'check-run' | 'commit-status' | 'actions' | 'pipeline' | 'job';
  headSha?: string;
  status: 'queued' | 'in_progress' | 'completed' | 'unknown';
  conclusion?:
    | 'success'
    | 'failure'
    | 'cancelled'
    | 'skipped'
    | 'neutral'
    | 'action_required'
    | 'timed_out'
    | 'unknown';
  detailsUrl?: string;
  startedAt?: string;
  completedAt?: string;
}
export interface ApprovalState {
  available: boolean;
  approved?: boolean;
  userCanApprove?: boolean;
  userHasApproved?: boolean;
  approvedBy?: ProviderUser[];
  requiredApprovals?: number;
  approvalsLeft?: number;
}
export type ReviewDecision = 'approve' | 'request-changes' | 'comment';
export interface MergeResult {
  merged: boolean;
  message?: string;
  mergeCommitSha?: string;
  webUrl?: string;
}
export interface PageInfo {
  page: number;
  perPage: number;
  hasNextPage: boolean;
  totalCount?: number;
  limited?: boolean;
  incomplete?: boolean;
}
export interface Page<T> {
  items: T[];
  page: PageInfo;
}
export type ReviewRequestFilter =
  | 'open'
  | 'closed'
  | 'merged'
  | 'all'
  | 'created-by-me'
  | 'assigned-to-me'
  | 'review-requested-from-me';
export interface RepositoryQuery {
  search?: string;
  page?: number;
  perPage?: number;
}
export interface ReviewRequestQuery {
  repositoryId: string;
  filter?: ReviewRequestFilter;
  search?: string;
  page?: number;
  perPage?: number;
}
export interface ConversationQuery extends ReviewRequestContext {
  page?: number;
  perPage?: number;
}
export interface CreateGeneralCommentInput extends ReviewRequestContext {
  body: string;
}
export interface CreateInlineCommentInput extends ReviewRequestContext {
  body: string;
  position: DiffPosition;
}
export interface ReplyInput extends ReviewRequestContext {
  conversationId: string;
  parentCommentId?: string;
  body: string;
}
export interface MergeInput extends ReviewRequestContext {
  expectedHeadSha: string;
}
export interface SubmitReviewDecisionInput extends ReviewRequestContext {
  decision: ReviewDecision;
  body?: string;
}
export interface ProviderCapability {
  support: CapabilitySupport;
  reason?: string;
}
export interface ProviderCapabilityDescriptor {
  generalComments: ProviderCapability;
  inlineComments: ProviderCapability;
  replyByResource: Partial<Record<ConversationResourceType, ProviderCapability>>;
  resolveThreads: ProviderCapability;
  checks: ProviderCapability;
  approvals: ProviderCapability;
  reviewDecisions: ProviderCapability;
  merge: ProviderCapability;
  commits?: ProviderCapability;
  editMetadata?: ProviderCapability;
  deleteByResource?: Partial<Record<ConversationResourceType, ProviderCapability>>;
}

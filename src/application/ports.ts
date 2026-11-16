import type {
  ApprovalState,
  CheckSummary,
  ConversationQuery,
  CreateGeneralCommentInput,
  CreateInlineCommentInput,
  DiffFilePage,
  MergeInput,
  MergeResult,
  MetadataOptionQuery,
  PageInfo,
  Page,
  ProviderCapabilityDescriptor,
  ProviderType,
  ProviderUser,
  ReplyInput,
  RepositoryQuery,
  RepositoryRef,
  ReviewComment,
  ReviewConversation,
  ReviewDecision,
  ReviewRequestContext,
  ReviewCommit,
  ReviewRequestDetail,
  ReviewRequestQuery,
  ReviewRequestSummary,
  SubmitReviewDecisionInput,
  ReviewRequestMetadataInput,
  ReviewFileContentContext,
} from '../domain/models';

/** Implemented by GitHub/GitLab adapters. Unsupported conditional operations reject with UnsupportedCapabilityError. */
export interface ReviewProvider {
  readonly provider: ProviderType;
  getCurrentUser(): Promise<ProviderUser>;
  listRepositories(query: RepositoryQuery): Promise<Page<RepositoryRef>>;
  getRepository(repositoryId: string): Promise<RepositoryRef>;
  listReviewRequests(query: ReviewRequestQuery): Promise<Page<ReviewRequestSummary>>;
  getReviewRequest(repositoryId: string, reviewRequestId: string): Promise<ReviewRequestDetail>;
  listChangedFiles(
    context: ReviewRequestContext,
    page?: number,
    perPage?: number,
  ): Promise<DiffFilePage>;
  listConversations(query: ConversationQuery): Promise<Page<ReviewConversation>>;
  createGeneralComment(input: CreateGeneralCommentInput): Promise<ReviewComment>;
  createInlineComment(input: CreateInlineCommentInput): Promise<ReviewComment>;
  replyToConversation(input: ReplyInput): Promise<ReviewComment>;
  getChecks(context: ReviewRequestContext): Promise<CheckSummary[]>;
  getApprovalState(context: ReviewRequestContext): Promise<ApprovalState>;
  submitReviewDecision(input: SubmitReviewDecisionInput): Promise<ReviewComment | void>;
  merge(input: MergeInput): Promise<MergeResult>;
  getCapabilities(context: ReviewRequestContext): ProviderCapabilityDescriptor;
}

/** Credential storage is keyed by immutable connection ID and never exposed to presentation. */
export interface SecretStore {
  get(connectionId: string): Promise<string | undefined>;
  set(connectionId: string, secret: string): Promise<void>;
  delete(connectionId: string): Promise<void>;
}

/** Optional refinements let application code expose thread management only when adapters implement it. */
export interface ReviewConversationManagement {
  setConversationResolved(
    context: ReviewRequestContext,
    conversationId: string,
    resolved: boolean,
  ): Promise<void>;
}
/** Optional write/query surface keeps existing provider doubles and alternate providers compatible. */
export interface ReviewRequestManagement {
  updateMetadata(context: ReviewRequestContext, input: ReviewRequestMetadataInput): Promise<void>;
  listMetadataOptions(query: MetadataOptionQuery): Promise<{
    items: ProviderUser[] | string[];
    page: PageInfo;
  }>;
  deleteComment(
    context: ReviewRequestContext,
    resourceType: ReviewConversation['resourceType'],
    conversationId: string,
    commentId?: string,
  ): Promise<void>;
}
export interface GitHubThreadManagement {
  setConversationResolved(
    context: ReviewRequestContext,
    threadId: string,
    resolved: boolean,
  ): Promise<void>;
}
export interface ReviewFileContentProvider {
  getFileContent(input: ReviewFileContentContext): Promise<string>;
}
export interface ReviewCommitProvider {
  listCommits(
    context: ReviewRequestContext,
    page?: number,
    perPage?: number,
  ): Promise<Page<ReviewCommit>>;
}
export interface ReviewDecisionPort {
  submitReviewDecision(input: SubmitReviewDecisionInput): Promise<ReviewComment | void>;
}
export type { ReviewDecision };

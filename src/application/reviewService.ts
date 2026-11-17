import type {
  ReviewCommitProvider,
  ReviewConversationManagement,
  ReviewFileContentProvider,
  ReviewProvider,
  ReviewRequestManagement,
} from './ports';
import {
  expandDiffContext,
  mapGitHubReviewLine,
  mapGitLabDiscussionPosition,
  parseUnifiedDiff,
} from '../domain/diff';
import { AppError, UnsupportedCapabilityError, ValidationError } from '../domain/errors';
import type {
  ApprovalState,
  CheckSummary,
  CreateGeneralCommentInput,
  CreateInlineCommentInput,
  DiffFile,
  DiffPosition,
  DiffVersion,
  MergeInput,
  MergeResult,
  ProviderCapability,
  ReviewComment,
  ReviewConversation,
  ReviewRequestContext,
  ReviewRequestDetail,
  ReviewRequestQuery,
  ReviewRequestMetadataInput,
  MetadataOptionQuery,
  ReviewFileContentContext,
  ReviewCommit,
  Page,
} from '../domain/models';

/** Application use cases for reading and safely mutating one provider review request. */
export class ReviewService {
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly uncertain = new Set<string>();

  constructor(private readonly provider: ReviewProvider) {}

  list(query: ReviewRequestQuery) {
    return this.provider.listReviewRequests(query);
  }

  commits(context: ReviewRequestContext, page = 1): Promise<Page<ReviewCommit>> {
    this.requireSupported(this.provider.getCapabilities(context).commits, 'commit history');
    const provider = this.provider as ReviewProvider & Partial<ReviewCommitProvider>;
    if (!provider.listCommits) throw new UnsupportedCapabilityError('commit history');
    return provider.listCommits(context, page);
  }

  detail(context: ReviewRequestContext): Promise<ReviewRequestDetail> {
    return this.provider.getReviewRequest(context.repositoryId, context.reviewRequestId);
  }

  files(context: ReviewRequestContext, page?: number) {
    return this.provider.listChangedFiles(context, page);
  }

  conversations(context: ReviewRequestContext, page?: number) {
    return this.provider.listConversations({ ...context, ...(page === undefined ? {} : { page }) });
  }

  checks(context: ReviewRequestContext): Promise<CheckSummary[]> {
    return this.provider.getChecks(context);
  }
  approvals(context: ReviewRequestContext): Promise<ApprovalState> {
    return this.provider.getApprovalState(context);
  }

  metadataOptions(query: MetadataOptionQuery) {
    const management = this.provider as ReviewProvider & Partial<ReviewRequestManagement>;
    if (!management.listMetadataOptions) throw new UnsupportedCapabilityError('metadata options');
    return management.listMetadataOptions(query);
  }

  updateMetadata(context: ReviewRequestContext, input: ReviewRequestMetadataInput): Promise<void> {
    const capability = this.provider.getCapabilities(context).editMetadata;
    this.requireSupported(capability, 'review request metadata editing');
    const management = this.provider as ReviewProvider & Partial<ReviewRequestManagement>;
    if (!management.updateMetadata) throw new UnsupportedCapabilityError('metadata editing');
    if (input.title !== undefined && !input.title.trim())
      throw new ValidationError('Title is required', 'title');
    return this.mutate(
      context,
      'edit-metadata',
      input,
      (dispatch) => {
        dispatch();
        return management.updateMetadata!(context, input);
      },
      async () => {
        await this.detail(context);
      },
    );
  }

  deleteComment(
    context: ReviewRequestContext,
    conversationId: string,
    commentId?: string,
  ): Promise<void> {
    return this.mutate(
      context,
      'delete-comment',
      { conversationId, commentId },
      async (dispatch) => {
        const conversation = await this.findConversation(context, conversationId);
        if (!conversation)
          throw new ValidationError('The selected comment could not be found', 'conversationId');
        if (conversation.systemNote || conversation.resourceType === 'github-review')
          throw new UnsupportedCapabilityError('delete this comment');
        const target = commentId
          ? conversation.replies.find((reply) => reply.id === commentId)
          : conversation;
        if (!target)
          throw new ValidationError('The selected reply could not be found', 'commentId');
        if (target.systemNote) throw new UnsupportedCapabilityError('delete system notes');
        const capability =
          this.provider.getCapabilities(context).deleteByResource?.[conversation.resourceType];
        this.requireSupported(capability, 'delete this comment');
        const currentUser = await this.provider.getCurrentUser();
        const targetAuthor = target.author.id || target.author.login;
        if (
          !targetAuthor ||
          (targetAuthor !== currentUser.id && target.author.login !== currentUser.login)
        )
          throw new AppError(
            'Only comments written by the connected account can be deleted',
            'operation-not-allowed',
          );
        const management = this.provider as ReviewProvider & Partial<ReviewRequestManagement>;
        if (!management.deleteComment) throw new UnsupportedCapabilityError('delete comments');
        dispatch();
        return management.deleteComment(
          context,
          conversation.resourceType,
          conversationId,
          commentId ?? conversation.rootCommentId,
        );
      },
      () => this.refreshConversations(context),
    );
  }

  setThreadResolved(
    context: ReviewRequestContext,
    conversationId: string,
    resolved: boolean,
  ): Promise<void> {
    return this.mutate(
      context,
      'resolve-thread',
      { conversationId, resolved },
      async (dispatch) => {
        const conversation = await this.findConversation(context, conversationId);
        if (!conversation?.threadId)
          throw new ValidationError('The selected thread could not be found', 'conversationId');
        if (
          this.provider.provider === 'github' &&
          ((resolved && conversation.canResolve !== true) ||
            (!resolved && conversation.canUnresolve !== true))
        )
          throw new AppError(
            'The connected account cannot change this thread state',
            'operation-not-allowed',
          );
        this.requireSupported(
          this.provider.getCapabilities(context).resolveThreads,
          'resolve threads',
        );
        const management = this.provider as ReviewProvider & Partial<ReviewConversationManagement>;
        if (!management.setConversationResolved)
          throw new UnsupportedCapabilityError('resolve threads');
        dispatch();
        return management.setConversationResolved(context, conversation.threadId, resolved);
      },
      () => this.refreshConversations(context),
    );
  }

  async markdownContent(
    context: ReviewRequestContext,
    path: string,
  ): Promise<{ oldContent?: string; newContent?: string; error?: string }> {
    const freshFiles = await this.allFiles(context);
    const files = freshFiles.files;
    const file = files.find((item) => item.path === path || item.previousPath === path);
    if (!file)
      throw new ValidationError('The requested file is not part of the current diff', 'path');
    const detail = await this.detail(context);
    if (!context.headSha || context.headSha !== detail.headSha)
      throw new AppError(
        'The review request changed. Refresh the diff before viewing full file content.',
        'conflict',
      );
    if (
      !context.diffVersion ||
      !freshFiles.version ||
      !sameVersion(context.diffVersion, freshFiles.version)
    )
      throw new AppError(
        'The displayed diff changed. Refresh before viewing full file content.',
        'conflict',
      );
    const provider = this.provider as ReviewProvider & Partial<ReviewFileContentProvider>;
    if (!provider.getFileContent) throw new UnsupportedCapabilityError('full file content');
    const read = async (side: 'old' | 'new', filePath?: string): Promise<string | undefined> => {
      if (!filePath) return undefined;
      const input: ReviewFileContentContext = {
        ...context,
        path: filePath,
        side,
        ...(detail.baseSha ? { baseSha: detail.baseSha } : {}),
      };
      return provider.getFileContent!(input);
    };
    const [oldResult, newResult] = await Promise.allSettled([
      read('old', file.change === 'added' ? undefined : (file.previousPath ?? file.path)),
      read('new', file.change === 'removed' ? undefined : file.path),
    ]);
    const oldContent = oldResult.status === 'fulfilled' ? oldResult.value : undefined;
    const newContent = newResult.status === 'fulfilled' ? newResult.value : undefined;
    const error = [oldResult, newResult].some((result) => result.status === 'rejected')
      ? 'Full file content could not be loaded for one or more revisions.'
      : undefined;
    return {
      ...(oldContent === undefined ? {} : { oldContent }),
      ...(newContent === undefined ? {} : { newContent }),
      ...(error ? { error } : {}),
    };
  }

  /** Reconcile provider state after an ambiguous mutation before allowing another write. */
  async reconcile(context: ReviewRequestContext): Promise<void> {
    const target = resourceKey(context);
    await this.queues.get(target);
    await Promise.all([
      this.detail(context),
      this.refreshConversations(context),
      this.allFiles(context),
    ]);
    this.uncertain.delete(target);
  }

  createGeneral(context: ReviewRequestContext, body: string): Promise<ReviewComment> {
    this.requireSupported(
      this.provider.getCapabilities(context).generalComments,
      'general comments',
    );
    const input: CreateGeneralCommentInput = { ...context, body: this.requireBody(body) };
    return this.mutate(
      context,
      'general',
      input,
      (dispatch) => {
        dispatch();
        return this.provider.createGeneralComment(input);
      },
      () => this.refreshConversations(context),
    );
  }

  createInline(
    context: ReviewRequestContext,
    body: string,
    position: DiffPosition,
  ): Promise<ReviewComment> {
    const capability = this.provider.getCapabilities(context).inlineComments;
    this.requireSupported(capability, 'inline comments');
    return this.mutate(
      context,
      'inline',
      { context, body, position },
      async (dispatch) => {
        const current = await this.detail(context);
        const freshFiles = await this.allFiles(context);
        const currentVersion = freshFiles.version;
        this.assertFreshInlineContext(context, current.headSha, currentVersion);
        if (!current.headSha)
          throw new AppError('The current source head SHA is unavailable.', 'conflict');
        const canonicalPosition = await this.rederivePosition(
          context,
          freshFiles.files,
          position,
          current.headSha,
          currentVersion,
        );
        const input: CreateInlineCommentInput = {
          ...context,
          body: this.requireBody(body),
          position: canonicalPosition,
        };
        dispatch();
        return this.provider.createInlineComment(input);
      },
      async () => {
        await Promise.all([
          this.refreshConversations(context),
          this.detail(context),
          this.allFiles(context),
        ]);
      },
    );
  }

  reply(
    context: ReviewRequestContext,
    conversationId: string,
    body: string,
  ): Promise<ReviewComment> {
    const inputBody = this.requireBody(body);
    return this.mutate(
      context,
      'reply',
      { context, conversationId, body: inputBody },
      async (dispatch) => {
        const target = await this.findConversation(context, conversationId);
        if (!target)
          throw new ValidationError(
            'The selected conversation could not be found',
            'conversationId',
          );
        if (
          target.resourceType === 'github-issue-comment' ||
          target.resourceType === 'github-review' ||
          target.replyToId ||
          target.parentId
        ) {
          throw new UnsupportedCapabilityError('reply to this conversation');
        }
        this.requireSupported(
          this.provider.getCapabilities(context).replyByResource[target.resourceType],
          'reply to this conversation',
        );
        dispatch();
        return this.provider.replyToConversation({ ...context, conversationId, body: inputBody });
      },
      () => this.refreshConversations(context),
    );
  }

  merge(
    context: ReviewRequestContext,
    expectedHeadSha: string,
    confirmed: boolean,
  ): Promise<MergeResult> {
    if (!confirmed)
      throw new AppError('Merge requires explicit confirmation', 'operation-not-allowed');
    this.requireSupported(this.provider.getCapabilities(context).merge, 'merge');
    if (!expectedHeadSha.trim())
      throw new ValidationError('An expected head SHA is required', 'expectedHeadSha');
    const input: MergeInput = { ...context, expectedHeadSha };
    return this.mutate(
      context,
      'merge',
      { input, confirmed },
      async (dispatch) => {
        const fresh = await this.detail(context);
        if (fresh.state !== 'open')
          throw new AppError('The review request is no longer open', 'conflict');
        if (!fresh.headSha)
          throw new AppError('The current source head SHA is unavailable', 'conflict');
        if (
          fresh.headSha !== expectedHeadSha ||
          (context.headSha && context.headSha !== fresh.headSha)
        ) {
          throw new AppError(
            'The review request changed. Refresh it and confirm the merge again.',
            'conflict',
          );
        }
        dispatch();
        return this.provider.merge({ ...input, expectedHeadSha: fresh.headSha });
      },
      () => this.detail(context),
    );
  }

  private async allFiles(
    context: ReviewRequestContext,
  ): Promise<{ files: DiffFile[]; version?: DiffVersion }> {
    const files: DiffFile[] = [];
    let page = 1;
    let version: DiffVersion | undefined;
    for (;;) {
      const result = await this.provider.listChangedFiles(context, page);
      files.push(...result.items);
      if (result.diffVersion) {
        if (version && !sameVersion(version, result.diffVersion))
          throw new AppError(
            'The diff changed while it was loading. Refresh and try again.',
            'conflict',
          );
        version = result.diffVersion;
      }
      if (!result.page.hasNextPage) return { files, ...(version ? { version } : {}) };
      page += 1;
    }
  }

  private assertFreshInlineContext(
    context: ReviewRequestContext,
    headSha?: string,
    version?: DiffVersion,
  ): void {
    if (!headSha || !context.headSha || headSha !== context.headSha) {
      throw new AppError('The review request changed. Refresh the diff and try again.', 'conflict');
    }
    if (
      this.provider.provider === 'gitlab' &&
      (!context.diffVersion || !version || !sameVersion(context.diffVersion, version))
    )
      throw new AppError('The merge request diff changed. Refresh it and try again.', 'conflict');
    if (
      this.provider.provider === 'github' &&
      context.diffVersion &&
      (!version || !sameVersion(context.diffVersion, version))
    )
      throw new AppError('The pull request diff changed. Refresh it and try again.', 'conflict');
    if (this.provider.provider === 'gitlab' && version?.headSha !== headSha) {
      throw new AppError(
        'The merge request diff version does not match its current head. Refresh and try again.',
        'conflict',
      );
    }
  }

  private async rederivePosition(
    context: ReviewRequestContext,
    files: DiffFile[],
    selected: DiffPosition,
    headSha: string,
    version?: DiffVersion,
  ): Promise<DiffPosition> {
    const file = files.find(
      (candidate) =>
        candidate.path === selected.path ||
        candidate.previousPath === selected.path ||
        (selected.oldPath &&
          candidate.previousPath === selected.oldPath &&
          candidate.path === (selected.newPath ?? selected.path)) ||
        (selected.newPath && candidate.path === selected.newPath),
    );
    if (!file)
      throw new ValidationError('The selected diff file is no longer available', 'position');
    let parsed = parseUnifiedDiff(file);
    if (parsed.status !== 'available')
      throw new ValidationError('The selected diff position is unavailable', 'position');
    const findRow = () =>
      parsed.rows.find((candidate) => {
        if (!candidate.commentable) return false;
        const line = selected.side === 'old' ? candidate.oldLine : candidate.newLine;
        if (line !== selected.line) return false;
        if (selected.oldLine !== undefined && candidate.oldLine !== selected.oldLine) return false;
        if (selected.newLine !== undefined && candidate.newLine !== selected.newLine) return false;
        if (selected.side === 'old')
          return candidate.kind === 'removed' || candidate.kind === 'context';
        return candidate.kind === 'added' || candidate.kind === 'context';
      });
    let row = findRow();
    if (!row) {
      const contentProvider = this.provider as ReviewProvider & Partial<ReviewFileContentProvider>;
      if (!version || !contentProvider.getFileContent)
        throw new ValidationError(
          'The selected line is not a commentable row in the current diff',
          'position',
        );
      const contentContext = { ...context, diffVersion: version };
      const oldPath = file.previousPath ?? file.path;
      const [oldContent, newContent] = await Promise.all([
        file.change === 'added'
          ? undefined
          : contentProvider.getFileContent({
              ...contentContext,
              path: oldPath,
              side: 'old',
              baseSha: version.baseSha,
            }),
        file.change === 'removed'
          ? undefined
          : contentProvider.getFileContent({
              ...contentContext,
              path: file.path,
              side: 'new',
              baseSha: version.baseSha,
            }),
      ]);
      parsed = expandDiffContext(file, oldContent, newContent);
      row = parsed.status === 'available' ? findRow() : undefined;
    }
    if (!row)
      throw new ValidationError(
        'The selected line is not a commentable row in the current diff',
        'position',
      );
    const oldPath = file.previousPath ?? file.path;
    const newPath = file.path;
    const providerSide =
      this.provider.provider === 'github' && row.kind === 'context' ? 'new' : selected.side;
    const line = providerSide === 'old' ? row.oldLine : row.newLine;
    if (line === undefined)
      throw new ValidationError('The selected line has no provider-supported side', 'position');
    if (this.provider.provider === 'github') {
      const mapped = mapGitHubReviewLine({ row, path: newPath, commitSha: headSha });
      if (!mapped)
        throw new ValidationError('The selected line cannot be commented on', 'position');
    } else {
      const mapped = mapGitLabDiscussionPosition({
        row,
        oldPath,
        newPath,
        ...(version
          ? { baseSha: version.baseSha, startSha: version.startSha, headSha: version.headSha }
          : {}),
      });
      if (!mapped)
        throw new ValidationError('The selected line cannot be commented on', 'position');
    }
    return {
      path: newPath,
      oldPath,
      newPath,
      side: providerSide,
      line,
      ...(row.oldLine === undefined ? {} : { oldLine: row.oldLine }),
      ...(row.newLine === undefined ? {} : { newLine: row.newLine }),
    };
  }

  private async findConversation(
    context: ReviewRequestContext,
    id: string,
  ): Promise<ReviewConversation | undefined> {
    return (await this.allConversations(context)).find((item) => item.id === id);
  }

  private async refreshConversations(context: ReviewRequestContext): Promise<void> {
    await this.allConversations(context);
  }

  private async allConversations(context: ReviewRequestContext): Promise<ReviewConversation[]> {
    const items: ReviewConversation[] = [];
    const seenPages = new Set<string>();
    let page = 1;
    for (;;) {
      const result = await this.provider.listConversations({ ...context, page });
      const signature = result.items.map((item) => item.id).join('\u0000');
      if (result.page.hasNextPage && (!result.items.length || seenPages.has(signature))) {
        throw new AppError(
          'Conversation pagination did not advance. Refresh and try again.',
          'provider-server',
        );
      }
      seenPages.add(signature);
      items.push(...result.items);
      if (!result.page.hasNextPage) return items;
      page += 1;
    }
  }

  private requireBody(body: string): string {
    if (!body.trim()) throw new ValidationError('Comment text is required', 'body');
    return body;
  }

  private requireSupported(capability: ProviderCapability | undefined, name: string): void {
    if (!capability || capability.support === 'unsupported' || capability.support === 'unknown') {
      throw new UnsupportedCapabilityError(
        name,
        capability?.reason ?? `Provider does not support ${name}`,
      );
    }
  }

  private mutate<T>(
    context: ReviewRequestContext,
    operation: string,
    payload: unknown,
    action: (dispatch: () => void) => Promise<T>,
    refresh: () => Promise<unknown>,
  ): Promise<T> {
    const target = resourceKey(context);
    const fingerprint = JSON.stringify([target, context, operation, payload]);
    const existing = this.pending.get(fingerprint) as Promise<T> | undefined;
    if (existing) return existing;
    const queued = this.queues.get(target) ?? Promise.resolve();
    const request = queued.then(async () => {
      if (this.uncertain.has(target))
        throw new AppError(
          'Reconcile the review request before trying this change again.',
          'operation-not-allowed',
        );
      let dispatched = false;
      try {
        return await action(() => {
          dispatched = true;
        });
      } catch (error) {
        if (dispatched && isAmbiguous(error)) {
          this.uncertain.add(target);
          try {
            await refresh();
          } catch {
            /* Preserve the unknown mutation result; the next action refreshes again. */
          }
          throw new AppError(
            'The result of this change is unknown. The review data was refreshed; verify it before trying again.',
            'unknown',
            { cause: error },
          );
        }
        if (
          dispatched &&
          error instanceof AppError &&
          (error.code === 'conflict' || error.code === 'validation')
        ) {
          try {
            await refresh();
          } catch {
            /* Preserve the provider rejection; the caller can request another refresh. */
          }
        }
        throw error;
      }
    });
    this.pending.set(fingerprint, request);
    const settled = request.finally(() => {
      this.pending.delete(fingerprint);
      if (this.queues.get(target) === queueTail) this.queues.delete(target);
    });
    const queueTail = settled.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(target, queueTail);
    return settled;
  }
}

function sameVersion(left: DiffVersion, right: DiffVersion): boolean {
  return (
    left.baseSha === right.baseSha &&
    left.startSha === right.startSha &&
    left.headSha === right.headSha
  );
}
function resourceKey(context: ReviewRequestContext): string {
  return JSON.stringify([context.repositoryId, context.reviewRequestId]);
}
function isAmbiguous(error: unknown): boolean {
  return (
    error instanceof AppError &&
    ['timeout', 'network', 'unknown', 'provider-server'].includes(error.code)
  );
}

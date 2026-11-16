import type { ReviewProvider } from './ports';
import { mapGitHubReviewLine, mapGitLabDiscussionPosition, parseUnifiedDiff } from '../domain/diff';
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
        const canonicalPosition = this.rederivePosition(
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
    ) {
      throw new AppError('The merge request diff changed. Refresh it and try again.', 'conflict');
    }
    if (this.provider.provider === 'gitlab' && version?.headSha !== headSha) {
      throw new AppError(
        'The merge request diff version does not match its current head. Refresh and try again.',
        'conflict',
      );
    }
  }

  private rederivePosition(
    files: DiffFile[],
    selected: DiffPosition,
    headSha: string,
    version?: DiffVersion,
  ): DiffPosition {
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
    const parsed = parseUnifiedDiff(file);
    if (parsed.status !== 'available')
      throw new ValidationError('The selected diff position is unavailable', 'position');
    const row = parsed.rows.find((candidate) => {
      if (!candidate.commentable) return false;
      const line = selected.side === 'old' ? candidate.oldLine : candidate.newLine;
      if (line !== selected.line) return false;
      if (selected.oldLine !== undefined && candidate.oldLine !== selected.oldLine) return false;
      if (selected.newLine !== undefined && candidate.newLine !== selected.newLine) return false;
      if (selected.side === 'old')
        return (
          candidate.kind === 'removed' ||
          (this.provider.provider === 'gitlab' && candidate.kind === 'context')
        );
      return candidate.kind === 'added' || candidate.kind === 'context';
    });
    if (!row)
      throw new ValidationError(
        'The selected line is not a commentable row in the current diff',
        'position',
      );
    const oldPath = file.previousPath ?? file.path;
    const newPath = file.path;
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
      side: selected.side,
      line: selected.line,
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

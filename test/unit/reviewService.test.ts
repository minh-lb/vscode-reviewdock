import { describe, expect, it, vi } from 'vitest';
import type { ReviewFileContentProvider, ReviewProvider } from '../../src/application/ports';
import { ReviewService } from '../../src/application/reviewService';
import { AppError } from '../../src/domain/errors';
import type {
  DiffFilePage,
  ReviewConversation,
  ReviewRequestContext,
  ReviewRequestDetail,
} from '../../src/domain/models';

const context: ReviewRequestContext = {
  repositoryId: 'repo',
  reviewRequestId: '17',
  headSha: 'head-1',
};
const detail: ReviewRequestDetail = {
  id: '17',
  number: '17',
  repositoryId: 'repo',
  title: 'Change',
  state: 'open',
  author: { id: 'u1', login: 'reviewer' },
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '',
  updatedAt: '',
  webUrl: '',
  headSha: 'head-1',
};
const files: DiffFilePage = {
  items: [{ path: 'src/a.ts', change: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' }],
  page: { page: 1, perPage: 100, hasNextPage: false },
};

function provider(overrides: Partial<ReviewProvider> = {}): ReviewProvider {
  return {
    provider: 'github',
    getCurrentUser: vi.fn(),
    listRepositories: vi.fn(),
    getRepository: vi.fn(),
    listReviewRequests: vi.fn(),
    getReviewRequest: vi.fn().mockResolvedValue(detail),
    listChangedFiles: vi.fn().mockResolvedValue(files),
    listConversations: vi
      .fn()
      .mockResolvedValue({ items: [], page: { page: 1, perPage: 100, hasNextPage: false } }),
    createGeneralComment: vi.fn(),
    createInlineComment: vi.fn(),
    replyToConversation: vi.fn(),
    getChecks: vi.fn().mockResolvedValue([]),
    getApprovalState: vi.fn().mockResolvedValue({ available: true }),
    submitReviewDecision: vi.fn(),
    merge: vi.fn().mockResolvedValue({ merged: true }),
    getCapabilities: vi.fn().mockReturnValue({
      generalComments: { support: 'supported' },
      inlineComments: { support: 'supported' },
      replyByResource: { 'github-review-comment': { support: 'supported' } },
      resolveThreads: { support: 'unsupported' },
      checks: { support: 'supported' },
      approvals: { support: 'supported' },
      reviewDecisions: { support: 'supported' },
      merge: { support: 'supported' },
    }),
    ...overrides,
  } as ReviewProvider;
}

describe('ReviewService', () => {
  it('deletes only an owned comment using its provider resource identity', async () => {
    const conversation: ReviewConversation = {
      id: 'discussion',
      provider: 'gitlab',
      resourceType: 'gitlab-discussion',
      threadId: 'discussion',
      rootCommentId: 'note-root',
      author: { id: 'user-1', login: 'me' },
      body: 'root',
      createdAt: '',
      replies: [],
    };
    const listConversations = vi.fn().mockResolvedValue({
      items: [conversation],
      page: { page: 1, perPage: 100, hasNextPage: false },
    });
    const deleteComment = vi.fn().mockResolvedValue(undefined);
    const p = provider({
      provider: 'gitlab',
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', login: 'me' }),
      listConversations,
      getCapabilities: vi.fn().mockReturnValue({
        resolveThreads: { support: 'conditional' },
        deleteByResource: { 'gitlab-discussion': { support: 'conditional' } },
      }),
    }) as ReviewProvider & { deleteComment: typeof deleteComment };
    p.deleteComment = deleteComment;
    await new ReviewService(p).deleteComment(context, 'discussion');
    expect(deleteComment).toHaveBeenCalledWith(
      context,
      'gitlab-discussion',
      'discussion',
      'note-root',
    );
    const notOwner = provider({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'other', login: 'other' }),
      listConversations,
      getCapabilities: vi
        .fn()
        .mockReturnValue({ deleteByResource: { 'gitlab-discussion': { support: 'conditional' } } }),
    });
    await expect(
      new ReviewService(notOwner).deleteComment(context, 'discussion'),
    ).rejects.toMatchObject({ code: 'operation-not-allowed' });
  });

  it('resolves only a GitHub thread with confirmed viewer permission', async () => {
    const setConversationResolved = vi.fn().mockResolvedValue(undefined);
    const conversation: ReviewConversation = {
      id: 'root',
      provider: 'github',
      resourceType: 'github-review-comment',
      threadId: 'node-thread',
      canResolve: true,
      author: { id: 'u1', login: 'author' },
      body: 'body',
      createdAt: '',
      replies: [],
    };
    const p = provider({
      listConversations: vi.fn().mockResolvedValue({
        items: [conversation],
        page: { page: 1, perPage: 100, hasNextPage: false },
      }),
      getCapabilities: vi.fn().mockReturnValue({ resolveThreads: { support: 'conditional' } }),
    }) as ReviewProvider & { setConversationResolved: typeof setConversationResolved };
    p.setConversationResolved = setConversationResolved;
    await new ReviewService(p).setThreadResolved(context, 'root', true);
    expect(setConversationResolved).toHaveBeenCalledWith(context, 'node-thread', true);
    const unknown = provider({
      listConversations: vi.fn().mockResolvedValue({
        items: [{ ...conversation, canResolve: undefined }],
        page: { page: 1, perPage: 100, hasNextPage: false },
      }),
      getCapabilities: vi.fn().mockReturnValue({ resolveThreads: { support: 'conditional' } }),
    }) as ReviewProvider & { setConversationResolved: typeof setConversationResolved };
    unknown.setConversationResolved = setConversationResolved;
    await expect(
      new ReviewService(unknown).setThreadResolved(context, 'root', true),
    ).rejects.toMatchObject({ code: 'operation-not-allowed' });
  });

  it('replies to a GitLab root discussion by discussion ID, not its native root note ID', async () => {
    const conversation: ReviewConversation = {
      id: 'discussion-id',
      provider: 'gitlab',
      resourceType: 'gitlab-discussion',
      threadId: 'discussion-id',
      rootCommentId: 'root-note-id',
      author: { id: 'u1', login: 'author' },
      body: 'root',
      createdAt: '',
      replies: [],
    };
    const replyToConversation = vi.fn().mockResolvedValue({ id: 'reply-id' });
    const p = provider({
      provider: 'gitlab',
      listConversations: vi.fn().mockResolvedValue({
        items: [conversation],
        page: { page: 1, perPage: 100, hasNextPage: false },
      }),
      getCapabilities: vi
        .fn()
        .mockReturnValue({ replyByResource: { 'gitlab-discussion': { support: 'supported' } } }),
      replyToConversation,
    });
    await new ReviewService(p).reply(context, 'discussion-id', 'reply');
    expect(replyToConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'discussion-id', body: 'reply' }),
    );
  });

  it('loads full file content only for a current changed path and immutable revisions', async () => {
    const getFileContent = vi.fn(async ({ side }: { side: 'old' | 'new' }) =>
      side === 'old' ? 'old text' : 'new text',
    );
    const version = { baseSha: 'merge-base', startSha: 'base-1', headSha: 'head-1' };
    const p = provider({
      listChangedFiles: vi.fn().mockResolvedValue({ ...files, diffVersion: version }),
      getReviewRequest: vi.fn().mockResolvedValue({ ...detail, baseSha: 'base-1' }),
    });
    Object.assign(p, { getFileContent });
    const content = await new ReviewService(p).markdownContent(
      { ...context, diffVersion: version },
      'src/a.ts',
    );
    expect(content).toEqual({ oldContent: 'old text', newContent: 'new text' });
    expect(getFileContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'src/a.ts',
        side: 'old',
        headSha: 'head-1',
        baseSha: 'base-1',
        diffVersion: version,
      }),
    );
    await expect(
      new ReviewService(p).markdownContent({ ...context, diffVersion: version }, 'outside.txt'),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('refreshes detail and all diff pages and rejects an inline anchor from an obsolete head', async () => {
    const p = provider({
      getReviewRequest: vi.fn().mockResolvedValue({ ...detail, headSha: 'head-2' }),
    });
    const service = new ReviewService(p);
    await expect(
      service.createInline(context, 'comment', { path: 'src/a.ts', side: 'new', line: 1 }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(p.createInlineComment).not.toHaveBeenCalled();
    expect(p.listChangedFiles).toHaveBeenCalled();
  });

  it('shares a pending identical mutation instead of sending it twice', async () => {
    let release!: (value: { id: string }) => void;
    const createGeneralComment = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          release = resolve;
        }),
    );
    const service = new ReviewService(provider({ createGeneralComment }));
    const first = service.createGeneral(context, 'hello');
    const second = service.createGeneral(context, 'hello');
    await Promise.resolve();
    expect(createGeneralComment).toHaveBeenCalledTimes(1);
    release({ id: 'comment' });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('refreshes conversations after an ambiguous mutation and does not retry automatically', async () => {
    const createGeneralComment = vi.fn().mockRejectedValue(new AppError('timed out', 'timeout'));
    const listConversations = vi
      .fn()
      .mockResolvedValue({ items: [], page: { page: 1, perPage: 100, hasNextPage: false } });
    const service = new ReviewService(provider({ createGeneralComment, listConversations }));
    await expect(service.createGeneral(context, 'hello')).rejects.toMatchObject({
      code: 'unknown',
    });
    expect(createGeneralComment).toHaveBeenCalledTimes(1);
    expect(listConversations).toHaveBeenCalled();
    await expect(service.createGeneral(context, 'hello')).rejects.toMatchObject({
      code: 'operation-not-allowed',
    });
    expect(createGeneralComment).toHaveBeenCalledTimes(1);
    await service.reconcile(context);
    createGeneralComment.mockResolvedValue({ id: 'comment-2' } as never);
    await service.createGeneral(context, 'hello');
    expect(createGeneralComment).toHaveBeenCalledTimes(2);
  });

  it('requires explicit confirmation and a matching fresh head before merging', async () => {
    const p = provider();
    const service = new ReviewService(p);
    await expect(
      Promise.resolve().then(() => service.merge(context, 'head-1', false)),
    ).rejects.toMatchObject({ code: 'operation-not-allowed' });
    await expect(service.merge(context, 'old-head', true)).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(p.merge).not.toHaveBeenCalled();
    await expect(service.merge(context, 'head-1', true)).resolves.toMatchObject({ merged: true });
  });

  it.each(['baseSha', 'startSha', 'headSha'] as const)(
    'rejects GitLab inline comments when refreshed %s changed',
    async (changed) => {
      const displayed = {
        repositoryId: 'repo',
        reviewRequestId: '17',
        headSha: 'head-1',
        diffVersion: { baseSha: 'base-1', startSha: 'start-1', headSha: 'head-1' },
      };
      const freshVersion = {
        ...displayed.diffVersion,
        [changed]: `${displayed.diffVersion[changed]}-new`,
      };
      const p = provider({
        provider: 'gitlab',
        listChangedFiles: vi.fn().mockResolvedValue({ ...files, diffVersion: freshVersion }),
      });
      const service = new ReviewService(p);
      await expect(
        service.createInline(displayed, 'comment', { path: 'src/a.ts', side: 'new', line: 1 }),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(p.createInlineComment).not.toHaveBeenCalled();
    },
  );

  it('rederives rename paths and refuses a line that is not in the parsed diff', async () => {
    const p = provider({
      listChangedFiles: vi.fn().mockResolvedValue({
        ...files,
        items: [
          {
            path: 'new.ts',
            previousPath: 'old.ts',
            change: 'renamed',
            patch: '@@ -4,2 +4,2 @@\n keep\n-old\n+new',
          },
        ],
      }),
    });
    const service = new ReviewService(p);
    await service.createInline(context, 'comment', { path: 'old.ts', side: 'new', line: 5 });
    expect(p.createInlineComment).toHaveBeenCalledWith(
      expect.objectContaining({
        position: expect.objectContaining({
          path: 'new.ts',
          oldPath: 'old.ts',
          newPath: 'new.ts',
          line: 5,
          newLine: 5,
        }),
      }),
    );
    await service.createInline(context, 'context comment', {
      path: 'old.ts',
      side: 'new',
      line: 4,
    });
    expect(p.createInlineComment).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: expect.objectContaining({ line: 4, oldLine: 4, newLine: 4 }),
      }),
    );
    await expect(
      service.createInline(context, 'comment', { path: 'old.ts', side: 'new', line: 99 }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(p.createInlineComment).toHaveBeenCalledTimes(2);
  });

  it('expands exact pinned file content and canonicalizes an old-side GitHub context line', async () => {
    const version = { baseSha: 'base-1', startSha: 'base-1', headSha: 'head-1' };
    const getFileContent = vi.fn(async ({ side }: { side: 'old' | 'new' }) =>
      side === 'old' ? 'one\ntwo\nlater' : 'one\ninserted\ntwo\nlater',
    );
    const p = provider({
      listChangedFiles: vi.fn().mockResolvedValue({
        ...files,
        items: [
          {
            path: 'src/a.ts',
            change: 'modified',
            patch: '@@ -1,2 +1,3 @@\n one\n+inserted\n two',
          },
        ],
        diffVersion: version,
      }),
    }) as ReviewProvider & ReviewFileContentProvider;
    p.getFileContent = getFileContent as ReviewFileContentProvider['getFileContent'];

    await new ReviewService(p).createInline(
      { ...context, diffVersion: version },
      'comment on unchanged context',
      { path: 'src/a.ts', side: 'old', line: 3, oldLine: 3, newLine: 4 },
    );

    expect(getFileContent).toHaveBeenCalledTimes(2);
    expect(
      getFileContent.mock.calls.map(([input]) => [
        input.path,
        input.side,
        input.diffVersion,
        input.baseSha,
      ]),
    ).toEqual([
      ['src/a.ts', 'old', version, 'base-1'],
      ['src/a.ts', 'new', version, 'base-1'],
    ]);
    expect(p.createInlineComment).toHaveBeenCalledWith(
      expect.objectContaining({
        position: {
          path: 'src/a.ts',
          oldPath: 'src/a.ts',
          newPath: 'src/a.ts',
          side: 'new',
          line: 4,
          oldLine: 3,
          newLine: 4,
        },
      }),
    );
  });

  it('keeps both exact line numbers for an expanded GitLab context position', async () => {
    const version = { baseSha: 'base-1', startSha: 'start-1', headSha: 'head-1' };
    const p = provider({
      provider: 'gitlab',
      listChangedFiles: vi.fn().mockResolvedValue({
        ...files,
        items: [
          {
            path: 'src/a.ts',
            change: 'modified',
            patch: '@@ -1,2 +1,3 @@\n one\n+inserted\n two',
          },
        ],
        diffVersion: version,
      }),
    }) as ReviewProvider & ReviewFileContentProvider;
    p.getFileContent = vi.fn(async ({ side }) =>
      side === 'old' ? 'one\ntwo\nlater' : 'one\ninserted\ntwo\nlater',
    );

    await new ReviewService(p).createInline(
      { ...context, diffVersion: version },
      'comment on unchanged context',
      { path: 'src/a.ts', side: 'old', line: 3, oldLine: 3, newLine: 4 },
    );

    expect(p.createInlineComment).toHaveBeenCalledWith(
      expect.objectContaining({
        position: {
          path: 'src/a.ts',
          oldPath: 'src/a.ts',
          newPath: 'src/a.ts',
          side: 'old',
          line: 3,
          oldLine: 3,
          newLine: 4,
        },
      }),
    );
  });

  it('rejects expanded context positions when the exact full blobs do not match the current patch', async () => {
    const version = { baseSha: 'base-1', startSha: 'base-1', headSha: 'head-1' };
    const p = provider({
      listChangedFiles: vi.fn().mockResolvedValue({
        ...files,
        items: [
          {
            path: 'src/a.ts',
            change: 'modified',
            patch: '@@ -1,1 +1,1 @@\n-old\n+new',
          },
        ],
        diffVersion: version,
      }),
    }) as ReviewProvider & ReviewFileContentProvider;
    p.getFileContent = vi.fn(async ({ side }) => (side === 'old' ? 'wrong old' : 'wrong new'));

    await expect(
      new ReviewService(p).createInline({ ...context, diffVersion: version }, 'comment', {
        path: 'src/a.ts',
        side: 'new',
        line: 2,
        oldLine: 2,
        newLine: 2,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(p.createInlineComment).not.toHaveBeenCalled();
  });

  it('rejects files whose diff version changes between pages', async () => {
    const displayed = {
      repositoryId: 'repo',
      reviewRequestId: '17',
      headSha: 'head-1',
      diffVersion: { baseSha: 'base', startSha: 'start', headSha: 'head-1' },
    };
    const listChangedFiles = vi
      .fn()
      .mockResolvedValueOnce({
        ...files,
        page: { page: 1, perPage: 1, hasNextPage: true },
        diffVersion: displayed.diffVersion,
      })
      .mockResolvedValueOnce({
        ...files,
        page: { page: 2, perPage: 1, hasNextPage: false },
        diffVersion: { ...displayed.diffVersion, startSha: 'changed' },
      });
    const p = provider({ provider: 'gitlab', listChangedFiles });
    await expect(
      new ReviewService(p).createInline(displayed, 'comment', {
        path: 'src/a.ts',
        side: 'new',
        line: 1,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(p.createInlineComment).not.toHaveBeenCalled();
  });

  it('rejects replies to GitHub issue comments and replies to replies', async () => {
    const conversation = (
      resourceType: ReviewConversation['resourceType'],
      extra: Partial<ReviewConversation> = {},
    ): ReviewConversation => ({
      id: 'conversation',
      provider: 'github',
      resourceType,
      author: { id: 'u1', login: 'reviewer' },
      body: 'body',
      createdAt: '',
      replies: [],
      ...extra,
    });
    const listConversations = vi.fn().mockResolvedValue({
      items: [conversation('github-issue-comment')],
      page: { page: 1, perPage: 100, hasNextPage: false },
    });
    const p = provider({ listConversations });
    const service = new ReviewService(p);
    await expect(service.reply(context, 'conversation', 'reply')).rejects.toMatchObject({
      code: 'unsupported-capability',
    });
    listConversations.mockResolvedValue({
      items: [conversation('github-review-comment', { replyToId: 'root' })],
      page: { page: 1, perPage: 100, hasNextPage: false },
    });
    await expect(service.reply(context, 'conversation', 'reply')).rejects.toMatchObject({
      code: 'unsupported-capability',
    });
    expect(p.replyToConversation).not.toHaveBeenCalled();
  });
});

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ApprovalState,
  CheckSummary,
  DiffFilePage,
  MetadataOptionKind,
  ProviderCapabilityDescriptor,
  ProviderUser,
  ReviewCommit,
  ReviewConversation,
} from '../../src/domain/models';
import type {
  WebviewMessage,
  WebviewRequest,
} from '../../src/presentation/webview/messageProtocol';
import {
  ChangesPanel,
  type ChangesPanelState,
  type MarkdownFileContent,
} from './components/ChangesPanel';
import './styles.css';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewRequest): void;
  getState(): unknown;
  setState(state: unknown): void;
};
declare global {
  interface Window {
    reviewDockContextId: string;
  }
}
const vscode = acquireVsCodeApi();
type Init = Extract<WebviewMessage, { type: 'initialize' }>;
type Notice = Extract<WebviewMessage, { type: 'notice' }>;
const unavailable = (support: string, reason?: string) =>
  support === 'unsupported' || support === 'unknown'
    ? reason || 'Not available on this instance.'
    : undefined;

function App() {
  const [init, setInit] = useState<Init>();
  const [files, setFiles] = useState<DiffFilePage>();
  const [conversations, setConversations] = useState<ReviewConversation[]>([]);
  const [checks, setChecks] = useState<CheckSummary[]>();
  const [approvals, setApprovals] = useState<ApprovalState>();
  const [tab, setTab] = useState<
    'overview' | 'changes' | 'conversations' | 'checks' | 'approvals' | 'commits'
  >('overview');
  const [notice, setNotice] = useState<Notice>();
  const [busy, setBusy] = useState<string>();
  const [mutationUncertain, setMutationUncertain] = useState(false);
  const [comment, setComment] = useState('');
  const [inline, setInline] = useState<{
    path: string;
    side: 'old' | 'new';
    line: number;
    oldLine?: number;
    newLine?: number;
  }>();
  const [needsReanchor, setNeedsReanchor] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyFor, setReplyFor] = useState<string>();
  const [replyDraft, setReplyDraft] = useState('');
  const [metadataEditing, setMetadataEditing] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState<{
    title: string;
    description: string;
    assigneeIds: string[];
    reviewerIds: string[];
    labels: string[];
  }>();
  const [metadataOptions, setMetadataOptions] = useState<
    Partial<Record<MetadataOptionKind, (ProviderUser | string)[]>>
  >({});
  const [metadataOptionPages, setMetadataOptionPages] = useState<
    Partial<Record<MetadataOptionKind, number>>
  >({});
  const [changesState, setChangesState] = useState<Partial<ChangesPanelState>>(() => {
    const state = vscode.getState() as { changesState?: Partial<ChangesPanelState> } | undefined;
    return state?.changesState ?? {};
  });
  const [fileContent, setFileContent] = useState<Record<string, MarkdownFileContent>>({});
  const [commits, setCommits] = useState<ReviewCommit[]>([]);
  const [commitsPage, setCommitsPage] = useState<{ hasNextPage: boolean }>({ hasNextPage: false });
  const [commitsLoaded, setCommitsLoaded] = useState(false);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string>();
  const [conversationPage, setConversationPage] = useState<{ hasNextPage: boolean }>({
    hasNextPage: false,
  });
  const latestResults = useRef<Record<string, number>>({});
  const inlineTrigger = useRef<HTMLElement | null>(null);
  const inlineEditor = useRef<HTMLTextAreaElement>(null);
  const inlineDialog = useRef<HTMLFormElement>(null);
  const metadataDialog = useRef<HTMLFormElement>(null);
  const replyEditor = useRef<HTMLTextAreaElement>(null);
  const contextId = init?.contextId ?? window.reviewDockContextId;
  const post = (message: Record<string, unknown>) =>
    vscode.postMessage({ ...message, contextId } as WebviewRequest);

  useEffect(() => {
    const onMessage = (event: MessageEvent<WebviewMessage>) => {
      const message = event.data;
      if (message.type === 'initialize') {
        setInit(message);
        setFiles(undefined);
        setConversations([]);
        setConversationPage({ hasNextPage: false });
        setChecks(undefined);
        setApprovals(undefined);
        latestResults.current = {};
        setInline(undefined);
        setMetadataEditing(false);
        setMetadataDraft(undefined);
        setMetadataOptions({});
        setMetadataOptionPages({});
        setFileContent({});
        setCommits([]);
        setCommitsPage({ hasNextPage: false });
        setCommitsLoaded(false);
        setCommitsLoading(false);
        setCommitsError(undefined);
      }
      if (message.type === 'files' && message.requestId >= (latestResults.current.files ?? 0)) {
        latestResults.current.files = message.requestId;
        setFiles(message.result);
      }
      if (
        message.type === 'conversations' &&
        message.requestId >= (latestResults.current.conversations ?? 0)
      ) {
        latestResults.current.conversations = message.requestId;
        setConversations(message.result.items);
        setConversationPage({ hasNextPage: message.result.page.hasNextPage });
      }
      if (message.type === 'checks' && message.requestId >= (latestResults.current.checks ?? 0)) {
        latestResults.current.checks = message.requestId;
        setChecks(message.result);
      }
      if (
        message.type === 'approvals' &&
        message.requestId >= (latestResults.current.approvals ?? 0)
      ) {
        latestResults.current.approvals = message.requestId;
        setApprovals(message.result);
      }
      if (message.type === 'metadataOptions') {
        const key = `metadata-${message.kind}`;
        if (message.requestId >= (latestResults.current[key] ?? 0)) {
          latestResults.current[key] = message.requestId;
          setMetadataOptions((current) => ({
            ...current,
            [message.kind]:
              message.result.page.page > 1
                ? [...(current[message.kind] ?? []), ...message.result.items]
                : message.result.items,
          }));
          setMetadataOptionPages((current) => ({
            ...current,
            [message.kind]: message.result.page.hasNextPage
              ? message.result.page.page + 1
              : undefined,
          }));
        }
      }
      if (message.type === 'markdownContent') {
        setFileContent((current) => ({
          ...current,
          [message.path]: {
            ...(message.oldContent === undefined ? {} : { oldContent: message.oldContent }),
            ...(message.newContent === undefined ? {} : { newContent: message.newContent }),
            ...(message.oldContent === undefined && message.error
              ? { oldError: message.error }
              : {}),
            ...(message.newContent === undefined && message.error
              ? { newError: message.error }
              : {}),
          },
        }));
      }
      if (message.type === 'commits' && message.requestId >= (latestResults.current.commits ?? 0)) {
        latestResults.current.commits = message.requestId;
        setCommitsLoading(false);
        setCommitsLoaded(!!message.result);
        setCommitsError(message.error);
        if (message.result) {
          setCommits(message.result.items);
          setCommitsPage({ hasNextPage: message.result.page.hasNextPage });
        }
      }
      if (message.type === 'mutationState') setMutationUncertain(message.uncertain);
      if (message.type === 'busy') setBusy(message.busy ? message.action : undefined);
      if (message.type === 'notice') {
        setNotice(message);
        if (message.level === 'success') {
          setDraft('');
          setComment('');
          setReplyDraft('');
          setReplyFor(undefined);
          setInline(undefined);
          setMetadataEditing(false);
          setMetadataDraft(undefined);
        }
      }
      if (message.type === 'stale') {
        setNotice({ type: 'notice', level: 'warning', message: message.message });
        setNeedsReanchor(true);
      }
      if (message.type === 'merged')
        setNotice({ type: 'notice', level: 'success', message: message.message });
    };
    window.addEventListener('message', onMessage);
    const onMarkdownLink = (event: Event) => {
      const url = (event as CustomEvent<unknown>).detail;
      if (typeof url === 'string') post({ type: 'openLink', url });
    };
    window.addEventListener('reviewdock:open-link', onMarkdownLink);
    post({ type: 'ready' });
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('reviewdock:open-link', onMarkdownLink);
    };
  }, []);

  const detail = init?.detail;
  const title = detail ? detail.author.name || detail.author.login : '';
  const requestLabel =
    init?.providerName === 'GitHub' ? `PR #${detail?.number}` : `!${detail?.number}`;
  const fileCount = files?.items.length ?? 0;
  const canEditMetadata = ['supported', 'conditional'].includes(
    init?.capabilities.editMetadata?.support ?? 'unsupported',
  );
  const beginMetadataEdit = () => {
    if (!detail || !canEditMetadata) return;
    setMetadataDraft({
      title: detail.title,
      description: detail.description ?? '',
      assigneeIds: detail.assignees?.map((user) => user.id) ?? [],
      reviewerIds: detail.reviewers?.map((user) => user.id) ?? [],
      labels: detail.labels ?? [],
    });
    setMetadataEditing(true);
    setMetadataOptionPages({ assignees: 1, reviewers: 1, labels: 1 });
    (['assignees', 'reviewers', 'labels'] as const).forEach((kind) =>
      post({ type: 'listMetadataOptions', kind, page: 1 }),
    );
  };
  const saveMetadata = (event: FormEvent) => {
    event.preventDefault();
    if (!metadataDraft || !detail || mutationUncertain || busy) return;
    const patch: Record<string, unknown> = {};
    if (metadataDraft.title !== detail.title) patch.title = metadataDraft.title;
    if (metadataDraft.description !== (detail.description ?? ''))
      patch.description = metadataDraft.description;
    if (
      detail.assignees &&
      JSON.stringify(metadataDraft.assigneeIds) !==
        JSON.stringify(detail.assignees.map((user) => user.id))
    )
      patch.assigneeIds = metadataDraft.assigneeIds;
    if (
      detail.reviewers &&
      JSON.stringify(metadataDraft.reviewerIds) !==
        JSON.stringify(detail.reviewers.map((user) => user.id))
    )
      patch.reviewerIds = metadataDraft.reviewerIds;
    if (detail.labels && JSON.stringify(metadataDraft.labels) !== JSON.stringify(detail.labels))
      patch.labels = metadataDraft.labels;
    if (Object.keys(patch).length) {
      post({ type: 'editMetadata', ...patch });
      setBusy('metadata');
    }
  };
  const loadMoreMetadataOptions = (kind: MetadataOptionKind) => {
    const page = metadataOptionPages[kind];
    if (page) post({ type: 'listMetadataOptions', kind, page });
  };
  const loadMarkdownContent = (path: string) => {
    setFileContent((current) => ({ ...current, [path]: { loading: true } }));
    post({ type: 'loadMarkdownContent', path });
  };
  const deleteComment = (conversationId: string, commentId?: string) => {
    if (busy || mutationUncertain) return;
    post({ type: 'deleteComment', conversationId, ...(commentId ? { commentId } : {}) });
    setBusy('deleteComment');
  };
  const setResolved = (conversationId: string, resolved: boolean) => {
    if (busy || mutationUncertain) return;
    post({ type: 'setThreadResolved', conversationId, resolved });
    setBusy('resolveThread');
  };
  const renderDiscussion = (item: ReviewConversation) => (
    <InlineDiscussion
      key={item.id}
      item={item}
      canReply={canReply(item, init!.capabilities.replyByResource)}
      onReply={() => setReplyFor(item.id)}
      canDelete={canDeleteConversation(item, init!)}
      onDelete={(commentId) => deleteComment(item.id, commentId)}
      canResolve={canResolveConversation(item, init!.capabilities)}
      onResolve={(resolved) => setResolved(item.id, resolved)}
      {...(init!.accountId ? { accountId: init!.accountId } : {})}
      accountLogin={init!.accountLogin}
      deleteCapabilities={init!.capabilities.deleteByResource ?? {}}
      disabled={!!busy || mutationUncertain}
      {...(replyFor ? { replyFor } : {})}
      replyDraft={replyDraft}
      replyPending={busy === 'reply'}
      replyEditor={replyEditor}
      onReplyDraftChange={setReplyDraft}
      onCancelReply={() => setReplyFor(undefined)}
      onSubmitReply={(event) => {
        event.preventDefault();
        if (mutationUncertain || !replyDraft.trim() || busy) return;
        post({ type: 'reply', conversationId: item.id, body: replyDraft });
        setBusy('reply');
      }}
    />
  );
  const selectTab = (next: typeof tab) => {
    setTab(next);
    if (next === 'commits') {
      setCommitsLoading(true);
      setCommitsError(undefined);
    }
    post({ type: 'selectTab', tab: next });
  };
  const submit = (event: FormEvent, type: 'addGeneralComment' | 'addInlineComment' | 'reply') => {
    event.preventDefault();
    if (mutationUncertain) return;
    if (!draft.trim() && type !== 'addGeneralComment') return;
    if (type === 'addGeneralComment') {
      if (!comment.trim()) return;
      post({ type, body: comment });
    }
    if (type === 'addInlineComment' && inline) post({ type, body: draft, position: inline });
    setBusy(type);
  };
  const groups = useMemo(() => conversations, [conversations]);

  useEffect(() => {
    if (inline) inlineEditor.current?.focus();
    else inlineTrigger.current?.focus();
  }, [inline]);
  useEffect(() => {
    if (metadataEditing) metadataDialog.current?.querySelector<HTMLElement>('input')?.focus();
  }, [metadataEditing]);
  useEffect(() => {
    if (!replyFor) return;
    const editor = replyEditor.current;
    editor?.closest('.reply-composer')?.scrollIntoView?.({ block: 'nearest' });
    editor?.focus();
  }, [replyFor]);

  if (!init || !detail)
    return (
      <main className="loading">
        {notice ? (
          <div className={`notice ${notice.level}`} role="alert">
            {notice.message}
            <button onClick={() => post({ type: 'refresh' })}>Retry</button>
          </div>
        ) : (
          <>
            <span className="spinner" /> Loading review request…
          </>
        )}
      </main>
    );
  return (
    <main>
      <header className="request-header">
        <div className="identity">
          <span className="provider">{init.providerName}</span>
          <span>{init.connectionName}</span>
          <span>{init.accountLogin ? `@${init.accountLogin}` : 'Account unavailable'}</span>
          <span>{init.serverHost}</span>
          <span>{init.repositoryName}</span>
          <span>{requestLabel}</span>
        </div>
        <div className="headline">
          <div>
            <h1>{detail.title}</h1>
            <p>
              {title} · {detail.sourceBranch} → {detail.targetBranch} · Updated{' '}
              {new Date(detail.updatedAt).toLocaleString()}
            </p>
          </div>
          <div className="header-actions">
            <button onClick={() => post({ type: 'openExternal' })}>Open on provider</button>
            {detail.state === 'open' && (
              <button
                className="primary"
                title={
                  !detail.headSha
                    ? 'Current source SHA is unavailable'
                    : init.capabilities.merge.reason || ''
                }
                disabled={
                  !!busy ||
                  mutationUncertain ||
                  !detail.headSha ||
                  init.capabilities.merge.support === 'unsupported' ||
                  init.capabilities.merge.support === 'unknown'
                }
                onClick={() => post({ type: 'merge', expectedHeadSha: detail.headSha || '' })}
              >
                {busy === 'merge' ? 'Merging…' : 'Merge'}
              </button>
            )}
          </div>
        </div>
        {notice && (
          <div className={`notice ${notice.level}`} role="status">
            {notice.message}
            <button aria-label="Dismiss" onClick={() => setNotice(undefined)}>
              ×
            </button>
          </div>
        )}
        <div className="request-statuses" aria-label="Review request status">
          <span className={`request-status ${detail.state}`}>
            {detail.state === 'open'
              ? 'Open'
              : detail.state === 'merged'
                ? 'Merged'
                : detail.state === 'closed'
                  ? 'Closed'
                  : 'Status unknown'}
          </span>
          {detail.draft && <span className="request-status draft">Draft</span>}
        </div>
      </header>
      <nav className="tabs" aria-label="Review request sections">
        {(['overview', 'changes', 'conversations', 'checks', 'approvals', 'commits'] as const).map(
          (name) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => selectTab(name)}
            >
              {name === 'commits'
                ? `Commits ${commits.length || ''}`
                : name === 'changes'
                  ? `Changes ${fileCount || ''}`
                  : name === 'conversations'
                    ? `Conversations ${conversations.length || ''}`
                    : name.slice(0, 1).toUpperCase() + name.slice(1)}
            </button>
          ),
        )}
      </nav>
      {tab === 'overview' && (
        <section className="content overview">
          <article className="card">
            <div className="section-title">
              <h2>Description</h2>
              {canEditMetadata && <button onClick={beginMetadataEdit}>Edit review details</button>}
            </div>
            {detail.description ? (
              <Markdown text={detail.description} />
            ) : (
              <p className="muted">No description provided.</p>
            )}
          </article>
          <article className="card">
            <h2>Review information</h2>
            <dl>
              <dt>Author</dt>
              <dd>{detail.author.login}</dd>
              <dt>Assignees</dt>
              <dd>
                {detail.assignees === undefined
                  ? 'Unavailable'
                  : detail.assignees.length
                    ? detail.assignees.map((x) => x.login).join(', ')
                    : 'None'}
              </dd>
              <dt>Reviewers</dt>
              <dd>
                {detail.reviewers === undefined
                  ? 'Unavailable'
                  : detail.reviewers.length
                    ? detail.reviewers.map((x) => x.login).join(', ')
                    : 'None'}
              </dd>
              <dt>Labels</dt>
              <dd>
                {detail.labels === undefined
                  ? 'Unavailable'
                  : detail.labels.length
                    ? detail.labels.map((x) => (
                        <span className="chip" key={x}>
                          {x}
                        </span>
                      ))
                    : 'None'}
              </dd>
            </dl>
          </article>
          <article className="card">
            <h2>Change summary</h2>
            {detail.changedFiles === undefined &&
            detail.additions === undefined &&
            detail.deletions === undefined &&
            detail.commitsCount === undefined ? (
              <p className="muted">Unavailable</p>
            ) : (
              <p>
                {detail.changedFiles === undefined
                  ? 'File count unavailable'
                  : `${detail.changedFiles} files`}{' '}
                ·{' '}
                {detail.additions === undefined ? 'Additions unavailable' : `+${detail.additions}`}{' '}
                ·{' '}
                {detail.deletions === undefined ? 'Deletions unavailable' : `−${detail.deletions}`}
                {detail.commitsCount === undefined ? '' : ` · ${detail.commitsCount} commits`}
              </p>
            )}
          </article>
          <article className="card">
            <h2>Merge status</h2>
            <p>
              {detail.mergeStatus ||
                (detail.mergeable == null
                  ? 'Status not available'
                  : detail.mergeable
                    ? 'Mergeable'
                    : 'Not mergeable')}
            </p>
            <p className="muted">The provider checks merge eligibility when you submit.</p>
          </article>
        </section>
      )}
      {tab === 'changes' && (
        <ChangesPanel
          files={files}
          conversations={conversations}
          canComment={['supported', 'conditional'].includes(
            init.capabilities.inlineComments.support,
          )}
          replyCapabilities={init.capabilities.replyByResource}
          contentByPath={fileContent}
          stale={needsReanchor}
          initialState={changesState}
          onStateChange={(state) => {
            setChangesState(state);
            vscode.setState({ changesState: state });
          }}
          onLoadContent={loadMarkdownContent}
          renderDiscussion={renderDiscussion}
          onComment={(position) => {
            inlineTrigger.current = document.activeElement as HTMLElement;
            setInline(position);
            setNeedsReanchor(false);
          }}
          onReply={(id) => setReplyFor(id)}
          onRefresh={() => post({ type: 'refresh' })}
          onLoadMore={() => post({ type: 'loadMoreFiles' })}
        />
      )}
      {tab === 'conversations' && (
        <section className="content">
          {!['supported', 'conditional'].includes(init.capabilities.generalComments.support) && (
            <Unavailable
              message={
                init.capabilities.generalComments.reason ||
                'General comments are not available for this request.'
              }
            />
          )}{' '}
          {['supported', 'conditional'].includes(init.capabilities.generalComments.support) && (
            <form
              className="card composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim() || mutationUncertain) return;
                post({ type: 'addGeneralComment', body: comment });
                setBusy('general');
              }}
            >
              <label htmlFor="general-comment">Add a general comment</label>
              <textarea
                disabled={
                  !['supported', 'conditional'].includes(init.capabilities.generalComments.support)
                }
                id="general-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment…"
              />
              <button
                className="primary"
                disabled={
                  !!busy ||
                  mutationUncertain ||
                  !comment.trim() ||
                  !['supported', 'conditional'].includes(init.capabilities.generalComments.support)
                }
              >
                {busy === 'general' ? 'Sending…' : 'Comment'}
              </button>
            </form>
          )}
          {groups.map((item) => renderDiscussion(item))}
          {conversationPage.hasNextPage && (
            <button onClick={() => post({ type: 'loadMoreConversations' })}>
              Load more conversations
            </button>
          )}
          {!groups.length && <div className="empty card">No conversations loaded yet.</div>}
        </section>
      )}
      {tab === 'checks' && (
        <section className="content">
          {unavailable(init.capabilities.checks.support, init.capabilities.checks.reason) ? (
            <Unavailable
              message={unavailable(
                init.capabilities.checks.support,
                init.capabilities.checks.reason,
              )}
            />
          ) : checks === undefined ? (
            <div className="empty card">Loading checks…</div>
          ) : checks.length === 0 ? (
            <div className="empty card">
              <h2>No checks reported</h2>
              <p>No checks were returned for this review request’s current head.</p>
            </div>
          ) : (
            checks.map((check) => (
              <article className="card check" key={check.id}>
                <strong>{check.name}</strong>
                <span>
                  {check.status}
                  {check.conclusion ? ` · ${check.conclusion}` : ''}
                </span>
                <span className="muted">
                  {check.source || 'Source unknown'}
                  {check.headSha
                    ? ` · ${check.headSha === detail.headSha ? 'current head' : 'stale head'}`
                    : ' · commit unknown'}
                </span>
                {check.detailsUrl && (
                  <button onClick={() => post({ type: 'openCheck', checkId: check.id })}>
                    Open details
                  </button>
                )}
              </article>
            ))
          )}
        </section>
      )}
      {tab === 'approvals' && (
        <section className="content">
          <Unavailable
            message={unavailable(
              init.capabilities.approvals.support,
              init.capabilities.approvals.reason,
            )}
          />
          {!unavailable(init.capabilities.approvals.support, init.capabilities.approvals.reason) &&
            (approvals ? (
              <article className="card">
                <h2>Approval status</h2>
                <p>
                  {approvals.approved == null
                    ? 'Approval state unknown'
                    : approvals.approved
                      ? 'Approved'
                      : 'Not approved'}
                </p>
                <p>
                  {approvals.approvalsLeft == null
                    ? 'Required approval count unavailable'
                    : `${approvals.approvalsLeft} approvals remaining`}
                </p>
                <p>
                  {approvals.userHasApproved == null
                    ? 'Your approval status unknown'
                    : approvals.userHasApproved
                      ? 'You approved'
                      : 'You have not approved'}
                </p>
                {approvals.approvedBy && approvals.approvedBy.length > 0 && (
                  <p>Approved by: {approvals.approvedBy.map((x) => x.login).join(', ')}</p>
                )}
              </article>
            ) : (
              <div className="empty card">Loading approvals…</div>
            ))}
        </section>
      )}
      {tab === 'commits' && (
        <section className="content commits" aria-label="Commits">
          {unavailable(
            init.capabilities.commits?.support ?? 'unknown',
            init.capabilities.commits?.reason,
          ) ? (
            <Unavailable
              message={unavailable(
                init.capabilities.commits?.support ?? 'unknown',
                init.capabilities.commits?.reason,
              )}
            />
          ) : commitsError ? (
            <div className="empty card" role="alert">
              <p>{commitsError}</p>
              <button onClick={() => selectTab('commits')}>Retry commits</button>
            </div>
          ) : commitsLoading && !commitsLoaded ? (
            <div className="empty card">Loading commits…</div>
          ) : !commits.length ? (
            <div className="empty card">
              <h2>No commits found</h2>
              <p>This review request has no commits to display.</p>
            </div>
          ) : (
            <>
              {commits.map((commit) => {
                const shortSha = commit.sha.slice(0, 7);
                return (
                  <article className="card commit" key={commit.id}>
                    <div className="commit-heading">
                      <strong>
                        {commit.message.split('\n')[0] || 'Commit message unavailable'}
                      </strong>
                      <button
                        aria-label={`Open commit ${shortSha} on provider`}
                        onClick={() => post({ type: 'openCommit', commitId: commit.id })}
                      >
                        Open commit {shortSha}
                      </button>
                    </div>
                    <p className="commit-message">{commit.message}</p>
                    <p className="muted commit-meta">
                      {commit.author?.name ||
                        commit.author?.login ||
                        commit.authorName ||
                        'Author unavailable'}
                      {commit.authoredAt || commit.committedAt
                        ? ` · ${new Date(commit.authoredAt ?? commit.committedAt!).toLocaleString()}`
                        : ' · Date unavailable'}
                      {' · '}
                      {commit.sha}
                    </p>
                  </article>
                );
              })}
              {commitsPage.hasNextPage && (
                <button
                  disabled={commitsLoading}
                  onClick={() => {
                    setCommitsLoading(true);
                    setCommitsError(undefined);
                    post({ type: 'loadMoreCommits' });
                  }}
                >
                  {commitsLoading ? 'Loading more commits…' : 'Load more commits'}
                </button>
              )}
              {commitsError && (
                <div className="notice error" role="alert">
                  {commitsError}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {metadataEditing && metadataDraft && (
        <div className="modal-backdrop" role="presentation">
          <form
            ref={metadataDialog}
            className="modal metadata-editor composer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="metadata-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setMetadataEditing(false);
              }
              if (event.key === 'Tab') {
                const controls = metadataDialog.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
                );
                if (!controls?.length) return;
                const first = controls[0]!;
                const last = controls[controls.length - 1]!;
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
            onSubmit={saveMetadata}
          >
            <h2 id="metadata-title">Edit review details</h2>
            <label htmlFor="review-title">Title</label>
            <input
              id="review-title"
              value={metadataDraft.title}
              onChange={(event) =>
                setMetadataDraft({ ...metadataDraft, title: event.target.value })
              }
              required
            />
            <label htmlFor="review-description">Description</label>
            <textarea
              id="review-description"
              value={metadataDraft.description}
              onChange={(event) =>
                setMetadataDraft({ ...metadataDraft, description: event.target.value })
              }
            />
            <label htmlFor="review-assignees">
              Assignees{detail.assignees === undefined ? ' (unavailable)' : ''}
            </label>
            <select
              id="review-assignees"
              multiple
              disabled={detail.assignees === undefined}
              value={metadataDraft.assigneeIds}
              onChange={(event) =>
                setMetadataDraft({
                  ...metadataDraft,
                  assigneeIds: [...event.currentTarget.selectedOptions].map(
                    (option) => option.value,
                  ),
                })
              }
            >
              {optionsWithCurrent(
                metadataOptions.assignees,
                detail.assignees?.map((user) => user.id) ?? [],
                detail.assignees?.map((user) => user.login) ?? [],
              ).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {metadataOptionPages.assignees && (
              <button type="button" onClick={() => loadMoreMetadataOptions('assignees')}>
                Load more assignees
              </button>
            )}
            <label htmlFor="review-reviewers">
              Reviewers{detail.reviewers === undefined ? ' (unavailable)' : ''}
            </label>
            <select
              id="review-reviewers"
              multiple
              disabled={detail.reviewers === undefined}
              value={metadataDraft.reviewerIds}
              onChange={(event) =>
                setMetadataDraft({
                  ...metadataDraft,
                  reviewerIds: [...event.currentTarget.selectedOptions].map(
                    (option) => option.value,
                  ),
                })
              }
            >
              {optionsWithCurrent(
                metadataOptions.reviewers,
                detail.reviewers?.map((user) => user.id) ?? [],
                detail.reviewers?.map((user) => user.login) ?? [],
              ).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {metadataOptionPages.reviewers && (
              <button type="button" onClick={() => loadMoreMetadataOptions('reviewers')}>
                Load more reviewers
              </button>
            )}
            <label htmlFor="review-labels">
              Labels{detail.labels === undefined ? ' (unavailable)' : ''}
            </label>
            <select
              id="review-labels"
              multiple
              disabled={detail.labels === undefined}
              value={metadataDraft.labels}
              onChange={(event) =>
                setMetadataDraft({
                  ...metadataDraft,
                  labels: [...event.currentTarget.selectedOptions].map((option) => option.value),
                })
              }
            >
              {optionsWithCurrent(
                metadataOptions.labels,
                detail.labels ?? [],
                detail.labels ?? [],
              ).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {metadataOptionPages.labels && (
              <button type="button" onClick={() => loadMoreMetadataOptions('labels')}>
                Load more labels
              </button>
            )}
            <div className="actions">
              <button type="button" onClick={() => setMetadataEditing(false)}>
                Cancel
              </button>
              <button className="primary" disabled={!!busy || mutationUncertain}>
                {busy === 'metadata' ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </form>
        </div>
      )}
      {inline && (
        <div className="modal-backdrop" role="presentation">
          <form
            ref={inlineDialog}
            className="modal composer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inline-comment-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setInline(undefined);
                setNeedsReanchor(false);
              } else if (event.key === 'Tab') {
                const controls = inlineDialog.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), textarea:not(:disabled)',
                );
                if (!controls?.length) return;
                const first = controls[0]!;
                const last = controls[controls.length - 1]!;
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
            onSubmit={(e) => submit(e, 'addInlineComment')}
          >
            <h2 id="inline-comment-title">
              Comment on {inline.path}:{inline.line}
            </h2>
            <p className="muted">
              {needsReanchor
                ? 'The diff changed. Select a current line before sending; your draft is preserved.'
                : 'Review position on the current diff'}
            </p>
            <textarea
              ref={inlineEditor}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Inline comment"
            />
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  setInline(undefined);
                  setNeedsReanchor(false);
                }}
              >
                Choose another line
              </button>
              <button
                className="primary"
                disabled={!!busy || mutationUncertain || needsReanchor || !draft.trim()}
              >
                {busy === 'addInlineComment' ? 'Sending…' : 'Send comment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function InlineDiscussion({
  item,
  canReply,
  onReply,
  canDelete,
  onDelete,
  canResolve,
  onResolve,
  accountLogin,
  accountId,
  deleteCapabilities,
  disabled,
  replyFor,
  replyDraft,
  replyPending,
  replyEditor,
  onReplyDraftChange,
  onCancelReply,
  onSubmitReply,
}: {
  item: ReviewConversation;
  canReply: boolean;
  onReply: () => void;
  canDelete: boolean;
  onDelete: (commentId?: string) => void;
  canResolve: boolean;
  onResolve: (resolved: boolean) => void;
  accountLogin: string;
  accountId?: string;
  deleteCapabilities: NonNullable<ProviderCapabilityDescriptor['deleteByResource']>;
  disabled: boolean;
  replyFor?: string;
  replyDraft: string;
  replyPending: boolean;
  replyEditor: React.RefObject<HTMLTextAreaElement | null>;
  onReplyDraftChange: (value: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (event: FormEvent) => void;
}) {
  const resolution = !item.threadId
    ? 'Not applicable'
    : item.resolved === undefined || item.resolved === null
      ? 'Unknown'
      : item.resolved
        ? 'Resolved'
        : 'Unresolved';
  return (
    <div className="inline-discussion conversation card">
      <div className="conversation-meta">
        <strong>{item.author.login}</strong>
        <time>{new Date(item.createdAt).toLocaleString()}</time>
        <span>{resolution}</span>
      </div>
      <Markdown text={item.body} />
      {item.replies.map((reply) => (
        <div className="reply" key={reply.id}>
          <strong>{reply.author.login}</strong>
          <time>{new Date(reply.createdAt).toLocaleString()}</time>
          <Markdown text={reply.body} />
          {canDeleteReply(reply, accountId, accountLogin, deleteCapabilities) && (
            <button disabled={disabled} onClick={() => onDelete(reply.id)}>
              Delete reply
            </button>
          )}
        </div>
      ))}
      <div className="conversation-actions">
        {canReply && (
          <button disabled={disabled} onClick={onReply}>
            Reply
          </button>
        )}
        {canDelete && (
          <button disabled={disabled} onClick={() => onDelete()}>
            Delete comment
          </button>
        )}
        {canResolve && (
          <button disabled={disabled} onClick={() => onResolve(!item.resolved)}>
            {item.resolved ? 'Unresolve thread' : 'Resolve thread'}
          </button>
        )}
      </div>
      {replyFor === item.id && (
        <form className="composer reply-composer" onSubmit={onSubmitReply}>
          <label htmlFor={`reply-${item.id}`}>Reply to {item.author.login}</label>
          <textarea
            ref={replyEditor}
            id={`reply-${item.id}`}
            value={replyDraft}
            onChange={(event) => onReplyDraftChange(event.target.value)}
            aria-label="Reply"
          />
          <div className="actions">
            <button type="button" disabled={disabled} onClick={onCancelReply}>
              Cancel
            </button>
            <button className="primary" disabled={disabled || !replyDraft.trim()}>
              {replyPending ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let code: string[] = [];
  let listItems: string[] = [];
  let listKind: 'ul' | 'ol' | undefined;
  let fenced = false;
  const flush = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={`p-${blocks.length}`}>
          {paragraph.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              <InlineMarkdown text={line} />
            </React.Fragment>
          ))}
        </p>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listKind && listItems.length) {
      const Tag = listKind;
      blocks.push(
        <Tag key={`list-${blocks.length}`}>
          {listItems.map((item, index) => (
            <li key={index}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </Tag>,
      );
      listItems = [];
      listKind = undefined;
    }
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      flush();
      flushList();
      if (fenced) {
        blocks.push(
          <pre key={`code-${blocks.length}`}>
            <code>{code.join('\n')}</code>
          </pre>,
        );
        code = [];
      }
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flush();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      flushList();
      blocks.push(
        React.createElement(
          `h${heading[1]!.length}`,
          { key: `h-${blocks.length}` },
          <InlineMarkdown text={heading[2]!} />,
        ),
      );
      continue;
    }
    const item = /^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(line);
    if (item) {
      flush();
      const nextKind = item[2] ? 'ol' : 'ul';
      if (listKind && listKind !== nextKind) flushList();
      listKind = nextKind;
      listItems.push(item[3]!);
      continue;
    }
    flushList();
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      blocks.push(
        <blockquote key={`q-${blocks.length}`}>
          <InlineMarkdown text={quote[1]!} />
        </blockquote>,
      );
      continue;
    }
    paragraph.push(line);
  }
  flush();
  flushList();
  if (code.length)
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join('\n')}</code>
      </pre>,
    );
  return <div className="markdown">{blocks}</div>;
}
function InlineMarkdown({ text }: { text: string }) {
  const chunks = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g);
  return (
    <>
      {chunks.map((chunk, index) => {
        if (/^`[^`]+`$/.test(chunk)) return <code key={index}>{chunk.slice(1, -1)}</code>;
        if (/^\*\*[^*]+\*\*$/.test(chunk)) return <strong key={index}>{chunk.slice(2, -2)}</strong>;
        if (/^\*[^*]+\*$/.test(chunk)) return <em key={index}>{chunk.slice(1, -1)}</em>;
        const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(chunk);
        if (link?.[1] && link[2]) {
          const label = link[1];
          const href = link[2];
          let safe = false;
          try {
            const url = new URL(href);
            safe = url.protocol === 'https:' && !url.username && !url.password;
          } catch {
            safe = false;
          }
          return safe ? (
            <button
              className="markdown-link"
              key={index}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent<string>('reviewdock:open-link', { detail: href }),
                )
              }
            >
              {label}
            </button>
          ) : (
            chunk
          );
        }
        return <React.Fragment key={index}>{chunk}</React.Fragment>;
      })}
    </>
  );
}
function Unavailable({ message }: { message: string | undefined }) {
  return message ? <div className="empty card">{message}</div> : null;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

function canReply(
  item: ReviewConversation,
  capabilities: ProviderCapabilityDescriptor['replyByResource'],
): boolean {
  if (
    item.resourceType === 'github-issue-comment' ||
    item.resourceType === 'github-review' ||
    (item.provider === 'github' && (item.parentId || item.replyToId))
  )
    return false;
  const support = capabilities[item.resourceType]?.support;
  return support === 'supported' || support === 'conditional';
}

function canDeleteConversation(item: ReviewConversation, init: Init): boolean {
  const capability = init.capabilities.deleteByResource?.[item.resourceType]?.support;
  return (
    !item.systemNote &&
    item.resourceType !== 'github-review' &&
    (init.accountId
      ? item.author.id === init.accountId
      : item.author.login === init.accountLogin) &&
    (capability === 'supported' || capability === 'conditional')
  );
}

function canDeleteReply(
  reply: ReviewConversation['replies'][number],
  accountId: string | undefined,
  accountLogin: string,
  capabilities: NonNullable<ProviderCapabilityDescriptor['deleteByResource']>,
): boolean {
  const capability = capabilities[reply.resourceType]?.support;
  return (
    (accountId ? reply.author.id === accountId : reply.author.login === accountLogin) &&
    (capability === 'supported' || capability === 'conditional')
  );
}

function canResolveConversation(
  item: ReviewConversation,
  capabilities: ProviderCapabilityDescriptor,
): boolean {
  const support = capabilities.resolveThreads.support;
  const permissionKnown =
    item.provider === 'github'
      ? item.resolved
        ? item.canUnresolve === true
        : item.canResolve === true
      : typeof item.resolved === 'boolean';
  return (
    !!item.threadId &&
    !item.parentId &&
    !item.replyToId &&
    !item.systemNote &&
    item.resourceType !== 'github-issue-comment' &&
    item.resourceType !== 'github-review' &&
    (support === 'supported' || support === 'conditional') &&
    permissionKnown
  );
}

function optionsWithCurrent(
  options: (ProviderUser | string)[] | undefined,
  currentIds: string[],
  currentLabels: string[],
): { id: string; label: string }[] {
  const result = new Map<string, string>();
  options?.forEach((option) => {
    if (typeof option === 'string') result.set(option, option);
    else result.set(option.id, option.login);
  });
  currentIds.forEach((id, index) => {
    if (!result.has(id)) result.set(id, currentLabels[index] ?? id);
  });
  return [...result].map(([id, label]) => ({ id, label }));
}

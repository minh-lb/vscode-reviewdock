import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ApprovalState,
  CheckSummary,
  DiffFilePage,
  ProviderCapabilityDescriptor,
  ReviewConversation,
} from '../../src/domain/models';
import { parseUnifiedDiff } from '../../src/domain/diff';
import type {
  WebviewMessage,
  WebviewRequest,
} from '../../src/presentation/webview/messageProtocol';
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
  const [tab, setTab] = useState<'overview' | 'changes' | 'conversations' | 'checks' | 'approvals'>(
    'overview',
  );
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
  const [conversationPage, setConversationPage] = useState<{ hasNextPage: boolean }>({
    hasNextPage: false,
  });
  const latestResults = useRef<Record<string, number>>({});
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
      if (message.type === 'mutationState') setMutationUncertain(message.uncertain);
      if (message.type === 'busy') setBusy(message.busy ? message.action : undefined);
      if (message.type === 'notice') {
        setNotice(message);
        if (message.level === 'success') {
          setDraft('');
          setComment('');
          setReplyDraft('');
          setInline(undefined);
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
  const selectTab = (next: typeof tab) => {
    setTab(next);
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
        {detail.state !== 'open' && (
          <p className="state-label">
            {detail.state === 'merged'
              ? 'Merged'
              : detail.state === 'closed'
                ? 'Closed'
                : 'State unknown'}
          </p>
        )}
      </header>
      <nav className="tabs" aria-label="Review request sections">
        {(['overview', 'changes', 'conversations', 'checks', 'approvals'] as const).map((name) => (
          <button
            key={name}
            className={tab === name ? 'active' : ''}
            aria-current={tab === name ? 'page' : undefined}
            onClick={() => selectTab(name)}
          >
            {name === 'changes'
              ? `Changes ${fileCount || ''}`
              : name === 'conversations'
                ? `Conversations ${conversations.length || ''}`
                : name.slice(0, 1).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <section className="content overview">
          <article className="card">
            <h2>Description</h2>
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
        <section className="content changes">
          <div className="file-list">
            <div className="section-title">
              <h2>Files ({fileCount})</h2>
              <button onClick={() => post({ type: 'refresh' })}>Refresh</button>
            </div>
            {files?.truncated && (
              <p className="warning">File list is partial; the provider imposed a limit.</p>
            )}
            {!files && (
              <button
                className="empty-action"
                onClick={() => post({ type: 'selectTab', tab: 'changes' })}
              >
                Load changed files
              </button>
            )}
            {files?.items.map((file, index) => (
              <a key={`${file.path}-${index}`} href={`#file-${index}`} className="file-item">
                <span className={`change ${file.change}`}>
                  {file.change.slice(0, 1).toUpperCase()}
                </span>
                <span className="path">
                  {file.previousPath ? `${file.previousPath} → ` : ''}
                  {file.path}
                </span>
                <span className="stats">
                  {file.additions != null ? `+${file.additions}` : ''}{' '}
                  {file.deletions != null ? `−${file.deletions}` : ''}
                </span>
              </a>
            ))}
            {files?.page.hasNextPage && (
              <button onClick={() => post({ type: 'loadMoreFiles' })}>Load more files</button>
            )}
          </div>
          <div className="diff-list">
            {files?.items.map((file, index) => (
              <DiffView
                key={`${file.path}-${index}`}
                index={index}
                file={file}
                conversations={conversations}
                canComment={['supported', 'conditional'].includes(
                  init.capabilities.inlineComments.support,
                )}
                replyCapabilities={init.capabilities.replyByResource}
                onComment={(position) => {
                  setInline(position);
                  setNeedsReanchor(false);
                }}
                onReply={(id) => setReplyFor(id)}
              />
            ))}
            {!files && (
              <div className="empty card">
                <h2>Changes not loaded</h2>
                <p>Open this tab to fetch the current diff.</p>
              </div>
            )}
          </div>
        </section>
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
          {groups.map((item) => (
            <Conversation
              key={item.id}
              item={item}
              canReply={canReply(item, init.capabilities.replyByResource)}
              onReply={() => setReplyFor(item.id)}
            />
          ))}
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
          <Unavailable
            message={unavailable(init.capabilities.checks.support, init.capabilities.checks.reason)}
          />
          {!unavailable(init.capabilities.checks.support, init.capabilities.checks.reason) &&
            (checks ? (
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
            ) : (
              <div className="empty card">Loading checks…</div>
            ))}
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
      {replyFor && (
        <form
          className="content card composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (mutationUncertain) return;
            post({ type: 'reply', conversationId: replyFor, body: replyDraft });
            setBusy('reply');
          }}
        >
          <label htmlFor="reply">Reply</label>
          <textarea id="reply" value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
          <div className="actions">
            <button type="button" onClick={() => setReplyFor(undefined)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={!!busy || mutationUncertain || !replyDraft.trim()}
            >
              {busy === 'reply' ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </form>
      )}
      {inline && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal composer" onSubmit={(e) => submit(e, 'addInlineComment')}>
            <h2>
              Comment on {inline.path}:{inline.line}
            </h2>
            <p className="muted">
              {needsReanchor
                ? 'The diff changed. Select a current line before sending; your draft is preserved.'
                : 'Review position on the current diff'}
            </p>
            <textarea
              autoFocus
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

function DiffView({
  index,
  file,
  conversations,
  canComment,
  replyCapabilities,
  onComment,
  onReply,
}: {
  index: number;
  file: DiffFilePage['items'][number];
  conversations: ReviewConversation[];
  canComment: boolean;
  replyCapabilities: ProviderCapabilityDescriptor['replyByResource'];
  onComment: (
    p: NonNullable<Extract<WebviewRequest, { type: 'addInlineComment' }>['position']>,
  ) => void;
  onReply: (id: string) => void;
}) {
  const parsed = parseUnifiedDiff(file);
  const discussions = conversations.filter(
    (c) => c.position && [file.path, file.previousPath].includes(c.position.path),
  );
  const renderDiscussion = (item: ReviewConversation) => (
    <InlineDiscussion
      key={item.id}
      item={item}
      canReply={canReply(item, replyCapabilities)}
      onReply={() => onReply(item.id)}
    />
  );
  return (
    <article className="diff-file card" id={`file-${index}`}>
      <div className="diff-file-head">
        <strong>{file.path}</strong>
        <span>{file.change}</span>
      </div>
      {parsed.status !== 'available' ? (
        <p className="muted">
          {parsed.status === 'invalid'
            ? parsed.reason
            : parsed.reason === 'binary'
              ? 'Binary file'
              : parsed.reason === 'too-large'
                ? 'Patch too large'
                : parsed.reason === 'collapsed'
                  ? 'Patch collapsed'
                  : 'Patch unavailable'}
        </p>
      ) : (
        parsed.rows.map((row, i) => {
          const anchored = discussions.filter((item) => {
            const pos = item.position!;
            const target =
              pos.side === 'old' ? (pos.oldLine ?? pos.line) : (pos.newLine ?? pos.line);
            return target === (pos.side === 'old' ? row.oldLine : row.newLine);
          });
          return (
            <React.Fragment key={`${i}-${row.oldLine}-${row.newLine}`}>
              <div className={`diff-row ${row.kind}`}>
                <span className="line-no">{row.oldLine ?? ''}</span>
                <span className="line-no">{row.newLine ?? ''}</span>
                <span
                  className="diff-sign"
                  aria-label={
                    row.kind === 'added'
                      ? 'Added line'
                      : row.kind === 'removed'
                        ? 'Removed line'
                        : 'Context line'
                  }
                >
                  {row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}
                </span>
                <code>{row.text || ' '}</code>
                {canComment && row.commentable && (
                  <button
                    className="line-comment"
                    aria-label={`Comment on ${file.path} line ${row.newLine ?? row.oldLine}`}
                    title="Add inline comment"
                    onClick={() =>
                      onComment({
                        path: file.path,
                        ...(file.previousPath ? { oldPath: file.previousPath } : {}),
                        newPath: file.path,
                        side: row.newLine ? 'new' : 'old',
                        line: row.newLine ?? row.oldLine ?? 1,
                        ...(row.oldLine === undefined ? {} : { oldLine: row.oldLine }),
                        ...(row.newLine === undefined ? {} : { newLine: row.newLine }),
                      })
                    }
                  >
                    ＋
                  </button>
                )}
              </div>
              {anchored.map(renderDiscussion)}
            </React.Fragment>
          );
        })
      )}
      {parsed.status !== 'available' && discussions.map(renderDiscussion)}
    </article>
  );
}
function InlineDiscussion({
  item,
  canReply,
  onReply,
}: {
  item: ReviewConversation;
  canReply: boolean;
  onReply: () => void;
}) {
  const resolution =
    item.provider === 'github'
      ? 'Not applicable'
      : item.resolved === undefined || item.resolved === null
        ? 'Unknown'
        : item.resolved
          ? 'Resolved'
          : 'Unresolved';
  return (
    <div className="inline-discussion">
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
        </div>
      ))}
      {canReply ? <button onClick={onReply}>Reply</button> : null}
    </div>
  );
}
function Conversation({
  item,
  canReply,
  onReply,
}: {
  item: ReviewConversation;
  canReply: boolean;
  onReply: () => void;
}) {
  const resolution =
    item.provider === 'github'
      ? 'Not applicable'
      : item.resolved === undefined || item.resolved === null
        ? 'Unknown'
        : item.resolved
          ? 'Resolved'
          : 'Unresolved';
  return (
    <article className="card conversation">
      <div className="conversation-meta">
        <strong>{item.author.login}</strong>
        <time>{new Date(item.createdAt).toLocaleString()}</time>
        <span>
          {item.position
            ? `${item.position.path}:${item.position.newLine ?? item.position.oldLine}`
            : 'General'}
        </span>
        {item.position && <span>{resolution}</span>}
        {item.systemNote && <span>System note</span>}
        {item.reviewState && <span>Review: {item.reviewState}</span>}
      </div>
      <Markdown text={item.body} />
      {item.replies.map((reply) => (
        <div className="reply" key={reply.id}>
          <strong>{reply.author.login}</strong>
          <time>{new Date(reply.createdAt).toLocaleString()}</time>
          <Markdown text={reply.body} />
        </div>
      ))}
      {canReply && <button onClick={onReply}>Reply</button>}
    </article>
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

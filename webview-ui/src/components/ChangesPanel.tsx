import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DiffFile,
  DiffFilePage,
  ProviderCapabilityDescriptor,
  ReviewConversation,
} from '../../../src/domain/models';
import type { WebviewRequest } from '../../../src/presentation/webview/messageProtocol';
import { parseUnifiedDiff } from '../../../src/domain/diff';
import type { DiffRow } from '../../../src/domain/diff';
import './changes-panel.css';

export type ChangesPanelState = {
  view: 'source' | 'rich';
  layout: 'unified' | 'split';
  sidebarVisible: boolean;
  sidebarWidth: number;
  expandedDirectories: string[];
  viewsByPath?: Record<string, 'source' | 'rich'>;
  selectedPath?: string;
};
export type MarkdownFileContent = {
  oldContent?: string;
  newContent?: string;
  oldError?: string;
  newError?: string;
  error?: string;
  loading?: boolean;
};
type InlinePosition = NonNullable<
  Extract<WebviewRequest, { type: 'addInlineComment' }>['position']
>;
export type ChangesPanelProps = {
  files?: DiffFilePage | undefined;
  stale?: boolean | undefined;
  conversations?: ReviewConversation[] | undefined;
  canComment?: boolean | undefined;
  replyCapabilities?: ProviderCapabilityDescriptor['replyByResource'] | undefined;
  onComment?: ((position: InlinePosition) => void) | undefined;
  onReply?: ((id: string) => void) | undefined;
  renderDiscussion?: ((item: ReviewConversation) => React.ReactNode) | undefined;
  contentByPath?: Record<string, MarkdownFileContent> | undefined;
  onLoadContent?: ((path: string) => void) | undefined;
  onSelectFile?: ((path: string) => void) | undefined;
  onLoadMore?: (() => void) | undefined;
  onRefresh?: (() => void) | undefined;
  initialState?: Partial<ChangesPanelState> | undefined;
  onStateChange?: ((state: ChangesPanelState) => void) | undefined;
};

const minWidth = 210;
const maxWidth = 460;
const defaults: ChangesPanelState = {
  view: 'source',
  layout: 'unified',
  sidebarVisible: true,
  sidebarWidth: 280,
  expandedDirectories: [],
};
const clampWidth = (width: number) => Math.min(maxWidth, Math.max(minWidth, width));
const pathId = (path: string) => `change-file-${encodeURIComponent(path)}`;

export function ChangesPanel(props: ChangesPanelProps) {
  const { files, onStateChange } = props;
  const [state, setState] = useState<ChangesPanelState>(() => ({
    ...defaults,
    ...props.initialState,
    sidebarWidth: clampWidth(props.initialState?.sidebarWidth ?? defaults.sidebarWidth),
    expandedDirectories: props.initialState?.expandedDirectories ?? defaults.expandedDirectories,
  }));
  const diffRef = useRef<HTMLDivElement>(null);
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  const unifiedRef = useRef<HTMLButtonElement>(null);
  const splitRef = useRef<HTMLButtonElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [dragWidth, setDragWidth] = useState<number>();
  const entries = files?.items ?? [];
  const selectedPath = entries.some((file) => file.path === state.selectedPath)
    ? state.selectedPath
    : entries[0]?.path;
  const tree = useMemo(() => buildTree(entries), [entries]);
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);
  const markdownView = (path: string) => state.viewsByPath?.[path] ?? state.view;
  useEffect(() => {
    const selected = entries.find((file) => file.path === selectedPath);
    if (
      selected &&
      /\.md(?:own)?$/i.test(selected.path) &&
      markdownView(selected.path) === 'rich' &&
      !selected.binary &&
      !selected.tooLarge &&
      !props.contentByPath?.[selected.path]
    )
      props.onLoadContent?.(selected.path);
  }, [
    state.view,
    state.viewsByPath,
    selectedPath,
    entries,
    props.contentByPath,
    props.onLoadContent,
  ]);
  useEffect(() => {
    if (!layoutOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !layoutMenuRef.current?.contains(target) &&
        !layoutButtonRef.current?.contains(target)
      )
        setLayoutOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setLayoutOpen(false);
      layoutButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    (state.layout === 'unified' ? unifiedRef : splitRef).current?.focus();
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [layoutOpen, state.layout]);
  const update = (patch: Partial<ChangesPanelState>) =>
    setState((current) => ({ ...current, ...patch }));
  const setMarkdownView = (path: string, view: 'source' | 'rich') => {
    const existing =
      state.viewsByPath ??
      Object.fromEntries(
        entries
          .filter((file) => /\.md(?:own)?$/i.test(file.path))
          .map((file) => [file.path, state.view]),
      );
    update({ viewsByPath: { ...existing, [path]: view }, selectedPath: path });
    if (view === 'rich' && !props.contentByPath?.[path]) props.onLoadContent?.(path);
  };
  const selectLayout = (layout: 'unified' | 'split') => {
    update({ layout });
    setLayoutOpen(false);
    layoutButtonRef.current?.focus();
  };
  const moveLayoutFocus = (layout: 'unified' | 'split') => {
    update({ layout });
    (layout === 'unified' ? unifiedRef : splitRef).current?.focus();
  };
  const toggleDirectory = (path: string) =>
    update({
      expandedDirectories: state.expandedDirectories.includes(path)
        ? state.expandedDirectories.filter((item) => item !== path)
        : [...state.expandedDirectories, path],
    });
  const selectFile = (path: string) => {
    update({ selectedPath: path });
    props.onSelectFile?.(path);
    requestAnimationFrame(() =>
      document.getElementById(pathId(path))?.scrollIntoView({ block: 'start' }),
    );
  };
  const resizeBy = (delta: number) =>
    update({ sidebarWidth: clampWidth(state.sidebarWidth + delta) });
  const scrollDiff = (edge: 'top' | 'bottom') => {
    const diff = diffRef.current;
    if (!diff) return;
    const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    const overflowY = window.getComputedStyle(diff).overflowY;
    if (diff.scrollHeight > diff.clientHeight && ['auto', 'scroll'].includes(overflowY)) {
      diff.scrollTo({ top: edge === 'top' ? 0 : diff.scrollHeight - diff.clientHeight, behavior });
      return;
    }
    const target =
      edge === 'top'
        ? diff.getBoundingClientRect().top + window.scrollY
        : diff.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
    window.scrollTo({ top: Math.max(0, target), behavior });
  };
  const resizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const start = event.clientX;
    const width = state.sidebarWidth;
    const move = (next: PointerEvent) => setDragWidth(clampWidth(width + next.clientX - start));
    const finish = (next: PointerEvent) => {
      setDragWidth(undefined);
      update({ sidebarWidth: clampWidth(width + next.clientX - start) });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  };
  return (
    <section
      className={`changes-panel ${state.sidebarVisible ? '' : 'sidebar-hidden'}`}
      style={
        { '--file-sidebar-width': `${dragWidth ?? state.sidebarWidth}px` } as React.CSSProperties
      }
    >
      {state.sidebarVisible && (
        <aside className="changes-sidebar" aria-label="Changed files">
          <div className="changes-toolbar">
            <strong>
              Files ({files?.items.length ?? 0}
              {files?.truncated ? '+' : ''})
            </strong>
            <button
              type="button"
              onClick={() => update({ sidebarVisible: false })}
              aria-label="Hide files"
            >
              Hide
            </button>
          </div>
          {files?.truncated && (
            <p className="changes-warning">File list is partial; the provider imposed a limit.</p>
          )}
          {!files && <p className="changes-muted">Changed files have not loaded.</p>}
          {tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              expanded={state.expandedDirectories}
              selected={selectedPath}
              toggle={toggleDirectory}
              select={selectFile}
            />
          ))}
          {files?.page.hasNextPage && (
            <button type="button" onClick={props.onLoadMore}>
              Load more files
            </button>
          )}
        </aside>
      )}
      {state.sidebarVisible && (
        <div
          className="changes-resizer"
          role="separator"
          aria-label="Resize file list"
          aria-orientation="vertical"
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuenow={dragWidth ?? state.sidebarWidth}
          tabIndex={0}
          onPointerDown={resizeStart}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              resizeBy(event.key === 'ArrowLeft' ? -16 : 16);
            }
            if (event.key === 'Home') update({ sidebarWidth: minWidth });
            if (event.key === 'End') update({ sidebarWidth: maxWidth });
          }}
        />
      )}
      <div className="changes-body changes-diff" ref={diffRef}>
        {props.stale && (
          <p className="changes-warning" role="status">
            This diff is stale. Choose a current line before submitting an inline comment.
          </p>
        )}
        <div className="changes-toolbar changes-view-toolbar">
          {!state.sidebarVisible && (
            <button
              type="button"
              aria-label="Show files"
              onClick={() => update({ sidebarVisible: true })}
            >
              Files
            </button>
          )}
          <div className="changes-layout-control">
            <button
              ref={layoutButtonRef}
              type="button"
              className="changes-gear-button"
              aria-label="Changes settings"
              title="Changes settings"
              aria-haspopup="true"
              aria-expanded={layoutOpen}
              onClick={() => setLayoutOpen((open) => !open)}
            >
              ⚙
            </button>
            {layoutOpen && (
              <div className="changes-layout-popover" ref={layoutMenuRef}>
                <strong>Layout</strong>
                <div role="radiogroup" aria-label="Layout">
                  <button
                    ref={unifiedRef}
                    type="button"
                    role="radio"
                    aria-checked={state.layout === 'unified'}
                    tabIndex={state.layout === 'unified' ? 0 : -1}
                    onClick={() => selectLayout('unified')}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                        event.preventDefault();
                        moveLayoutFocus('split');
                      }
                    }}
                  >
                    <span aria-hidden="true">{state.layout === 'unified' ? '✓' : ''}</span> Unified
                  </button>
                  <button
                    ref={splitRef}
                    type="button"
                    role="radio"
                    aria-checked={state.layout === 'split'}
                    tabIndex={state.layout === 'split' ? 0 : -1}
                    onClick={() => selectLayout('split')}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                        event.preventDefault();
                        moveLayoutFocus('unified');
                      }
                    }}
                  >
                    <span aria-hidden="true">{state.layout === 'split' ? '✓' : ''}</span> Split
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={props.onRefresh}>
            Refresh
          </button>
        </div>
        {!entries.length ? (
          <p className="changes-muted">No changed files to show.</p>
        ) : (
          entries.map((file) => (
            <DiffFileView
              key={file.path}
              file={file}
              selected={file.path === selectedPath}
              layout={state.layout}
              rich={markdownView(file.path) === 'rich' && /\.md(?:own)?$/i.test(file.path)}
              markdownView={markdownView(file.path)}
              onMarkdownViewChange={(view) => setMarkdownView(file.path, view)}
              content={props.contentByPath?.[file.path]}
              conversations={props.conversations ?? []}
              canComment={props.canComment ?? false}
              onComment={props.onComment}
              onReply={props.onReply}
              renderDiscussion={props.renderDiscussion}
              onLoadContent={props.onLoadContent}
            />
          ))
        )}
      </div>
      <div className="changes-scroll-controls" aria-label="Changes navigation">
        <button
          type="button"
          aria-label="Scroll Changes to top"
          title="Scroll Changes to top"
          onClick={() => scrollDiff('top')}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Scroll Changes to bottom"
          title="Scroll Changes to bottom"
          onClick={() => scrollDiff('bottom')}
        >
          ↓
        </button>
      </div>
    </section>
  );
}

type TreeEntry = { path: string; name: string; children?: TreeEntry[]; file?: DiffFile };
function buildTree(files: DiffFile[]): TreeEntry[] {
  const root: TreeEntry[] = [];
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let level = root;
    parts.forEach((name, index) => {
      const path = parts.slice(0, index + 1).join('/');
      let node = level.find((entry) => entry.name === name);
      if (!node) {
        node = { path, name, ...(index < parts.length - 1 ? { children: [] } : { file }) };
        level.push(node);
      }
      if (node.children) level = node.children;
    });
  }
  const sort = (nodes: TreeEntry[]) => {
    nodes.sort(
      (a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name),
    );
    nodes.forEach((node) => node.children && sort(node.children));
  };
  sort(root);
  return root;
}
function TreeNode({
  node,
  expanded,
  selected,
  toggle,
  select,
}: {
  node: TreeEntry;
  expanded: string[];
  selected?: string | undefined;
  toggle: (path: string) => void;
  select: (path: string) => void;
}) {
  const open = expanded.includes(node.path);
  return (
    <div className="file-tree-node">
      {node.children ? (
        <>
          <button
            type="button"
            className="tree-directory"
            aria-label={`Directory ${node.path}`}
            aria-expanded={open}
            onClick={() => toggle(node.path)}
          >
            {open ? '▾' : '▸'} {node.name}
          </button>
          {open && (
            <div className="tree-children">
              {node.children.map((child) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  expanded={expanded}
                  selected={selected}
                  toggle={toggle}
                  select={select}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          className={`tree-file ${selected === node.path ? 'selected' : ''}`}
          aria-label={`File ${node.path}`}
          aria-current={selected === node.path ? 'true' : undefined}
          onClick={() => select(node.path)}
        >
          <span className={`change ${node.file?.change ?? 'unknown'}`}>
            {node.file?.change === 'added' ? '+' : node.file?.change === 'removed' ? '−' : 'M'}
          </span>
          <span>{node.name}</span>
        </button>
      )}
    </div>
  );
}

function DiffFileView({
  file,
  selected,
  layout,
  rich,
  markdownView,
  onMarkdownViewChange,
  content,
  conversations,
  canComment,
  onComment,
  onReply,
  renderDiscussion,
  onLoadContent,
}: {
  file: DiffFile;
  selected: boolean;
  layout: 'unified' | 'split';
  rich: boolean;
  markdownView: 'source' | 'rich';
  onMarkdownViewChange: (view: 'source' | 'rich') => void;
  content?: MarkdownFileContent | undefined;
  conversations: ReviewConversation[];
  canComment: boolean;
  onComment?: ((position: InlinePosition) => void) | undefined;
  onReply?: ((id: string) => void) | undefined;
  renderDiscussion?: ((item: ReviewConversation) => React.ReactNode) | undefined;
  onLoadContent?: ((path: string) => void) | undefined;
}) {
  const [showSource, setShowSource] = useState(false);
  const parsed = parseUnifiedDiff(file);
  const discussions = conversations.filter(
    (item) => item.position && [file.path, file.previousPath].includes(item.position.path),
  );
  const discussion = (item: ReviewConversation) =>
    renderDiscussion?.(item) ?? (
      <article className="inline-discussion" key={item.id}>
        <strong>{item.author.name || item.author.login}</strong>
        <p>{item.body}</p>
        {onReply && (
          <button type="button" onClick={() => onReply(item.id)}>
            Reply
          </button>
        )}
      </article>
    );
  const rowDiscussions = (row: { oldLine?: number; newLine?: number }) =>
    discussions.filter((item) => {
      const position = item.position!;
      return (
        (position.side === 'old' ? row.oldLine : row.newLine) ===
        (position.side === 'old'
          ? (position.oldLine ?? position.line)
          : (position.newLine ?? position.line))
      );
    });
  const oldLines = lineDecorations(
    parsed.status === 'available' ? parsed.rows : [],
    'old',
    discussions,
  );
  const newLines = lineDecorations(
    parsed.status === 'available' ? parsed.rows : [],
    'new',
    discussions,
  );
  const unanchoredDiscussions = discussions.filter(
    (item) =>
      ![...oldLines.values(), ...newLines.values()].some(({ discussions: visible }) =>
        visible.includes(item),
      ),
  );
  const addComment = (row: { oldLine?: number; newLine?: number }, side?: 'old' | 'new') =>
    onComment?.({
      path: file.path,
      ...(file.previousPath ? { oldPath: file.previousPath } : {}),
      newPath: file.path,
      side: side ?? (row.newLine !== undefined ? 'new' : 'old'),
      line:
        side === 'old'
          ? (row.oldLine ?? 1)
          : side === 'new'
            ? (row.newLine ?? 1)
            : (row.newLine ?? row.oldLine ?? 1),
      ...(row.oldLine === undefined ? {} : { oldLine: row.oldLine }),
      ...(row.newLine === undefined ? {} : { newLine: row.newLine }),
    });
  return (
    <article
      id={pathId(file.path)}
      className={`diff-file-card ${selected ? 'selected' : ''}`}
      aria-label={`Diff for ${file.path}`}
    >
      <header>
        <strong>{file.path}</strong>
        <div className="diff-file-actions">
          <span>{file.change}</span>
          {/\.md(?:own)?$/i.test(file.path) && (
            <div
              className="markdown-view-toggle"
              role="group"
              aria-label={`Markdown display for ${file.path}`}
            >
              <button
                type="button"
                aria-label="Display the source diff"
                title="Display the source diff"
                aria-pressed={markdownView === 'source'}
                onClick={() => onMarkdownViewChange('source')}
              >
                <span aria-hidden="true">&lt;&gt;</span>
              </button>
              <button
                type="button"
                aria-label="Display the rich diff"
                title="Display the rich diff"
                aria-pressed={markdownView === 'rich'}
                onClick={() => {
                  setShowSource(false);
                  onMarkdownViewChange('rich');
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
                  <path d="M3 1.5h6.5L13 5v9.5H3z" />
                  <path d="M9.5 1.5V5H13" />
                  <path d="M5.5 8h5M5.5 10.5h5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>
      {rich && !showSource ? (
        <RichContent
          file={file}
          content={content}
          rows={parsed.status === 'available' ? parsed.rows : []}
          onLoad={() => onLoadContent?.(file.path)}
          layout={layout}
          canComment={canComment}
          onComment={addComment}
          renderDiscussion={discussion}
          oldLines={oldLines}
          newLines={newLines}
        />
      ) : parsed.status !== 'available' ? (
        <p className="changes-muted">
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
      ) : layout === 'unified' ? (
        <div className="unified-diff">
          {parsed.rows.map((row, index) => (
            <Fragment key={`${row.hunkIndex}-${index}-${row.oldLine}-${row.newLine}`}>
              <div className={`diff-row ${row.kind}`}>
                <span className="line-no old-line">{row.oldLine ?? ''}</span>
                <span className="line-no new-line">{row.newLine ?? ''}</span>
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
                    type="button"
                    className="line-comment"
                    aria-label={`Comment on ${file.path} line ${row.newLine ?? row.oldLine}`}
                    onClick={() => addComment(row)}
                  >
                    ＋
                  </button>
                )}
              </div>
              {rowDiscussions(row).map((item) => (
                <Fragment key={item.id}>{discussion(item)}</Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      ) : (
        <SplitDiff
          rows={parsed.rows}
          file={file}
          canComment={canComment}
          onComment={addComment}
          rowDiscussions={rowDiscussions}
          renderDiscussion={discussion}
        />
      )}
      {parsed.status !== 'available' &&
        discussions.map((item) => <Fragment key={item.id}>{discussion(item)}</Fragment>)}
      {!!unanchoredDiscussions.length && (
        <section
          className="changes-unanchored-discussions"
          aria-label="Discussions outside visible patch"
        >
          <strong>Discussions outside visible patch</strong>
          {unanchoredDiscussions.map((item) => (
            <Fragment key={item.id}>
              <p className="changes-muted">
                Source position: {item.position?.side} line {item.position?.line}
              </p>
              {discussion(item)}
            </Fragment>
          ))}
          <button type="button" onClick={() => setShowSource((visible) => !visible)}>
            {showSource ? 'Show rich diff' : 'Show source diff'}
          </button>
        </section>
      )}
    </article>
  );
}
function SplitDiff({
  rows,
  file,
  canComment,
  onComment,
  rowDiscussions,
  renderDiscussion,
}: {
  rows: ReturnType<typeof parseUnifiedDiff> extends { rows: infer R } ? R : never;
  file: DiffFile;
  canComment: boolean;
  onComment: (row: { oldLine?: number; newLine?: number }, side: 'old' | 'new') => void;
  rowDiscussions: (row: { oldLine?: number; newLine?: number }) => ReviewConversation[];
  renderDiscussion: (item: ReviewConversation) => React.ReactNode;
}) {
  const pairs: Array<{
    left: (typeof rows)[number] | undefined;
    right: (typeof rows)[number] | undefined;
  }> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (row.kind === 'hunk-header') {
      pairs.push({ left: row, right: row });
      continue;
    }
    if (row.kind === 'removed') {
      const removed: (typeof row)[] = [row];
      while (rows[index + 1]?.kind === 'removed') removed.push(rows[++index]! as typeof row);
      const added: (typeof row)[] = [];
      while (rows[index + 1]?.kind === 'added') added.push(rows[++index]! as typeof row);
      for (let n = 0; n < Math.max(removed.length, added.length); n += 1)
        pairs.push({ left: removed[n], right: added[n] });
    } else if (row.kind === 'added') pairs.push({ left: undefined, right: row });
    else pairs.push({ left: row, right: row });
  }
  return (
    <div className="split-diff">
      {pairs.map((pair, index) => (
        <Fragment key={index}>
          <div className="split-row">
            {(['left', 'right'] as const).map((side) => {
              const row = pair[side];
              return (
                <div className={`split-cell ${row?.kind ?? 'empty'}`} key={side}>
                  {row && (
                    <>
                      <span className="line-no">
                        {side === 'left' ? (row.oldLine ?? '') : (row.newLine ?? '')}
                      </span>
                      <span className="diff-sign">
                        {row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}
                      </span>
                      <code>{row.text || ' '}</code>
                      {canComment && row.commentable && (
                        <button
                          type="button"
                          className="line-comment"
                          aria-label={`Comment on ${file.path} line ${side === 'left' ? row.oldLine : row.newLine}`}
                          onClick={() => onComment(row, side === 'left' ? 'old' : 'new')}
                        >
                          ＋
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {[
            ...new Set([
              ...(pair.left ? rowDiscussions(pair.left) : []),
              ...(pair.right ? rowDiscussions(pair.right) : []),
            ]),
          ].map((item) => (
            <Fragment key={item.id}>{renderDiscussion(item)}</Fragment>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

type LineDecoration = { row: DiffRow; discussions: ReviewConversation[] };
function lineDecorations(
  rows: DiffRow[],
  side: 'old' | 'new',
  conversations: ReviewConversation[],
): Map<number, LineDecoration> {
  const result = new Map<number, LineDecoration>();
  for (const row of rows) {
    const line = side === 'old' ? row.oldLine : row.newLine;
    if (line === undefined || !row.commentable) continue;
    const threads = conversations.filter((item) => {
      const position = item.position;
      if (!position || position.side !== side) return false;
      return (
        (side === 'old'
          ? (position.oldLine ?? position.line)
          : (position.newLine ?? position.line)) === line
      );
    });
    result.set(line, { row, discussions: threads });
  }
  return result;
}

function RichContent({
  file,
  content,
  onLoad,
  rows,
  layout,
  canComment,
  onComment,
  renderDiscussion,
  oldLines,
  newLines,
}: {
  file: DiffFile;
  content?: MarkdownFileContent | undefined;
  onLoad: () => void;
  rows: Array<{ kind: string; oldLine?: number; newLine?: number }>;
  layout: 'unified' | 'split';
  canComment: boolean;
  onComment: (row: { oldLine?: number; newLine?: number }, side?: 'old' | 'new') => void;
  renderDiscussion: (item: ReviewConversation) => React.ReactNode;
  oldLines: Map<number, LineDecoration>;
  newLines: Map<number, LineDecoration>;
}) {
  if (file.binary) return <p className="changes-muted">Binary file</p>;
  if (content?.loading)
    return (
      <p className="changes-muted" role="status">
        Loading full file content…
      </p>
    );
  if (
    content?.error ||
    content?.oldError ||
    content?.newError ||
    (!content?.oldContent && !content?.newContent)
  )
    return (
      <div className="changes-unavailable" role="status">
        <p>Full file content unavailable</p>
        <p>
          {content?.error ||
            content?.oldError ||
            content?.newError ||
            (file.tooLarge
              ? 'The provider omitted this file because it is too large.'
              : 'The provider has not returned both file versions.')}
        </p>
        <button type="button" onClick={onLoad}>
          Retry
        </button>
      </div>
    );
  const removed = new Set(
    rows
      .filter((row) => row.kind === 'removed' && row.oldLine !== undefined)
      .map((row) => row.oldLine!),
  );
  const added = new Set(
    rows
      .filter((row) => row.kind === 'added' && row.newLine !== undefined)
      .map((row) => row.newLine!),
  );
  return (
    <div className={`rich-diff ${layout}`}>
      <section className="rich-side removed">
        <h3>− Previous version</h3>
        <SafeMarkdown
          text={content.oldContent ?? ''}
          changedLines={removed}
          kind="removed"
          anchors={oldLines}
          side="old"
          canComment={canComment}
          onComment={onComment}
          renderDiscussion={renderDiscussion}
        />
      </section>
      <section className="rich-side added">
        <h3>+ Current version</h3>
        <SafeMarkdown
          text={content.newContent ?? ''}
          changedLines={added}
          kind="added"
          anchors={newLines}
          side="new"
          canComment={canComment}
          onComment={onComment}
          renderDiscussion={renderDiscussion}
        />
      </section>
    </div>
  );
}

function SafeMarkdown({
  text,
  changedLines,
  kind,
  anchors,
  side,
  canComment,
  onComment,
  renderDiscussion,
}: {
  text: string;
  changedLines?: Set<number>;
  kind?: 'removed' | 'added';
  anchors?: Map<number, LineDecoration>;
  side?: 'old' | 'new';
  canComment?: boolean;
  onComment?: (row: { oldLine?: number; newLine?: number }, side?: 'old' | 'new') => void;
  renderDiscussion?: (item: ReviewConversation) => React.ReactNode;
}) {
  const blocks: React.ReactNode[] = [];
  let paragraph: Array<{ line: string; index: number }> = [];
  let list: Array<{ line: string; index: number }> = [];
  let code: Array<{ line: string; index: number }> | undefined;
  const changed = (lines: Array<{ index: number }>) =>
    !!changedLines && lines.some(({ index }) => changedLines.has(index + 1));
  const marker = (isChanged: boolean) => (
    <span className="markdown-change-marker" aria-hidden="true">
      {isChanged ? (kind === 'removed' ? '−' : '+') : ''}
    </span>
  );
  const lineActions = (line: number) => {
    const anchor = anchors?.get(line);
    if (!anchor) return null;
    return (
      <span className="rich-line-actions">
        {canComment && (
          <button
            type="button"
            className="rich-line-comment"
            aria-label={`Comment on ${side} line ${line}`}
            onClick={() => onComment?.(anchor.row, side)}
            title="Add inline comment"
          >
            ＋
          </button>
        )}
        {anchor.discussions.map((item) => (
          <Fragment key={item.id}>{renderDiscussion?.(item)}</Fragment>
        ))}
      </span>
    );
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      const edited = changed(paragraph);
      blocks.push(
        <div className={edited ? `markdown-change ${kind}` : undefined} key={`p-${blocks.length}`}>
          {marker(edited)}
          <p>
            {paragraph.map(({ line }, index) => (
              <Fragment key={index}>
                {index > 0 && <br />}
                <InlineMarkdown text={line} />
                {lineActions(paragraph[index]!.index + 1)}
              </Fragment>
            ))}
          </p>
        </div>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l-${blocks.length}`}>
          {list.map(({ line, index }) => {
            const edited = changedLines?.has(index + 1);
            return (
              <li className={edited ? `markdown-change ${kind}` : undefined} key={index}>
                {marker(!!edited)}
                <InlineMarkdown text={line} />
                {lineActions(index + 1)}
              </li>
            );
          })}
        </ul>,
      );
      list = [];
    }
  };
  const sourceLines = text.split(/\r?\n/);
  sourceLines.forEach((line, lineIndex) => {
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      if (code) {
        const edited = changed(code);
        blocks.push(
          <pre
            className={edited ? `markdown-change ${kind}` : undefined}
            key={`c-${blocks.length}`}
          >
            {marker(edited)}
            <code>{code.map(({ line: text }) => text).join('\n')}</code>
          </pre>,
        );
        code.forEach(({ index }) => {
          const actions = lineActions(index + 1);
          if (actions)
            blocks.push(
              <div className="rich-code-line-actions" key={`ca-${blocks.length}`}>
                {actions}
              </div>,
            );
        });
        code = undefined;
      } else code = [];
      return;
    }
    if (code) {
      code.push({ line, index: lineIndex });
      return;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const Tag = `h${heading[1]!.length}` as keyof React.JSX.IntrinsicElements;
      blocks.push(
        <div
          className={changedLines?.has(lineIndex + 1) ? `markdown-change ${kind}` : undefined}
          key={`h-${blocks.length}`}
        >
          <span className="markdown-change-marker" aria-hidden="true">
            {changedLines?.has(lineIndex + 1) ? (kind === 'removed' ? '−' : '+') : ''}
          </span>
          <Tag>
            <InlineMarkdown text={heading[2]!} />
          </Tag>
          {lineActions(lineIndex + 1)}
        </div>,
      );
      return;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      list.push({ line: line.replace(/^\s*[-*+]\s+/, ''), index: lineIndex });
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    flushList();
    paragraph.push({ line, index: lineIndex });
  });
  if (code) {
    const edited = changed(code);
    blocks.push(
      <pre className={edited ? `markdown-change ${kind}` : undefined} key={`c-${blocks.length}`}>
        {marker(edited)}
        <code>{code.map(({ line }) => line).join('\n')}</code>
      </pre>,
    );
  }
  flushParagraph();
  flushList();
  return <div className="safe-markdown">{blocks}</div>;
}
function InlineMarkdown({ text }: { text: string }) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {tokens.map((token, index) => {
        if (token.startsWith('`') && token.endsWith('`'))
          return <code key={index}>{token.slice(1, -1)}</code>;
        if (token.startsWith('**') && token.endsWith('**'))
          return <strong key={index}>{token.slice(2, -2)}</strong>;
        if (token.startsWith('*') && token.endsWith('*'))
          return <em key={index}>{token.slice(1, -1)}</em>;
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        if (link) {
          try {
            const url = new URL(link[2]!, 'https://reviewdock.invalid');
            if (['http:', 'https:', 'mailto:'].includes(url.protocol))
              return (
                <a key={index} href={link[2]} target="_blank" rel="noreferrer">
                  {link[1]}
                </a>
              );
          } catch {
            /* Render malformed links as text. */
          }
        }
        return <Fragment key={index}>{token}</Fragment>;
      })}
    </>
  );
}

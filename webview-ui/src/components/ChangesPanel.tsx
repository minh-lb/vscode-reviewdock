import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DiffFile,
  DiffFilePage,
  ProviderCapabilityDescriptor,
  ReviewConversation,
} from '../../../src/domain/models';
import type { WebviewRequest } from '../../../src/presentation/webview/messageProtocol';
import { expandDiffContext, parseUnifiedDiff } from '../../../src/domain/diff';
import type { DiffRow } from '../../../src/domain/diff';
import './changes-panel.css';
import { MarkdownPreview as SafeMarkdown } from './MarkdownPreview';

export type ChangesPanelState = {
  view: 'source' | 'rich';
  layout: 'unified' | 'split';
  sidebarVisible: boolean;
  sidebarWidth: number;
  expandedDirectories: string[];
  viewsByPath?: Record<string, 'source' | 'rich'>;
  selectedPath?: string;
  collapsedPaths?: string[];
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
type ContextControl = { type: 'context-control'; gap: string; hidden: number };
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
  collapsedPaths: [],
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
      !state.collapsedPaths?.includes(selected.path) &&
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
    state.collapsedPaths,
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
    update({
      selectedPath: path,
      ...(state.collapsedPaths?.includes(path)
        ? { collapsedPaths: state.collapsedPaths.filter((item) => item !== path) }
        : {}),
    });
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
              collapsed={state.collapsedPaths?.includes(file.path) ?? false}
              toggleCollapsed={() =>
                update({
                  collapsedPaths: (state.collapsedPaths ?? []).includes(file.path)
                    ? (state.collapsedPaths ?? []).filter((path) => path !== file.path)
                    : [...(state.collapsedPaths ?? []), file.path],
                })
              }
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
  collapsed,
  toggleCollapsed,
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
  collapsed: boolean;
  toggleCollapsed: () => void;
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
  const [contextLimits, setContextLimits] = useState<Record<string, number>>({});
  const parsed = parseUnifiedDiff(file);
  const expanded = useMemo(
    () => expandDiffContext(file, content?.oldContent, content?.newContent),
    [file, content?.oldContent, content?.newContent],
  );
  const expandedRows =
    expanded.status === 'available'
      ? expanded.rows
      : parsed.status === 'available'
        ? parsed.rows
        : [];
  const anchorRows =
    expanded.status === 'available'
      ? expanded.rows
      : parsed.status === 'available'
        ? parsed.rows
        : [];
  const visibleRows = useMemo(() => {
    const limitRows = expandedRows;
    const result: Array<{ row?: DiffRow; gap?: string; hidden: number }> = [];
    let gapIndex = 0;
    for (let index = 0; index < limitRows.length;) {
      const row = limitRows[index]!;
      if (row.kind !== 'context') {
        result.push({ row, hidden: 0 });
        index += 1;
        continue;
      }
      const start = index;
      while (index < limitRows.length && limitRows[index]!.kind === 'context') index += 1;
      const gapRows = limitRows.slice(start, index);
      const gap = `${gapRows[0]!.oldLine}:${gapRows[0]!.newLine}:${gapIndex++}`;
      const max = contextLimits[gap] ?? 0;
      const leading = start === 0;
      const shown =
        max === 0
          ? []
          : gapRows.length <= max
            ? gapRows
            : leading
              ? gapRows.slice(-max)
              : gapRows.slice(0, max);
      if (gapRows.length > shown.length && leading)
        result.push({ gap, hidden: gapRows.length - shown.length });
      result.push(...shown.map((contextRow) => ({ row: contextRow, hidden: 0 })));
      if (gapRows.length > shown.length && !leading)
        result.push({ gap, hidden: gapRows.length - shown.length });
    }
    return result;
  }, [expandedRows, contextLimits]);
  const visibleSourceRows = visibleRows;
  const hasFullContent =
    (file.change === 'added' || content?.oldContent !== undefined) &&
    (file.change === 'removed' || content?.newContent !== undefined);
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
  const visibleAnchorRows =
    expanded.status === 'available'
      ? visibleRows.flatMap(({ row }) => (row ? [row] : []))
      : parsed.status === 'available'
        ? parsed.rows
        : [];
  const activeAnchorRows = rich && !showSource ? anchorRows : visibleAnchorRows;
  const oldLines = lineDecorations(activeAnchorRows, 'old', discussions);
  const newLines = lineDecorations(activeAnchorRows, 'new', discussions);
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
        <button
          type="button"
          className="diff-collapse-button"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} diff for ${file.path}`}
          title={`${collapsed ? 'Expand' : 'Collapse'} file`}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          <span className="diff-collapse-icon" aria-hidden="true">
            ›
          </span>
        </button>
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
      {!collapsed && (
        <>
          {expanded.status === 'invalid' &&
            (content?.oldContent !== undefined || content?.newContent !== undefined) && (
              <p className="changes-warning" role="status">
                Full file content could not be aligned to the provider patch. Comments are available
                only on verified patch lines.
              </p>
            )}
          {parsed.status === 'available' && !hasFullContent && (
            <div className="context-load-status">
              {content?.loading ? (
                <p role="status">Loading unchanged file context…</p>
              ) : content?.error || content?.oldError || content?.newError ? (
                <p role="status">
                  Full file context unavailable.{' '}
                  <button type="button" onClick={() => onLoadContent?.(file.path)}>
                    Retry
                  </button>
                </p>
              ) : onLoadContent ? (
                <button type="button" onClick={() => onLoadContent(file.path)}>
                  Load unchanged lines
                </button>
              ) : null}
            </div>
          )}
          {rich && !showSource ? (
            <RichContent
              file={file}
              content={content}
              rows={anchorRows}
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
              {visibleSourceRows.map(({ row, gap, hidden }, index) =>
                row ? (
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
                ) : (
                  <div className="context-expansion" key={`gap-${gap}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setContextLimits((limits) => ({
                          ...limits,
                          [gap!]: (limits[gap!] ?? 0) + 20,
                        }))
                      }
                    >
                      Load 20 more unchanged lines ({hidden} hidden)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setContextLimits((limits) => ({
                          ...limits,
                          [gap!]: Number.MAX_SAFE_INTEGER,
                        }))
                      }
                    >
                      Show all context
                    </button>
                  </div>
                ),
              )}
            </div>
          ) : (
            <SplitDiff
              rows={visibleSourceRows.map(
                ({ row, gap, hidden }) => row ?? { type: 'context-control', gap: gap!, hidden },
              )}
              onExpandContext={(gap, all) =>
                setContextLimits((limits) => ({
                  ...limits,
                  [gap]: all ? Number.MAX_SAFE_INTEGER : (limits[gap] ?? 0) + 20,
                }))
              }
              file={file}
              headers
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
        </>
      )}
    </article>
  );
}
function SplitDiff({
  rows,
  onExpandContext,
  file,
  headers,
  canComment,
  onComment,
  rowDiscussions,
  renderDiscussion,
}: {
  rows: Array<DiffRow | ContextControl>;
  onExpandContext: (gap: string, all: boolean) => void;
  file: DiffFile;
  headers: boolean;
  canComment: boolean;
  onComment: (row: { oldLine?: number; newLine?: number }, side: 'old' | 'new') => void;
  rowDiscussions: (row: { oldLine?: number; newLine?: number }) => ReviewConversation[];
  renderDiscussion: (item: ReviewConversation) => React.ReactNode;
}) {
  const isContextControl = (row: DiffRow | ContextControl): row is ContextControl => 'type' in row;
  const pairs: Array<{
    left: DiffRow | undefined;
    right: DiffRow | undefined;
    control?: ContextControl;
  }> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (isContextControl(row)) {
      pairs.push({ left: undefined, right: undefined, control: row });
      continue;
    }
    if (row.kind === 'hunk-header') {
      pairs.push({ left: row, right: row });
      continue;
    }
    if (row.kind === 'removed') {
      const removed: (typeof row)[] = [row];
      while (
        rows[index + 1] &&
        !isContextControl(rows[index + 1]!) &&
        (rows[index + 1] as DiffRow).kind === 'removed'
      )
        removed.push(rows[++index]! as DiffRow);
      const added: (typeof row)[] = [];
      while (
        rows[index + 1] &&
        !isContextControl(rows[index + 1]!) &&
        (rows[index + 1] as DiffRow).kind === 'added'
      )
        added.push(rows[++index]! as DiffRow);
      for (let n = 0; n < Math.max(removed.length, added.length); n += 1)
        pairs.push({ left: removed[n], right: added[n] });
    } else if (row.kind === 'added') pairs.push({ left: undefined, right: row });
    else pairs.push({ left: row, right: row });
  }
  return (
    <div className="split-diff">
      {headers && (
        <div className="split-row split-headers">
          <div>− Previous version</div>
          <div>+ Current version</div>
        </div>
      )}
      {pairs.map((pair, index) => (
        <Fragment key={index}>
          {pair.control ? (
            <div className="split-row split-context-row">
              <div>
                <button type="button" onClick={() => onExpandContext(pair.control!.gap, false)}>
                  Load 20 more unchanged lines ({pair.control.hidden} hidden)
                </button>
                <button type="button" onClick={() => onExpandContext(pair.control!.gap, true)}>
                  Show all context
                </button>
              </div>
            </div>
          ) : (
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
                            aria-label={`Comment on ${side === 'left' ? 'old' : 'new'} line ${side === 'left' ? row.oldLine : row.newLine} of ${file.path}`}
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
          )}
          {[
            ...new Set([
              ...(pair.left ? rowDiscussions(pair.left) : []),
              ...(pair.right ? rowDiscussions(pair.right) : []),
            ]),
          ].map((item) => (
            <div className="split-row split-discussion-row" key={item.id}>
              <div>{renderDiscussion(item)}</div>
              <div aria-hidden="true" />
            </div>
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
    !content ||
    content.error ||
    content?.oldError ||
    content?.newError ||
    (file.change !== 'added' && content?.oldContent === undefined) ||
    (file.change !== 'removed' && content?.newContent === undefined)
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
      {file.change !== 'added' &&
        (layout === 'unified' ? (
          <details className="rich-previous-version">
            <summary>View previous version</summary>
            <section className="rich-side removed">
              <div className="rich-version-label">− Previous version</div>
              <SafeMarkdown
                text={content.oldContent ?? ''}
                changedLines={removed}
                kind="removed"
                anchors={oldLines}
                side="old"
                canComment={canComment}
                onComment={onComment}
              />
            </section>
          </details>
        ) : (
          <section className="rich-side removed">
            <div className="rich-version-label">− Previous version</div>
            <SafeMarkdown
              text={content.oldContent ?? ''}
              changedLines={removed}
              kind="removed"
              anchors={oldLines}
              side="old"
              canComment={canComment}
              onComment={onComment}
            />
          </section>
        ))}
      {file.change !== 'removed' && (
        <section className="rich-side added">
          <div className="rich-version-label">+ Current version</div>
          <SafeMarkdown
            text={content.newContent ?? ''}
            changedLines={added}
            kind="added"
            anchors={newLines}
            side="new"
            canComment={canComment}
            onComment={onComment}
          />
        </section>
      )}
      {[
        ...new Set(
          [...oldLines.values(), ...newLines.values()].flatMap((line) => line.discussions),
        ),
      ].length > 0 && (
        <section className="rich-discussions" aria-label="Inline discussions">
          {[
            ...new Set(
              [...oldLines.values(), ...newLines.values()].flatMap((line) => line.discussions),
            ),
          ].map((item) => (
            <Fragment key={item.id}>{renderDiscussion(item)}</Fragment>
          ))}
        </section>
      )}
    </div>
  );
}

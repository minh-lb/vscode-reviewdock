import React, { useState } from 'react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type SourceRow = { oldLine?: number; newLine?: number };
type Props = {
  text: string;
  changedLines?: Set<number>;
  kind?: 'removed' | 'added';
  anchors?: Map<number, { row: SourceRow }>;
  side?: 'old' | 'new';
  canComment?: boolean;
  onComment?: (row: SourceRow, side?: 'old' | 'new') => void;
};

/** Markdown stays semantic; review controls use source positions outside the prose. */
export function MarkdownPreview({
  text,
  changedLines,
  kind,
  anchors,
  side,
  canComment,
  onComment,
}: Props) {
  const [showSourceLines, setShowSourceLines] = useState(false);
  const sourceLines = text.split(/\r?\n/);
  const lineButton = (line: number) => {
    const anchor = anchors?.get(line);
    if (!anchor || !canComment) return null;
    return (
      <button
        key={line}
        type="button"
        className="rich-line-comment"
        aria-label={`Comment on ${side} line ${line}`}
        title={`Comment on source line ${line}`}
        onClick={() => onComment?.(anchor.row, side)}
      >
        Line {line}
      </button>
    );
  };
  const block = (tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'pre' | 'li' | 'table') =>
    function MarkdownBlock({
      node,
      children,
      className,
    }: ExtraProps & { children?: React.ReactNode; className?: string | undefined }) {
      const [commentOpen, setCommentOpen] = useState(false);
      const start = node?.position?.start.line;
      const end = node?.position?.end.line;
      const lines =
        start && end ? Array.from({ length: end - start + 1 }, (_, index) => start + index) : [];
      const edited = lines.some((line) => changedLines?.has(line));
      const commentable = canComment ? lines.filter((line) => anchors?.has(line)) : [];
      const rendered = React.createElement(tag === 'li' ? 'div' : tag, { className }, children);
      const content =
        tag === 'table' ? <div className="markdown-table-scroll">{rendered}</div> : rendered;
      return React.createElement(
        tag === 'li' ? 'li' : 'div',
        {
          className: `markdown-block${edited ? ` markdown-change ${kind}` : ''}`,
          'data-source-start': start,
          'data-source-end': end,
        },
        edited && (
          <span
            className="markdown-change-marker"
            aria-label={kind === 'removed' ? 'Removed content' : 'Added content'}
          >
            {kind === 'removed' ? '−' : '+'}
          </span>
        ),
        content,
        commentable.length > 0 && (
          <div
            className="rich-line-actions"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCommentOpen(false);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setCommentOpen(false);
            }}
          >
            <button
              type="button"
              aria-expanded={commentOpen}
              onClick={() => setCommentOpen((open) => !open)}
              className="rich-comment-trigger"
              aria-label={`Choose ${side} source line to comment, lines ${start} to ${end}`}
              title="Add a comment"
            >
              +
            </button>
            <div
              hidden={!commentOpen}
              className="rich-comment-lines"
              role="group"
              aria-label="Select source line"
            >
              {commentable.map(lineButton)}
            </div>
          </div>
        ),
      );
    };
  const components: Components = {
    p: block('p'),
    h1: block('h1'),
    h2: block('h2'),
    h3: block('h3'),
    h4: block('h4'),
    h5: block('h5'),
    h6: block('h6'),
    pre: block('pre'),
    li: block('li'),
    table: block('table'),
    // Previewing a private document must not silently request remote images.
    img: ({ alt, src }) => (
      <a className="markdown-image-link" href={src} target="_blank" rel="noreferrer">
        Image: {alt || 'View image'}
      </a>
    ),
    a: ({ href, children, title }) => (
      <a href={href} title={title} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
  };
  return (
    <div className="safe-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
      {!!anchors?.size && canComment && (
        <details
          className="rich-other-lines"
          onToggle={(event) => setShowSourceLines(event.currentTarget.open)}
        >
          <summary>Comment on other source lines</summary>
          {showSourceLines && (
            <div className="rich-source-lines">
              {[...anchors].map(([line]) => (
                <div key={line} className="rich-unrendered-line-actions">
                  {lineButton(line)}
                  <code>{sourceLines[line - 1] || '(blank line)'}</code>
                </div>
              ))}
            </div>
          )}
        </details>
      )}
    </div>
  );
}

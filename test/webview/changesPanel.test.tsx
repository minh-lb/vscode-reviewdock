import { MarkdownPreview } from '../../webview-ui/src/components/MarkdownPreview';
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFilePage, ReviewConversation } from '../../src/domain/models';
import { ChangesPanel } from '../../webview-ui/src/components/ChangesPanel';

const files: DiffFilePage = {
  items: [
    { path: 'docs/guide.md', change: 'modified', patch: '@@ -2 +2 @@\n-old\n+new' },
    { path: 'src/index.ts', change: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' },
  ],
  page: { page: 1, perPage: 50, hasNextPage: false },
};
const makeDiscussion = (id: string, line: number): ReviewConversation => ({
  id,
  provider: 'github',
  resourceType: 'github-review-comment',
  position: { path: 'docs/guide.md', side: 'old', line, oldLine: line },
  author: { id: 'reviewer', login: 'reviewer', name: 'Reviewer' },
  body: `Comment ${id}`,
  createdAt: '2026-11-17T00:00:00.000Z',
  replies: [],
});

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

function mount(props: React.ComponentProps<typeof ChangesPanel>) {
  host = document.createElement('div');
  document.body.append(host);
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(host);
  act(() => root.render(<ChangesPanel {...props} />));
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ChangesPanel', () => {
  it('keeps Markdown display choices on each file header independently', () => {
    const onStateChange = vi.fn();
    const markdownFiles: DiffFilePage = {
      ...files,
      items: [files.items[0]!, { ...files.items[0]!, path: 'docs/second.md' }],
    };
    mount({
      files: markdownFiles,
      onStateChange,
      contentByPath: {
        'docs/guide.md': { oldContent: 'Old', newContent: 'New' },
        'docs/second.md': { oldContent: 'Before', newContent: 'After' },
      },
    });
    const cards = host.querySelectorAll<HTMLElement>('.diff-file-card');
    act(() =>
      cards[0]!.querySelector<HTMLButtonElement>('[aria-label="Display the rich diff"]')!.click(),
    );
    expect(cards[0]!.querySelector('.rich-diff')).not.toBeNull();
    expect(cards[1]!.querySelector('.rich-diff')).toBeNull();
    expect(
      cards[1]!
        .querySelector('[aria-label="Display the source diff"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        viewsByPath: {
          'docs/guide.md': 'rich',
          'docs/second.md': 'source',
        },
      }),
    );
    expect(cards[0]!.querySelector('header [aria-label="Display the rich diff"]')).not.toBeNull();
  });

  it('opens the Layout menu, changes layout by keyboard, and restores focus on Escape', () => {
    mount({ files });
    const gear = host.querySelector<HTMLButtonElement>('[aria-label="Changes settings"]')!;
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
    act(() => gear.click());
    const radios = host.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(document.activeElement).toBe(radios[0]);
    act(() =>
      radios[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })),
    );
    expect(host.querySelectorAll('[role="radio"]')[1]?.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('.split-diff')).not.toBeNull();
    act(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
    expect(document.activeElement).toBe(gear);
    act(() => gear.click());
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('groups files by directory and selects a file for navigation', () => {
    const onSelectFile = vi.fn();
    mount({ files, onSelectFile });

    const directory = host.querySelector<HTMLButtonElement>('[aria-label="Directory docs"]')!;
    expect(directory.getAttribute('aria-expanded')).toBe('false');
    act(() => directory.click());
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="File docs/guide.md"]')!.click());
    expect(onSelectFile).toHaveBeenCalledWith('docs/guide.md');
  });

  it('shows removed and added rows with both line anchors', () => {
    mount({ files });
    expect(host.querySelector('.diff-row.removed .old-line')?.textContent).toBe('2');
    expect(host.querySelector('.diff-row.added .new-line')?.textContent).toBe('2');
    expect(host.textContent).toContain('−');
    expect(host.textContent).toContain('+');
  });

  it('renders rich Markdown from full blobs and safely treats HTML as text', () => {
    mount({
      files: {
        ...files,
        items: [{ ...files.items[0]!, patch: '@@ -2 +2 @@\n-Old text\n+New text' }],
      },
      contentByPath: {
        'docs/guide.md': {
          oldContent: '# Guide\nOld text',
          newContent: '# Guide\nNew text\n<script>bad()</script>',
        },
      },
      onStateChange: () => undefined,
      initialState: { view: 'rich' },
    });

    expect(host.querySelector('.rich-diff h1')?.textContent).toBe('Guide');
    expect(host.querySelector('.rich-diff script')).toBeNull();
    expect(host.textContent).toContain('New text');
    expect(host.textContent).toContain('<script>bad()</script>');
    expect(host.querySelector('.rich-side.added .markdown-change.added')?.textContent).toContain(
      'New text',
    );
    expect(
      host.querySelector('.rich-side.removed .markdown-change.removed')?.textContent,
    ).toContain('Old text');
    expect(host.querySelector('.rich-side.added h1')?.closest('.markdown-change')).toBeNull();
  });

  it('preserves old and new line anchors and inline commenting in split mode', () => {
    const onComment = vi.fn();
    mount({
      files: { ...files, items: [files.items[1]!] },
      initialState: { layout: 'split' },
      canComment: true,
      onComment,
    });
    const oldLine = host.querySelector<HTMLButtonElement>('.split-cell.removed .line-comment')!;
    const newLine = host.querySelector<HTMLButtonElement>('.split-cell.added .line-comment')!;
    expect(oldLine.getAttribute('aria-label')).toContain('line 1');
    expect(newLine.getAttribute('aria-label')).toContain('line 1');
    act(() => oldLine.click());
    expect(onComment).toHaveBeenCalledWith(expect.objectContaining({ side: 'old', oldLine: 1 }));
  });

  it('uses side-specific anchors for split context lines', () => {
    const onComment = vi.fn();
    mount({
      files: {
        ...files,
        items: [{ path: 'src/index.ts', change: 'modified', patch: '@@ -1 +1 @@\n same' }],
      },
      initialState: { layout: 'split' },
      canComment: true,
      onComment,
    });

    act(() => host.querySelector<HTMLButtonElement>('.split-context-row button')?.click());
    act(() => host.querySelector<HTMLButtonElement>('.split-cell.context .line-comment')!.click());
    act(() =>
      host.querySelectorAll<HTMLButtonElement>('.split-cell.context .line-comment')[1]!.click(),
    );
    expect(onComment.mock.calls.map(([position]) => position.side)).toEqual(['old', 'new']);
  });

  it('keeps rich comments on exact source rows and exposes discussions outside the patch', () => {
    const onComment = vi.fn();
    const conversations = [makeDiscussion('visible', 2), makeDiscussion('outside', 90)];
    mount({
      files: {
        ...files,
        items: [{ ...files.items[0]!, patch: '@@ -2 +2 @@\n-Old text\n+New text' }],
      },
      conversations,
      canComment: true,
      onComment,
      initialState: { view: 'rich' },
      contentByPath: {
        'docs/guide.md': { oldContent: '# Guide\nOld text', newContent: '# Guide\nNew text' },
      },
      renderDiscussion: (item) => <div data-thread={item.id}>{item.body}</div>,
    });

    expect(host.querySelector('[data-thread="visible"]')).not.toBeNull();
    const comment = host.querySelector<HTMLButtonElement>(
      '.rich-side.removed [aria-label="Comment on old line 2"]',
    )!;
    expect(comment.getAttribute('aria-label')).toBe('Comment on old line 2');
    act(() => comment.click());
    expect(onComment).toHaveBeenCalledWith(expect.objectContaining({ side: 'old', oldLine: 2 }));
    expect(host.querySelector('[data-thread="outside"]')).not.toBeNull();
    expect(host.textContent).toContain('Discussions outside visible patch');
    act(() =>
      host.querySelector<HTMLButtonElement>('.changes-unanchored-discussions button')!.click(),
    );
    expect(host.querySelector('.unified-diff')).not.toBeNull();
  });

  it('persists sidebar visibility and keeps keyboard resizing within bounds', () => {
    const onStateChange = vi.fn();
    mount({ files, onStateChange });
    const separator = host.querySelector<HTMLDivElement>('[role="separator"]')!;
    act(() => separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(separator.getAttribute('aria-valuenow')).toBe('460');
    const hide = host.querySelector<HTMLButtonElement>('[aria-label="Hide files"]')!;
    act(() => hide.click());
    expect(host.querySelector('[aria-label="Show files"]')).not.toBeNull();
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sidebarVisible: false, sidebarWidth: 460 }),
    );
  });

  it('scrolls the Changes container to its top and bottom when it owns overflow', () => {
    mount({ files });
    const diff = host.querySelector<HTMLDivElement>('.changes-diff')!;
    Object.defineProperties(diff, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
    });
    diff.style.overflowY = 'auto';
    const scrollTo = vi.fn();
    Object.defineProperty(diff, 'scrollTo', { configurable: true, value: scrollTo });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));

    act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Scroll Changes to top"]')!.click(),
    );
    act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Scroll Changes to bottom"]')!.click(),
    );

    expect(scrollTo.mock.calls.map(([options]) => options)).toEqual([
      expect.objectContaining({ top: 0 }),
      expect.objectContaining({ top: 800 }),
    ]);
    expect(scrollTo.mock.calls.every(([options]) => options.behavior === 'auto')).toBe(true);
  });

  it('scrolls the document when the Changes container has no own overflow', () => {
    mount({ files });
    const diff = host.querySelector<HTMLDivElement>('.changes-diff')!;
    vi.spyOn(diff, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 1100,
      left: 0,
      right: 800,
      width: 800,
      height: 1000,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Scroll Changes to bottom"]')!.click(),
    );

    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 332, behavior: 'smooth' }),
    );
  });

  it('reports missing full content instead of rendering the patch as a whole file', () => {
    const onLoadContent = vi.fn();
    mount({
      files: { ...files, items: [files.items[0]!] },
      onLoadContent,
      initialState: { view: 'rich' },
    });

    expect(host.textContent).toContain('Full file content unavailable');
    expect(onLoadContent).toHaveBeenCalledWith('docs/guide.md');
    expect(host.querySelector('.rich-diff')).toBeNull();
  });

  it('persists per-file collapse state and skips rendering its body while collapsed', () => {
    const onStateChange = vi.fn();
    mount({ files, onStateChange });
    const button = host.querySelector<HTMLButtonElement>(
      '[aria-label="Collapse diff for docs/guide.md"]',
    )!;
    expect(button.title).toBe('Collapse file');
    expect(button.querySelector('.diff-collapse-icon')?.textContent).toBe('›');
    expect(button.textContent).not.toMatch(/Expand|Collapse/);
    act(() => button.click());
    expect(
      host
        .querySelector('[aria-label="Expand diff for docs/guide.md"]')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(host.querySelector('[aria-label="Diff for docs/guide.md"] .unified-diff')).toBeNull();
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ collapsedPaths: ['docs/guide.md'] }),
    );
  });

  it('renders the complete Markdown file and anchors unchanged lines beyond its patch', () => {
    const onComment = vi.fn();
    mount({
      files: { ...files, items: [files.items[0]!] },
      initialState: { view: 'rich', layout: 'split' },
      canComment: true,
      onComment,
      contentByPath: {
        'docs/guide.md': {
          oldContent: '# Guide\nold\n\nUnchanged tail',
          newContent: '# Guide\nnew\n\nUnchanged tail',
        },
      },
    });
    expect(host.querySelector('.rich-side.added')?.textContent).toContain('Unchanged tail');
    expect(host.querySelector('.rich-side.removed')?.textContent).toContain('Unchanged tail');
    const lastLine = host.querySelector<HTMLButtonElement>('[aria-label="Comment on new line 4"]')!;
    act(() => lastLine.click());
    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'new', line: 4, oldLine: 4, newLine: 4 }),
    );
    expect(host.querySelector<HTMLDetailsElement>('.rich-other-lines')?.open).toBe(false);
  });

  it.each(['unified', 'split'] as const)(
    'keeps unchanged patch context hidden until expanded in %s',
    (layout) => {
      mount({
        files: {
          ...files,
          items: [
            {
              path: 'src/a.ts',
              change: 'modified',
              patch: '@@ -1,2 +1,2 @@\n unchanged context\n-old\n+new',
            },
          ],
        },
        initialState: { layout },
        canComment: true,
      });
      expect(host.textContent).not.toContain('unchanged context');
      const controls = host.querySelector<HTMLButtonElement>(
        layout === 'split' ? '.split-context-row button' : '.context-expansion button',
      )!;
      expect(controls).not.toBeNull();
      act(() => controls.click());
      expect(host.textContent).toContain('unchanged context');
    },
  );

  it('renders GFM structures and soft wraps without inserting line breaks into prose', () => {
    const text =
      '# Guide\n\n### Details\n\nFirst source line\ncontinues the paragraph.\n\n> A useful note\n\n1. First\n2. Second\n\n- [x] Reviewed\n- [ ] Pending\n\n| Name | Value |\n| --- | --- |\n| Status | **Ready** |\n\n~~Removed wording~~';
    mount({
      files: { ...files, items: [files.items[0]!] },
      initialState: { view: 'rich' },
      contentByPath: { 'docs/guide.md': { oldContent: text, newContent: text } },
    });
    const preview = host.querySelector('.rich-side.added')!;
    expect(preview.querySelector('.safe-markdown h3')?.textContent).toBe('Details');
    expect(preview.querySelector('blockquote')?.textContent).toContain('A useful note');
    expect(preview.querySelectorAll('ol li')).toHaveLength(2);
    expect(preview.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(preview.querySelector('table strong')?.textContent).toBe('Ready');
    expect(preview.querySelector('del')?.textContent).toBe('Removed wording');
    expect(preview.querySelector('p br')).toBeNull();
    expect(host.querySelector<HTMLDetailsElement>('.rich-previous-version')?.open).toBe(false);
  });

  it('keeps code readable while preserving exact comment positions', () => {
    mount({ files });
    const onComment = vi.fn();
    act(() =>
      root.render(
        <MarkdownPreview
          text={'```ts\nconst a = 1;\nconst b = 2;\n```'}
          anchors={
            new Map([
              [2, { row: { newLine: 2 } }],
              [3, { row: { newLine: 3 } }],
            ])
          }
          side="new"
          canComment
          onComment={onComment}
        />,
      ),
    );
    expect(host.querySelector('pre code')?.textContent).toBe('const a = 1;\nconst b = 2;\n');
    expect(host.querySelector('pre button')).toBeNull();
    const menu = host.querySelector<HTMLElement>('.rich-comment-lines')!;
    expect(menu.hidden).toBe(true);
    act(() => host.querySelector<HTMLButtonElement>('.rich-comment-trigger')!.click());
    expect(menu.hidden).toBe(false);
    act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Comment on new line 3"]')!.click(),
    );
    expect(onComment).toHaveBeenCalledWith({ newLine: 3 }, 'new');
  });

  it('renders untrusted Markdown without executable HTML or remote image requests', () => {
    mount({ files });
    act(() =>
      root.render(
        <MarkdownPreview
          text={
            '[unsafe](javascript:alert(1))\n\n![Diagram](https://example.com/tracking.png)\n\n<script>alert(1)</script>'
          }
        />,
      ),
    );
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(host.querySelector('.markdown-image-link')?.textContent).toContain('Diagram');
  });

  it('treats empty old and new blobs as valid content', () => {
    mount({
      files: {
        ...files,
        items: [{ path: 'docs/empty.md', change: 'modified', patch: '@@ -0,0 +0,0 @@' }],
      },
      initialState: { view: 'rich' },
      contentByPath: { 'docs/empty.md': { oldContent: '', newContent: '' } },
    });
    expect(host.textContent).not.toContain('Full file content unavailable');
    expect(host.querySelector('.rich-diff')).not.toBeNull();
  });

  it('loads full source context on demand and expands it in independent 20 line steps', () => {
    const onLoadContent = vi.fn();
    const oldLines = Array.from({ length: 21 }, (_, index) => `unchanged ${index + 1}`);
    const newLines = [...oldLines];
    oldLines.push('before');
    newLines.push('after');
    const sourceFile = {
      path: 'src/example.ts',
      change: 'modified' as const,
      patch: '@@ -22 +22 @@\n-before\n+after',
    };
    mount({
      files: { ...files, items: [sourceFile] },
      initialState: { layout: 'split' },
      canComment: true,
      onLoadContent,
    });
    expect(host.querySelector('.split-headers')?.textContent).toContain('Previous version');
    expect(host.querySelector('.split-headers')?.textContent).toContain('Current version');
    act(() => host.querySelector<HTMLButtonElement>('.context-load-status button')?.click());
    expect(onLoadContent).toHaveBeenCalledWith('src/example.ts');
    act(() =>
      root.render(
        <ChangesPanel
          files={{ ...files, items: [sourceFile] }}
          initialState={{ layout: 'split' }}
          canComment
          onLoadContent={onLoadContent}
          contentByPath={{
            'src/example.ts': {
              oldContent: oldLines.join('\n'),
              newContent: newLines.join('\n'),
            },
          }}
        />,
      ),
    );
    expect(host.querySelectorAll('.split-cell.context .line-comment')).toHaveLength(0);
    act(() => host.querySelector<HTMLButtonElement>('.split-context-row button')?.click());
    expect(host.querySelectorAll('.split-cell.context .line-comment')).toHaveLength(40);
    expect(host.querySelector('.split-headers')?.textContent).toContain('Previous version');
    expect(host.querySelector('.split-headers')?.textContent).toContain('Current version');
  });
});

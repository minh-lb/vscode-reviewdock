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
      files: { ...files, items: [files.items[0]!] },
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
      files: { ...files, items: [files.items[0]!] },
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
    const comment = host.querySelector<HTMLButtonElement>('.rich-side.removed .rich-line-comment')!;
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
});

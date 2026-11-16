import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../../src/domain/diff/parseUnifiedDiff';

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures/diff', name), 'utf8');

describe('parseUnifiedDiff', () => {
  it('tracks context, removed and added lines through multiple hunks', () => {
    const result = parseUnifiedDiff({
      patch: fixture('mixed-hunks.diff'),
      path: 'src/example.ts',
      change: 'modified',
    });
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.rows.map(({ kind, oldLine, newLine }) => [kind, oldLine, newLine])).toEqual([
      ['hunk-header', undefined, undefined],
      ['context', 1, 1],
      ['removed', 2, undefined],
      ['added', undefined, 2],
      ['context', 3, 3],
      ['hunk-header', undefined, undefined],
      ['removed', 10, undefined],
      ['added', undefined, 11],
    ]);
  });

  it('preserves rename paths and makes diff rows commentable', () => {
    const result = parseUnifiedDiff({
      patch: fixture('rename.diff'),
      path: 'new/name.txt',
      previousPath: 'old/name.txt',
      change: 'renamed',
    });
    expect(result).toMatchObject({
      status: 'available',
      previousPath: 'old/name.txt',
      path: 'new/name.txt',
    });
    if (result.status !== 'available') return;
    expect(result.rows.find((row) => row.kind === 'removed')).toMatchObject({
      oldLine: 1,
      commentable: true,
    });
    expect(result.rows.find((row) => row.kind === 'added')).toMatchObject({
      newLine: 1,
      commentable: true,
    });
  });

  it('keeps final lines commentable around no-newline markers', () => {
    const result = parseUnifiedDiff({
      patch: fixture('no-newline.diff'),
      path: 'eof.txt',
      change: 'modified',
    });
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(result.rows.filter((row) => row.kind !== 'hunk-header')).toEqual([
      expect.objectContaining({ kind: 'removed', oldLine: 1, commentable: true }),
      expect.objectContaining({ kind: 'added', newLine: 1, commentable: true }),
    ]);
  });

  it.each([
    ['wrong old count', '--- a/a\n+++ b/a\n@@ -4,2 +4,1 @@\n x\n-y\n+z\n'],
    ['missing hunk body', '--- a/a\n+++ b/a\n@@ -1,1 +1,1 @@\n x\n@@ malformed\n'],
    ['invalid hunk header', '--- a/a\n+++ b/a\n@@ -x +1 @@\n+x\n'],
    ['unprefixed hunk line', '--- a/a\n+++ b/a\n@@ -1 +1 @@\nplain\n'],
  ])('rejects %s without guessed rows', (_name, patch) => {
    expect(parseUnifiedDiff({ patch, path: 'a', change: 'modified' })).toMatchObject({
      status: 'invalid',
      rows: [],
    });
  });

  it.each([
    ['overlapping ranges', '--- a/a\n+++ b/a\n@@ -2,2 +2,2 @@\n a\n b\n@@ -3 +3 @@\n-c\n+d\n'],
    ['out-of-order ranges', '--- a/a\n+++ b/a\n@@ -5 +5 @@\n-a\n+b\n@@ -2 +2 @@\n-c\n+d\n'],
  ])('rejects %s hunks', (_name, patch) => {
    expect(parseUnifiedDiff({ patch, path: 'a', change: 'modified' })).toMatchObject({
      status: 'invalid',
      rows: [],
    });
  });

  it('safely parses zero-length sides for added and deleted files', () => {
    const added = parseUnifiedDiff({
      patch: '--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+new\n',
      path: 'new.txt',
      change: 'added',
    });
    const deleted = parseUnifiedDiff({
      patch: '--- a/old.txt\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n',
      path: 'old.txt',
      change: 'removed',
    });
    expect(added.status).toBe('available');
    if (added.status === 'available')
      expect(added.rows.find((row) => row.kind === 'added')).toMatchObject({
        newLine: 1,
        commentable: true,
      });
    expect(deleted.status).toBe('available');
    if (deleted.status === 'available')
      expect(deleted.rows.find((row) => row.kind === 'removed')).toMatchObject({
        oldLine: 1,
        commentable: true,
      });
  });

  it('does not parse absent, binary, or oversize patches as commentable diffs', () => {
    for (const input of [
      { patch: undefined },
      { patch: 'Binary files a/x and b/x differ', binary: true },
      { patch: undefined, tooLarge: true },
      { patch: undefined, collapsed: true },
    ]) {
      const result = parseUnifiedDiff({ ...input, path: 'x', change: 'modified' });
      expect(result.status).toBe('unavailable');
      if (result.status === 'unavailable') expect(result.rows).toEqual([]);
    }
  });
});

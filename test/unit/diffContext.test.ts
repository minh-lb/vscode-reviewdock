import { describe, expect, it } from 'vitest';
import { expandDiffContext } from '../../src/domain/diff/expandDiffContext';

const file = (
  patch: string,
  change: 'modified' | 'added' | 'removed' | 'renamed' = 'modified',
) => ({
  patch,
  path: 'file.txt',
  change,
});

describe('expandDiffContext', () => {
  it('fills unchanged gaps around provider hunks with verified dual line numbers', () => {
    const result = expandDiffContext(
      file('@@ -2 +2 @@\n-old\n+new\n@@ -5 +5 @@\n-last\n+last changed\n'),
      'first\nold\nthird\nfourth\nlast\nend\n',
      'first\nnew\nthird\nfourth\nlast changed\nend\n',
    );
    expect(result.status).toBe('available');
    if (result.status !== 'available') return;
    expect(
      result.rows
        .filter((row) => row.kind !== 'hunk-header')
        .map((row) => [row.kind, row.text, row.oldLine, row.newLine]),
    ).toEqual([
      ['context', 'first', 1, 1],
      ['removed', 'old', 2, undefined],
      ['added', 'new', undefined, 2],
      ['context', 'third', 3, 3],
      ['context', 'fourth', 4, 4],
      ['removed', 'last', 5, undefined],
      ['added', 'last changed', undefined, 5],
      ['context', 'end', 6, 6],
    ]);
    expect(
      result.rows.filter((row) => row.kind === 'context').every((row) => row.commentable),
    ).toBe(true);
    expect(result.rows.filter((row) => row.kind === 'context').map((row) => row.source)).toEqual([
      'full-file',
      'full-file',
      'full-file',
      'full-file',
    ]);
  });

  it('validates patch lines and unchanged gaps before expanding', () => {
    const patchMismatch = expandDiffContext(
      file('@@ -2 +2 @@\n-old\n+new\n'),
      'prefix\nnot old\n',
      'prefix\nnew\n',
    );
    const gapMismatch = expandDiffContext(
      file('@@ -2 +2 @@\n-old\n+new\n'),
      'prefix\nold\n',
      'different prefix\nnew\n',
    );
    for (const result of [patchMismatch, gapMismatch])
      expect(result).toMatchObject({
        status: 'invalid',
        reason: 'Full file content does not match provider patch',
        rows: [],
      });
  });

  it('rejects hunk coordinates beyond the supplied file without iterating the gap', () => {
    const result = expandDiffContext(
      file('@@ -9007199254740990 +9007199254740990 @@\n-old\n+new\n'),
      'old',
      'new',
    );
    expect(result).toMatchObject({
      status: 'invalid',
      reason: 'Full file content does not match provider patch',
      rows: [],
    });
  });

  it('returns provider rows unchanged until required content is available', () => {
    const patch = file('@@ -2 +2 @@\n-old\n+new\n');
    expect(expandDiffContext(patch, undefined, 'prefix\nnew\n')).toMatchObject({
      status: 'available',
      rows: expect.arrayContaining([expect.objectContaining({ kind: 'removed', text: 'old' })]),
    });
  });

  it('handles added and deleted files, including empty files', () => {
    const added = expandDiffContext(
      file('@@ -0,0 +1,2 @@\n+one\n+two\n', 'added'),
      undefined,
      'one\ntwo\n',
    );
    const removed = expandDiffContext(
      file('@@ -1,2 +0,0 @@\n-one\n-two\n', 'removed'),
      'one\ntwo\n',
      undefined,
    );
    const emptyAdded = expandDiffContext(file('@@ -0,0 +0,0 @@\n', 'added'), undefined, '');
    const emptyRemoved = expandDiffContext(file('@@ -0,0 +0,0 @@\n', 'removed'), '', undefined);
    expect(added.status).toBe('available');
    expect(removed.status).toBe('available');
    expect(emptyAdded.status).toBe('available');
    expect(emptyRemoved.status).toBe('available');
  });

  it('preserves trailing newline semantics and accepts renamed paths', () => {
    const result = expandDiffContext(
      { ...file('@@ -2 +2 @@\n-old\n+new\n', 'renamed'), previousPath: 'old/file.txt' },
      'line one\nold',
      'line one\nnew\n',
    );
    expect(result).toMatchObject({ status: 'available', previousPath: 'old/file.txt' });
    if (result.status === 'available')
      expect(result.rows.filter((row) => row.kind === 'context')).toEqual([
        expect.objectContaining({ text: 'line one', oldLine: 1, newLine: 1 }),
      ]);
  });
});

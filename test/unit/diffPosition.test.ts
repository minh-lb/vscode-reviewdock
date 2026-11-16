import { describe, expect, it } from 'vitest';
import { mapGitHubReviewLine } from '../../src/domain/diff/mapGitHubReviewLine';
import { mapGitLabDiscussionPosition } from '../../src/domain/diff/mapGitLabDiscussionPosition';
import type { DiffRow } from '../../src/domain/diff/types';

const row = (kind: DiffRow['kind'], oldLine?: number, newLine?: number): DiffRow => ({
  kind,
  oldLine,
  newLine,
  commentable: kind !== 'hunk-header',
  text: '',
  hunkIndex: 0,
});

describe('provider diff position mapping', () => {
  it.each([
    [row('added', undefined, 8), 8, 'RIGHT'],
    [row('removed', 7), 7, 'LEFT'],
    [row('context', 7, 8), 8, 'RIGHT'],
  ] as const)('maps GitHub %s to line and side', (diffRow, line, side) => {
    expect(mapGitHubReviewLine({ row: diffRow, path: 'src/a.ts', commitSha: 'head' })).toEqual({
      provider: 'github',
      path: 'src/a.ts',
      line,
      side,
      commitSha: 'head',
    });
  });

  it('maps GitLab added, removed and context lines with exact version SHAs and both paths', () => {
    const metadata = {
      oldPath: 'before.ts',
      newPath: 'after.ts',
      baseSha: 'base',
      startSha: 'start',
      headSha: 'head',
    };
    expect(mapGitLabDiscussionPosition({ row: row('added', undefined, 9), ...metadata })).toEqual({
      provider: 'gitlab',
      ...metadata,
      newLine: 9,
    });
    expect(mapGitLabDiscussionPosition({ row: row('removed', 8), ...metadata })).toEqual({
      provider: 'gitlab',
      ...metadata,
      oldLine: 8,
    });
    expect(mapGitLabDiscussionPosition({ row: row('context', 8, 9), ...metadata })).toEqual({
      provider: 'gitlab',
      ...metadata,
      oldLine: 8,
      newLine: 9,
    });
  });

  it('never creates anchors for hunk headers or incomplete values', () => {
    expect(
      mapGitHubReviewLine({ row: row('hunk-header'), path: 'a', commitSha: 'head' }),
    ).toBeNull();
    expect(
      mapGitLabDiscussionPosition({
        row: row('hunk-header'),
        oldPath: 'a',
        newPath: 'a',
        baseSha: 'b',
        startSha: 's',
        headSha: 'h',
      }),
    ).toBeNull();
    expect(
      mapGitHubReviewLine({ row: row('added', undefined, 1), path: 'a', commitSha: '' }),
    ).toBeNull();
    expect(
      mapGitHubReviewLine({ row: row('added', undefined, 0), path: 'a', commitSha: 'h' }),
    ).toBeNull();
    expect(
      mapGitLabDiscussionPosition({
        row: row('added', undefined, 1),
        oldPath: 'a',
        newPath: 'a',
        baseSha: 'b',
        startSha: 's',
        headSha: '',
      }),
    ).toBeNull();
  });
});

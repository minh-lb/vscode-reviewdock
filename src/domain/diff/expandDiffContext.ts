import type { DiffFile } from '../models';
import { parseUnifiedDiff } from './parseUnifiedDiff';
import type { DiffRow, ParsedDiff } from './types';

const hunkHeader = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const mismatchReason = 'Full file content does not match provider patch';

function contentLines(content: string): string[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Expands verified provider hunks with unchanged lines from both full file versions. */
export function expandDiffContext(
  file: DiffFile,
  oldContent: string | undefined,
  newContent: string | undefined,
): ParsedDiff {
  const parsed = parseUnifiedDiff(file);
  if (parsed.status !== 'available') return parsed;

  const oldText = oldContent ?? (file.change === 'added' ? '' : undefined);
  const newText = newContent ?? (file.change === 'removed' ? '' : undefined);
  if (oldText === undefined || newText === undefined) return parsed;

  const oldLines = contentLines(oldText);
  const newLines = contentLines(newText);
  const rows = parsed.rows;
  const expanded: DiffRow[] = [];
  let nextOld = 1;
  let nextNew = 1;
  let lastHunkIndex = 0;

  const addVerifiedGap = (oldEnd: number, newEnd: number, hunkIndex: number): boolean => {
    if (oldEnd > oldLines.length + 1 || newEnd > newLines.length + 1) return false;
    const oldCount = oldEnd - nextOld;
    const newCount = newEnd - nextNew;
    if (oldCount < 0 || oldCount !== newCount) return false;
    for (let offset = 0; offset < oldCount; offset += 1) {
      const text = oldLines[nextOld - 1 + offset]!;
      if (text !== newLines[nextNew - 1 + offset]) return false;
      expanded.push({
        kind: 'context',
        source: 'full-file',
        text,
        oldLine: nextOld + offset,
        newLine: nextNew + offset,
        hunkIndex,
        commentable: true,
      });
    }
    nextOld += oldCount;
    nextNew += newCount;
    return true;
  };

  for (let index = 0; index < rows.length;) {
    const header = rows[index]!;
    if (header.kind !== 'hunk-header')
      return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
    const match = hunkHeader.exec(header.text);
    if (!match) return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
    const oldStart = Number(match[1]);
    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newStart = Number(match[3]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    const oldFirst = oldCount === 0 ? oldStart + 1 : oldStart;
    const newFirst = newCount === 0 ? newStart + 1 : newStart;
    if (!addVerifiedGap(oldFirst, newFirst, header.hunkIndex))
      return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };

    expanded.push(header);
    index += 1;
    let seenOld = 0;
    let seenNew = 0;
    while (index < rows.length && rows[index]!.kind !== 'hunk-header') {
      const row = rows[index]!;
      if (
        (row.kind === 'context' || row.kind === 'removed') &&
        (row.oldLine !== nextOld || oldLines[nextOld - 1] !== row.text)
      )
        return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
      if (
        (row.kind === 'context' || row.kind === 'added') &&
        (row.newLine !== nextNew || newLines[nextNew - 1] !== row.text)
      )
        return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
      expanded.push(row);
      if (row.kind === 'context') {
        nextOld += 1;
        nextNew += 1;
        seenOld += 1;
        seenNew += 1;
      } else if (row.kind === 'removed') {
        nextOld += 1;
        seenOld += 1;
      } else if (row.kind === 'added') {
        nextNew += 1;
        seenNew += 1;
      } else {
        return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
      }
      index += 1;
    }
    if (seenOld !== oldCount || seenNew !== newCount)
      return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
    lastHunkIndex = header.hunkIndex;
  }

  if (!addVerifiedGap(oldLines.length + 1, newLines.length + 1, lastHunkIndex))
    return { ...parsed, status: 'invalid', reason: mismatchReason, rows: [] };
  return { ...parsed, rows: expanded };
}

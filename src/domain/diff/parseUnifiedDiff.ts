import type { DiffFile } from '../models';
import type { DiffRow, ParsedDiff } from './types';

const hunkHeader = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/;

/** Parses a provider file patch. Any malformed hunk invalidates the whole patch to prevent guessed anchors. */
export function parseUnifiedDiff(file: DiffFile): ParsedDiff {
  const identity = {
    path: file.path,
    ...(file.previousPath === undefined ? {} : { previousPath: file.previousPath }),
    change: file.change,
  };
  const unavailable = (reason: 'missing' | 'binary' | 'collapsed' | 'too-large'): ParsedDiff => ({
    ...identity,
    status: 'unavailable',
    reason,
    rows: [],
  });
  if (file.tooLarge) return unavailable('too-large');
  if (file.collapsed) return unavailable('collapsed');
  if (file.binary || (file.patch && /^(?:Binary files |GIT binary patch)/m.test(file.patch)))
    return unavailable('binary');
  if (file.patch === undefined || file.patch === '') return unavailable('missing');

  const lines = file.patch.replace(/\r\n?/g, '\n').split('\n');
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let expectedOld = 0;
  let expectedNew = 0;
  let seenOld = 0;
  let seenNew = 0;
  let inHunk = false;
  let hunkIndex = -1;
  let sawHunk = false;
  let previousOldEnd: number | undefined;
  let previousNewEnd: number | undefined;

  const invalid = (reason: string): ParsedDiff => ({
    ...identity,
    status: 'invalid',
    reason,
    rows: [],
  });
  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (inHunk && (seenOld !== expectedOld || seenNew !== expectedNew))
        return invalid('Hunk line counts do not match its header');
      const match = hunkHeader.exec(line);
      if (!match) return invalid('Malformed hunk header');
      oldLine = Number(match[1]);
      expectedOld = match[2] === undefined ? 1 : Number(match[2]);
      newLine = Number(match[3]);
      expectedNew = match[4] === undefined ? 1 : Number(match[4]);
      if (![oldLine, newLine, expectedOld, expectedNew].every(Number.isSafeInteger))
        return invalid('Hunk line number exceeds safe integer range');
      if ((expectedOld > 0 && oldLine < 1) || (expectedNew > 0 && newLine < 1))
        return invalid('Non-empty hunk ranges must start at a positive line');
      if (
        (previousOldEnd !== undefined && oldLine < previousOldEnd) ||
        (previousNewEnd !== undefined && newLine < previousNewEnd)
      )
        return invalid('Hunks overlap or are out of order');
      previousOldEnd = oldLine + expectedOld;
      previousNewEnd = newLine + expectedNew;
      if (!Number.isSafeInteger(previousOldEnd) || !Number.isSafeInteger(previousNewEnd))
        return invalid('Hunk range exceeds safe integer range');
      seenOld = 0;
      seenNew = 0;
      inHunk = true;
      sawHunk = true;
      hunkIndex += 1;
      rows.push({ kind: 'hunk-header', text: line, hunkIndex, commentable: false });
      continue;
    }
    if (!inHunk) continue; // File headers and rename/mode metadata aren't commentable rows.
    if (line.startsWith('\\ No newline at end of file')) continue;
    if (seenOld === expectedOld && seenNew === expectedNew) {
      // Permit trailing separator only; any later content without a new hunk is malformed.
      if (line === '') continue;
      return invalid('Unexpected content after hunk line counts were satisfied');
    }
    const prefix = line[0];
    const text = line.slice(1);
    if (prefix === ' ') {
      rows.push({ kind: 'context', text, oldLine, newLine, hunkIndex, commentable: true });
      oldLine += 1;
      newLine += 1;
      seenOld += 1;
      seenNew += 1;
    } else if (prefix === '-') {
      rows.push({ kind: 'removed', text, oldLine, hunkIndex, commentable: true });
      oldLine += 1;
      seenOld += 1;
    } else if (prefix === '+') {
      rows.push({ kind: 'added', text, newLine, hunkIndex, commentable: true });
      newLine += 1;
      seenNew += 1;
    } else {
      return invalid('Malformed hunk body line');
    }
    if (seenOld > expectedOld || seenNew > expectedNew)
      return invalid('Hunk contains more lines than declared');
  }
  if (!sawHunk) return invalid('Patch contains no unified diff hunks');
  if (seenOld !== expectedOld || seenNew !== expectedNew)
    return invalid('Hunk line counts do not match its header');
  return { ...identity, status: 'available', rows };
}

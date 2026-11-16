import type { DiffRow } from './types';

export interface GitLabDiscussionPosition {
  provider: 'gitlab';
  oldPath: string;
  newPath: string;
  oldLine?: number;
  newLine?: number;
  baseSha: string;
  startSha: string;
  headSha: string;
}
/** Maps a diff row to a single-line GitLab discussion position using one exact diff version. */
export function mapGitLabDiscussionPosition(input: {
  row: DiffRow;
  oldPath?: string;
  newPath?: string;
  baseSha?: string;
  startSha?: string;
  headSha?: string;
}): GitLabDiscussionPosition | null {
  const { row, oldPath, newPath, baseSha, startSha, headSha } = input;
  if (!row.commentable || !oldPath || !newPath || !baseSha || !startSha || !headSha) return null;
  const common = { provider: 'gitlab' as const, oldPath, newPath, baseSha, startSha, headSha };
  if (row.kind === 'added' && isLine(row.newLine)) return { ...common, newLine: row.newLine };
  if (row.kind === 'removed' && isLine(row.oldLine)) return { ...common, oldLine: row.oldLine };
  if (row.kind === 'context' && isLine(row.oldLine) && isLine(row.newLine))
    return { ...common, oldLine: row.oldLine, newLine: row.newLine };
  return null;
}
const isLine = (line: number | undefined): line is number =>
  Number.isSafeInteger(line) && line! > 0;

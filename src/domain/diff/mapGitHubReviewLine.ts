import type { DiffRow } from './types';

export interface GitHubReviewLine {
  provider: 'github';
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  commitSha: string;
}
/** Maps only rows supported by GitHub's single-line review-comment API. */
export function mapGitHubReviewLine(input: {
  row: DiffRow;
  path?: string;
  commitSha?: string;
}): GitHubReviewLine | null {
  const { row, path, commitSha } = input;
  if (!row.commentable || !path || !commitSha) return null;
  if (row.kind === 'added' && isLine(row.newLine))
    return { provider: 'github', path, line: row.newLine, side: 'RIGHT', commitSha };
  if (row.kind === 'removed' && isLine(row.oldLine))
    return { provider: 'github', path, line: row.oldLine, side: 'LEFT', commitSha };
  if (row.kind === 'context' && isLine(row.newLine))
    return { provider: 'github', path, line: row.newLine, side: 'RIGHT', commitSha };
  return null;
}
const isLine = (line: number | undefined): line is number =>
  Number.isSafeInteger(line) && line! > 0;

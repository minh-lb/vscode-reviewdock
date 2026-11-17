import type { DiffFile } from '../models';

export type DiffRowKind = 'context' | 'added' | 'removed' | 'hunk-header';
export interface DiffRow {
  kind: DiffRowKind;
  source?: 'patch' | 'full-file';
  text: string;
  oldLine?: number;
  newLine?: number;
  hunkIndex: number;
  commentable: boolean;
}
export type ParsedDiff =
  | (Pick<DiffFile, 'path' | 'previousPath' | 'change'> & { status: 'available'; rows: DiffRow[] })
  | (Pick<DiffFile, 'path' | 'previousPath' | 'change'> & {
      status: 'unavailable';
      reason: 'missing' | 'binary' | 'collapsed' | 'too-large';
      rows: [];
    })
  | (Pick<DiffFile, 'path' | 'previousPath' | 'change'> & {
      status: 'invalid';
      reason: string;
      rows: [];
    });

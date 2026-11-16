import { describe, expect, it } from 'vitest';
import type { Connection, ReviewRequestSummary } from '../../src/domain/models';
import {
  connectionLabel,
  resolveFolderBinding,
  reviewFilters,
  reviewRequestLabel,
  selectWorkspaceFolder,
  statusLabel,
} from '../../src/presentation/tree/treeItems';
import { connectionChoice } from '../../src/presentation/tree/connectionSelection';

const connection: Connection = {
  id: 'conn-1',
  provider: 'gitlab',
  displayName: 'Internal',
  serverUrl: 'https://git.example.test',
  accountLogin: 'dev',
  enabled: false,
  status: 'connected',
  createdAt: '',
  updatedAt: '',
};
const summary: ReviewRequestSummary = {
  id: 'global-id',
  number: '42',
  repositoryId: 'project-id',
  title: 'Fix login',
  state: 'merged',
  author: { id: '1', login: 'dev' },
  sourceBranch: 'fix/login',
  targetBranch: 'main',
  draft: false,
  createdAt: '',
  updatedAt: '',
  webUrl: 'https://git.example.test/group/project/-/merge_requests/42',
};

describe('navigation item mapping', () => {
  it('keeps enabled state distinct from last-known connection health', () => {
    expect(connectionLabel(connection)).toBe(
      'GitLab · Internal · @dev · git.example.test · Disabled · last known Connected',
    );
    expect(statusLabel('reauthentication-required')).toBe('Re-auth required');
  });

  it('exposes the supported request groups and native request identifier', () => {
    expect(reviewFilters.map((item) => item.filter)).toEqual([
      'review-requested-from-me',
      'assigned-to-me',
      'created-by-me',
      'open',
      'closed',
      'merged',
    ]);
    expect(reviewRequestLabel(summary)).toBe('42 · Fix login · Merged');
    expect(summary.number).not.toBe(summary.id);
  });

  it('auto-selects a single workspace and resolves its persisted repository binding', () => {
    const folders = [{ uri: { toString: () => 'file:///workspace/app' } }];
    const folder = selectWorkspaceFolder(folders);
    const persisted = { connectionId: 'conn-1', repositoryId: 'project-42' };
    expect(
      resolveFolderBinding(folder?.uri.toString(), (uri) =>
        uri === 'file:///workspace/app' ? persisted : undefined,
      ),
    ).toBe(persisted);
    expect(
      selectWorkspaceFolder([...folders, { uri: { toString: () => 'file:///workspace/tools' } }]),
    ).toBeUndefined();
  });

  it('applies provider defaults only for folders without a binding', () => {
    const github = { id: 'gh', provider: 'github' as const, enabled: true };
    const gitlab = { id: 'gl', provider: 'gitlab' as const, enabled: true };
    expect(connectionChoice(false, [github, gitlab], { github })).toEqual({
      kind: 'selected',
      connection: github,
    });
    expect(connectionChoice(false, [github, gitlab], { github, gitlab })).toEqual({
      kind: 'choose',
      connections: [github, gitlab],
    });
    expect(connectionChoice(true, [github, gitlab], { github })).toEqual({ kind: 'blocked' });
    expect(
      connectionChoice(false, [github, gitlab], { github: { ...github, enabled: false } }),
    ).toEqual({ kind: 'choose', connections: [github, gitlab] });
  });
});

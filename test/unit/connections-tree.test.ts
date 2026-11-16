import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
  TreeItem: class {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class {
    constructor(public id: string) {}
  },
  window: { showErrorMessage: vi.fn(), showWarningMessage: vi.fn() },
}));

import type { Connection } from '../../src/domain/models';
import type { ReviewProvider } from '../../src/application/ports';
import { ConnectionsTree, type ConnectionNode } from '../../src/presentation/tree/connectionsTree';

const connection: Connection = {
  id: 'account-a',
  provider: 'github',
  displayName: 'Work',
  serverUrl: 'https://github.com',
  enabled: true,
  status: 'connected',
  createdAt: '',
  updatedAt: '',
};
const repository = {
  id: 'repo-1',
  connectionId: connection.id,
  provider: 'github' as const,
  name: 'app',
  fullName: 'team/app',
  owner: 'team',
  webUrl: 'https://github.com/team/app',
};
const request = {
  id: 'pr-1',
  repositoryId: repository.id,
  connectionId: connection.id,
  number: '17',
  title: 'Fix it',
  state: 'open' as const,
  author: { id: 'u1', login: 'dev' },
  sourceBranch: 'fix',
  targetBranch: 'main',
  createdAt: '',
  updatedAt: '',
  webUrl: 'https://github.com/team/app/pull/17',
};
const page = <T>(items: T[], number: number, hasNextPage: boolean) => ({
  items,
  page: { page: number, perPage: 1, hasNextPage },
});

function fixture() {
  const provider = {
    listRepositories: vi.fn().mockResolvedValue(page([repository], 1, false)),
    listReviewRequests: vi.fn().mockResolvedValue(page([request], 1, false)),
  } as unknown as ReviewProvider;
  const tree = new ConnectionsTree(
    { listConnections: () => [connection] } as never,
    () => provider,
  );
  return { tree, provider };
}

async function loadTree(tree: ConnectionsTree, node: ConnectionNode) {
  await tree.getChildren(node);
  return tree.getChildren(node);
}

describe('connection hierarchy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lazily loads repositories, then open requests, without workspace binding', async () => {
    const { tree, provider } = fixture();
    const roots = await tree.getChildren();
    expect(provider.listRepositories).not.toHaveBeenCalled();
    const repos = await loadTree(tree, roots[0]!);
    const repoNode = repos.find((node) => node.kind === 'repository')!;
    const requests = await loadTree(tree, repoNode);
    expect(provider.listReviewRequests).toHaveBeenCalledWith({
      repositoryId: 'repo-1',
      filter: 'open',
      page: 1,
      perPage: 20,
    });
    expect(requests.find((node) => node.kind === 'request')?.summary).toEqual(request);
  });

  it('keeps each connection scoped to its own provider and retryable errors', async () => {
    const failed = { ...connection, id: 'account-b', displayName: 'Other' };
    const provider = {
      listRepositories: vi
        .fn()
        .mockRejectedValueOnce(new Error('denied'))
        .mockResolvedValue(page([], 1, false)),
      listReviewRequests: vi.fn(),
    } as unknown as ReviewProvider;
    const tree = new ConnectionsTree(
      { listConnections: () => [connection, failed] } as never,
      (item) => {
        expect(item.id).toBe('account-b');
        return provider;
      },
    );
    const roots = await tree.getChildren();
    await tree.getChildren(roots[1]!);
    expect((await tree.getChildren(roots[1]!)).some((node) => node.kind === 'error')).toBe(true);
    const retry = (await tree.getChildren(roots[1]!)).find((node) => node.kind === 'error')!;
    await tree.retry(retry);
    expect((await tree.getChildren(roots[1]!)).some((node) => node.kind === 'empty')).toBe(true);
    expect(provider.listRepositories).toHaveBeenCalledTimes(2);
  });
});

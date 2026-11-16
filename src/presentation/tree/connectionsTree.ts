import * as vscode from 'vscode';
import type { Connection, RepositoryRef, ReviewRequestSummary } from '../../domain/models';
import type { ConnectionService } from '../../application/connectionService';
import type { ReviewProvider } from '../../application/ports';
import { connectionLabel, reviewRequestLabel, statusLabel } from './treeItems';

export type ConnectionNode =
  | { kind: 'connection'; connection: Connection }
  | { kind: 'repository'; connection: Connection; repository: RepositoryRef }
  | {
      kind: 'request';
      connection: Connection;
      repository: RepositoryRef;
      summary: ReviewRequestSummary;
    }
  | { kind: 'more-repositories'; connection: Connection; page: number }
  | { kind: 'more-requests'; connection: Connection; repository: RepositoryRef; page: number }
  | { kind: 'loading' | 'empty'; label: string }
  | { kind: 'error'; label: string; connection: Connection; repository?: RepositoryRef };

type PageCache<T> = {
  items: T[];
  page: number;
  hasMore: boolean;
  loading?: Promise<void>;
  error?: string;
};

export class ConnectionsTree implements vscode.TreeDataProvider<ConnectionNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private generation = 0;
  private readonly repositories = new Map<string, PageCache<RepositoryRef>>();
  private readonly requests = new Map<string, PageCache<ReviewRequestSummary>>();

  constructor(
    private readonly service: ConnectionService,
    private readonly providerFor: (connection: Connection) => ReviewProvider,
  ) {}

  refresh(): void {
    this.generation++;
    this.repositories.clear();
    this.requests.clear();
    this.changed.fire();
  }

  invalidate(connectionId: string, repositoryId: string): void {
    this.requests.delete(`${connectionId}:${repositoryId}`);
    this.changed.fire();
  }

  getTreeItem(node: ConnectionNode): vscode.TreeItem {
    if (node.kind === 'connection') {
      const connection = node.connection;
      const item = new vscode.TreeItem(
        connectionLabel(connection),
        connection.enabled
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      );
      item.id = `connection:${connection.id}`;
      item.contextValue = connection.enabled
        ? 'reviewdock.connection.enabled'
        : 'reviewdock.connection.disabled';
      item.description = connection.enabled
        ? (connection.accountName ?? statusLabel(connection.status))
        : 'Disabled';
      item.iconPath = new vscode.ThemeIcon(
        connection.provider === 'github' ? 'github' : 'git-merge',
      );
      return item;
    }
    if (node.kind === 'repository') {
      const item = new vscode.TreeItem(
        node.repository.fullName,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.id = `repository:${node.connection.id}:${node.repository.id}`;
      item.description = node.repository.private ? 'Private · Open requests' : 'Open requests';
      item.contextValue = 'reviewdock.repository';
      item.iconPath = new vscode.ThemeIcon('repo');
      return item;
    }
    if (node.kind === 'request') {
      const item = new vscode.TreeItem(
        reviewRequestLabel(node.summary),
        vscode.TreeItemCollapsibleState.None,
      );
      item.id = `request:${node.connection.id}:${node.repository.id}:${node.summary.id}`;
      item.contextValue = 'reviewdock.request';
      item.description = `${node.summary.author.login} · ${node.summary.sourceBranch} → ${node.summary.targetBranch}`;
      item.iconPath = new vscode.ThemeIcon('git-pull-request');
      item.command = {
        command: 'reviewdock.openConnectionReviewRequest',
        title: 'Open Review Request',
        arguments: [node],
      };
      return item;
    }
    const label =
      node.kind === 'more-repositories' || node.kind === 'more-requests'
        ? 'Load More…'
        : node.label;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.id =
      node.kind === 'more-repositories'
        ? `more-repositories:${node.connection.id}`
        : node.kind === 'more-requests'
          ? `more-requests:${node.connection.id}:${node.repository.id}`
          : node.kind === 'error'
            ? `error:${node.connection.id}:${node.repository?.id ?? 'repositories'}`
            : `${node.kind}:${node.label}`;
    if (node.kind === 'more-repositories' || node.kind === 'more-requests') {
      item.contextValue = 'reviewdock.loadMore';
      item.command = {
        command: 'reviewdock.loadConnectionTreeMore',
        title: 'Load More',
        arguments: [node],
      };
    } else if (node.kind === 'error') {
      item.contextValue = 'reviewdock.retry';
      item.command = {
        command: 'reviewdock.retryConnectionTree',
        title: 'Retry',
        arguments: [node],
      };
      item.iconPath = new vscode.ThemeIcon('warning');
    }
    return item;
  }

  getChildren(node?: ConnectionNode): ConnectionNode[] {
    if (!node)
      return this.service
        .listConnections()
        .map((connection) => ({ kind: 'connection', connection }));
    if (node.kind === 'connection') {
      if (!node.connection.enabled || node.connection.status !== 'connected') return [];
      const cache = this.repositories.get(node.connection.id) ?? {
        items: [],
        page: 0,
        hasMore: true,
      };
      this.repositories.set(node.connection.id, cache);
      if (cache.page === 0 && !cache.loading && !cache.error)
        void this.loadRepositories(node.connection, cache, 1);
      return this.pageChildren(cache, node.connection);
    }
    if (node.kind === 'repository') {
      if (!node.connection.enabled || node.connection.status !== 'connected') return [];
      const key = `${node.connection.id}:${node.repository.id}`;
      const cache = this.requests.get(key) ?? { items: [], page: 0, hasMore: true };
      this.requests.set(key, cache);
      if (cache.page === 0 && !cache.loading && !cache.error)
        void this.loadRequests(node, cache, 1);
      return this.pageChildren(cache, node.connection, node.repository);
    }
    return [];
  }

  async loadMore(node: ConnectionNode): Promise<void> {
    if (node.kind === 'more-repositories') {
      const cache = this.repositories.get(node.connection.id);
      if (cache) await this.loadRepositories(node.connection, cache, node.page);
    } else if (node.kind === 'more-requests') {
      const cache = this.requests.get(`${node.connection.id}:${node.repository.id}`);
      if (cache)
        await this.loadRequests(
          { kind: 'repository', connection: node.connection, repository: node.repository },
          cache,
          node.page,
        );
    }
  }

  async retry(node: ConnectionNode): Promise<void> {
    if (node.kind !== 'error') return;
    if (node.repository) {
      const cache = this.requests.get(`${node.connection.id}:${node.repository.id}`);
      if (cache) {
        delete cache.error;
        await this.loadRequests(
          { kind: 'repository', connection: node.connection, repository: node.repository },
          cache,
          cache.page + 1,
        );
      }
    } else {
      const cache = this.repositories.get(node.connection.id);
      if (cache) {
        delete cache.error;
        await this.loadRepositories(node.connection, cache, cache.page + 1);
      }
    }
  }

  private pageChildren<T extends RepositoryRef | ReviewRequestSummary>(
    cache: PageCache<T>,
    connection: Connection,
    repository?: RepositoryRef,
  ): ConnectionNode[] {
    const items: ConnectionNode[] = cache.items.map((value) =>
      repository
        ? { kind: 'request', connection, repository, summary: value as ReviewRequestSummary }
        : { kind: 'repository', connection, repository: value as RepositoryRef },
    );
    if (cache.loading)
      return [
        ...items,
        { kind: 'loading', label: `Loading ${repository ? 'open requests' : 'repositories'}…` },
      ];
    if (cache.error)
      return [
        ...items,
        {
          kind: 'error',
          label: `${cache.error} · Retry`,
          connection,
          ...(repository ? { repository } : {}),
        },
      ];
    if (cache.hasMore)
      items.push(
        repository
          ? { kind: 'more-requests', connection, repository, page: cache.page + 1 }
          : { kind: 'more-repositories', connection, page: cache.page + 1 },
      );
    if (!cache.items.length && !cache.hasMore)
      items.push({
        kind: 'empty',
        label: repository ? 'No open pull requests or merge requests.' : 'No repositories found.',
      });
    return items;
  }

  private loadRepositories(
    connection: Connection,
    cache: PageCache<RepositoryRef>,
    page: number,
  ): Promise<void> {
    return this.load(
      cache,
      () => this.providerFor(connection).listRepositories({ page, perPage: 20 }),
      page,
    );
  }

  private loadRequests(
    node: Extract<ConnectionNode, { kind: 'repository' }>,
    cache: PageCache<ReviewRequestSummary>,
    page: number,
  ): Promise<void> {
    return this.load(
      cache,
      () =>
        this.providerFor(node.connection).listReviewRequests({
          repositoryId: node.repository.id,
          filter: 'open',
          page,
          perPage: 20,
        }),
      page,
    );
  }

  private load<T>(
    cache: PageCache<T>,
    fetchPage: () => Promise<{ items: T[]; page: { hasNextPage: boolean } }>,
    page: number,
  ): Promise<void> {
    if (cache.loading) return cache.loading;
    const generation = this.generation;
    delete cache.error;
    cache.loading = (async () => {
      try {
        const result = await fetchPage();
        if (generation !== this.generation) return;
        cache.items = page === 1 ? result.items : [...cache.items, ...result.items];
        cache.page = page;
        cache.hasMore = result.page.hasNextPage;
      } catch (error) {
        if (generation === this.generation)
          cache.error = error instanceof Error ? error.message : 'Could not load results';
      } finally {
        delete cache.loading;
        if (generation === this.generation) this.changed.fire();
      }
    })();
    this.changed.fire();
    return cache.loading;
  }

  dispose(): void {
    this.changed.dispose();
  }
}

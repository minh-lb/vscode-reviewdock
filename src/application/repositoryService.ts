import { AppError, ConnectionDisabledError } from '../domain/errors';
import type { Connection, ProviderType, RepositoryRef } from '../domain/models';
import type { ReviewProvider } from './ports';
import type { ConnectionService, ConnectionStateStore } from './connectionService';

export interface ParsedRemote {
  provider?: ProviderType;
  host: string;
  path: string;
}
export interface RepositoryBinding {
  workspaceFolder: string;
  connectionId: string;
  provider: ProviderType;
  repositoryId: string;
  fullName: string;
  webUrl: string;
  lastValidatedAt?: string;
}
export interface RepositoryBindingStore {
  get<T>(key: string, fallback: T): T;
  update<T>(key: string, value: T): Promise<void>;
}
export type ProviderForConnection = (connection: Connection) => ReviewProvider;
export interface RemoteCandidate {
  connection: Connection;
  repository: RepositoryRef;
}

/** Parses ordinary GitHub/GitLab HTTPS and SSH remotes without ever using embedded URL credentials. */
export function parseGitRemote(remote: string): ParsedRemote | undefined {
  const value = remote.trim();
  let host: string;
  let path: string;
  try {
    const scp = /^(?:[^@/:]+@)?([^/:]+):(.+)$/.exec(value);
    if (scp && !value.includes('://')) {
      host = scp[1]!;
      path = scp[2]!;
    } else {
      const url = new URL(value);
      if (!['https:', 'ssh:', 'git:'].includes(url.protocol)) return undefined;
      host = url.hostname;
      path = url.pathname.replace(/^\/+/, '');
    }
  } catch {
    return undefined;
  }
  if (!host || !path) return undefined;
  try {
    path = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  path = path.replace(/\/+$/, '').replace(/\.git$/i, '');
  if (!path || path.split('/').some((segment) => !segment || segment === '.' || segment === '..'))
    return undefined;
  return { host: host.toLowerCase(), path };
}

export class RepositoryService {
  constructor(
    private readonly connections: ConnectionService,
    private readonly providerFor: ProviderForConnection,
    private readonly bindings: RepositoryBindingStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  parseRemote(remote: string): ParsedRemote | undefined {
    return parseGitRemote(remote);
  }

  /** Return every accessible connection/repository pair; callers must ask when more than one matches. */
  async matchRemote(remote: string): Promise<RemoteCandidate[]> {
    const parsed = parseGitRemote(remote);
    if (!parsed) return [];
    const candidates = this.connections
      .listConnections()
      .filter((connection) => connection.enabled && this.hostMatches(connection, parsed.host));
    const failures: unknown[] = [];
    const results = await Promise.all(
      candidates.map(async (connection) => {
        const relativePath = this.repositoryPath(connection, parsed.path);
        if (!relativePath) return undefined;
        try {
          const repository = await this.providerFor(connection).getRepository(relativePath);
          return repository.fullName.toLowerCase() === relativePath.toLowerCase()
            ? { connection, repository }
            : undefined;
        } catch (error) {
          if (!(error instanceof ConnectionDisabledError)) failures.push(error);
          return undefined;
        }
      }),
    );
    const matches = results.filter((result): result is RemoteCandidate => !!result);
    if (!matches.length && failures.length) throw failures[0];
    return matches;
  }

  async bind(
    workspaceFolder: string,
    connectionId: string,
    repository: RepositoryRef,
  ): Promise<RepositoryBinding> {
    const connection = this.connections.getConnection(connectionId);
    if (!connection.enabled) throw new ConnectionDisabledError(connectionId);
    if (repository.connectionId && repository.connectionId !== connectionId)
      throw new AppError('Repository belongs to a different connection', 'validation');
    if (repository.provider && repository.provider !== connection.provider)
      throw new AppError('Repository provider does not match connection', 'validation');
    const binding: RepositoryBinding = {
      workspaceFolder,
      connectionId,
      provider: connection.provider,
      repositoryId: repository.id,
      fullName: repository.fullName,
      webUrl: repository.webUrl,
      lastValidatedAt: this.now().toISOString(),
    };
    const all = this.allBindings();
    await this.bindings.update('reviewdock.repositoryBindings', {
      ...all,
      [workspaceFolder]: binding,
    });
    return binding;
  }

  getBinding(workspaceFolder: string): RepositoryBinding | undefined {
    return this.allBindings()[workspaceFolder];
  }

  /** A disabled or deleted binding stays present but cannot resolve to another account. */
  resolveBinding(
    workspaceFolder: string,
  ): { binding: RepositoryBinding; connection: Connection } | undefined {
    const binding = this.getBinding(workspaceFolder);
    if (!binding) return undefined;
    const connection = this.connections
      .listConnections()
      .find((item) => item.id === binding.connectionId);
    if (!connection) return undefined;
    if (!connection.enabled) throw new ConnectionDisabledError(connection.id);
    return { binding, connection };
  }

  private allBindings(): Record<string, RepositoryBinding> {
    return this.bindings.get('reviewdock.repositoryBindings', {});
  }
  private hostMatches(connection: Connection, remoteHost: string): boolean {
    try {
      return new URL(connection.serverUrl).hostname.toLowerCase() === remoteHost.toLowerCase();
    } catch {
      return false;
    }
  }
  private repositoryPath(connection: Connection, remotePath: string): string | undefined {
    try {
      const prefix = new URL(connection.serverUrl).pathname.replace(/^\/+|\/+$/g, '');
      if (prefix && !remotePath.toLowerCase().startsWith(`${prefix.toLowerCase()}/`))
        return undefined;
      const path = prefix ? remotePath.slice(prefix.length + 1) : remotePath;
      const segments = path.split('/');
      if (connection.provider === 'github') return segments.length === 2 ? path : undefined;
      return segments.length >= 2 ? path : undefined;
    } catch {
      return undefined;
    }
  }
}

export type { ConnectionStateStore };

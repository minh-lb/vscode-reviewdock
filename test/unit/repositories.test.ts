import { describe, expect, it } from 'vitest';
import type { Connection, ProviderType, RepositoryRef } from '../../src/domain/models';
import type { ReviewProvider, SecretStore } from '../../src/application/ports';
import {
  ConnectionService,
  type ConnectionStateStore,
} from '../../src/application/connectionService';
import {
  parseGitRemote,
  RepositoryService,
  type RepositoryBindingStore,
} from '../../src/application/repositoryService';

class State implements ConnectionStateStore, RepositoryBindingStore {
  values = new Map<string, unknown>();
  get<T>(key: string, fallback: T): T {
    return (this.values.get(key) as T | undefined) ?? fallback;
  }
  async update<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
}
const secretStore: SecretStore = {
  get: async () => 'token',
  set: async () => {},
  delete: async () => {},
};
const repository = (connection: Connection, fullName: string): RepositoryRef => ({
  id: 'repo-id',
  provider: connection.provider,
  connectionId: connection.id,
  serverUrl: connection.serverUrl,
  name: fullName.split('/').at(-1)!,
  fullName,
  owner: fullName.split('/').slice(0, -1).join('/'),
  private: false,
  webUrl: `${connection.serverUrl}/${fullName}`,
});
const provider = (connection: Connection): ReviewProvider =>
  ({
    provider: connection.provider,
    getRepository: async (path: string) => {
      if (path !== 'group/subgroup/project' && path !== 'owner/repo') throw new Error('not found');
      return repository(connection, path);
    },
  }) as unknown as ReviewProvider;

describe('repository remote resolution', () => {
  it('parses HTTPS and SSH remotes with nested groups and terminal .git', () => {
    expect(parseGitRemote('https://gitlab.example/group/subgroup/project.git')).toEqual({
      host: 'gitlab.example',
      path: 'group/subgroup/project',
    });
    expect(parseGitRemote('git@gitlab.example:group/subgroup/project.git')).toEqual({
      host: 'gitlab.example',
      path: 'group/subgroup/project',
    });
    expect(parseGitRemote('ssh://git@gitlab.example/group/project.git')).toEqual({
      host: 'gitlab.example',
      path: 'group/project',
    });
    expect(parseGitRemote('file:///tmp/project')).toBeUndefined();
  });

  it('returns all accessible matching accounts and never chooses by host alone', async () => {
    const state = new State();
    let id = 0;
    const connections = new ConnectionService(
      state,
      secretStore,
      {
        github: async (_provider: ProviderType, _server: string, token: string) => ({
          id: token,
          login: token,
        }),
        gitlab: async (_provider: ProviderType, _server: string, token: string) => ({
          id: token,
          login: token,
        }),
      },
      () => `conn-${++id}`,
    );
    const first = await connections.createConnection({
      provider: 'github',
      displayName: 'A',
      serverUrl: 'https://github.com',
      token: 'a',
    });
    const second = await connections.createConnection({
      provider: 'github',
      displayName: 'B',
      serverUrl: 'https://github.com',
      token: 'b',
    });
    const repoService = new RepositoryService(connections, provider, state);
    const matches = await repoService.matchRemote('git@github.com:owner/repo.git');
    expect(matches.map((match) => match.connection.id)).toEqual([first.id, second.id]);
  });

  it('keeps a workspace binding blocked when its connection is disabled', async () => {
    const state = new State();
    const connections = new ConnectionService(
      state,
      secretStore,
      { github: async () => ({ id: '1', login: 'alice' }) },
      () => 'conn',
    );
    const connection = await connections.createConnection({
      provider: 'github',
      displayName: 'A',
      serverUrl: 'https://github.com',
      token: 'a',
    });
    const repo = repository(connection, 'owner/repo');
    const repoService = new RepositoryService(connections, provider, state);
    await repoService.bind('file:///workspace', connection.id, repo);
    await connections.setEnabled(connection.id, false);
    expect(repoService.getBinding('file:///workspace')?.connectionId).toBe(connection.id);
    expect(() => repoService.resolveBinding('file:///workspace')).toThrowError(
      expect.objectContaining({ code: 'connection-disabled' }),
    );
  });
});

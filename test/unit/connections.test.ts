import { describe, expect, it, vi } from 'vitest';
import type { ProviderType, ProviderUser } from '../../src/domain/models';
import type { SecretStore } from '../../src/application/ports';
import {
  ConnectionService,
  type ConnectionStateStore,
} from '../../src/application/connectionService';

class State implements ConnectionStateStore {
  values = new Map<string, unknown>();
  failNext = false;
  get<T>(key: string, fallback: T): T {
    return (this.values.get(key) as T | undefined) ?? fallback;
  }
  async update<T>(key: string, value: T): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('storage failed');
    }
    this.values.set(key, value);
  }
}
class Secrets implements SecretStore {
  values = new Map<string, string>();
  async get(id: string): Promise<string | undefined> {
    return this.values.get(id);
  }
  async set(id: string, secret: string): Promise<void> {
    this.values.set(id, secret);
  }
  async delete(id: string): Promise<void> {
    this.values.delete(id);
  }
}
const identity = (id: string, login = `user-${id}`): ProviderUser => ({ id, login });
const makeService = (
  state = new State(),
  secrets = new Secrets(),
  validate = async (_provider: ProviderType, _server: string, token: string) => identity(token),
) => ({
  service: new ConnectionService(
    state,
    secrets,
    { github: validate, gitlab: validate },
    (() => {
      let id = 0;
      return () => `connection-${++id}`;
    })(),
    () => new Date('2026-01-01T00:00:00Z'),
  ),
  state,
  secrets,
});

describe('ConnectionService', () => {
  it('validates before storing a new secret and persists non-secret connection metadata', async () => {
    let valid = false;
    const { service, state, secrets } = makeService(new State(), new Secrets(), async () => {
      expect(secrets.values.size).toBe(0);
      valid = true;
      return identity('acct-1', 'account');
    });
    const connection = await service.createConnection({
      provider: 'github',
      displayName: ' Main ',
      serverUrl: 'https://github.com/',
      token: 'pat',
    });
    expect(valid).toBe(true);
    expect(connection).toMatchObject({
      id: 'connection-1',
      displayName: 'Main',
      enabled: true,
      status: 'connected',
      serverUrl: 'https://github.com',
    });
    expect(secrets.values.get(connection.id)).toBe('pat');
    expect(JSON.stringify([...state.values.values()])).not.toContain('pat');
  });

  it('keeps bindings/default configuration isolated by connection and clears a disabled default', async () => {
    const { service } = makeService();
    const first = await service.createConnection({
      provider: 'github',
      displayName: 'Work',
      serverUrl: 'https://github.com',
      token: 'one',
    });
    const second = await service.createConnection({
      provider: 'github',
      displayName: 'Personal',
      serverUrl: 'https://github.com',
      token: 'two',
    });
    await service.setDefaultConnection(first.id);
    await service.setEnabled(first.id, false);
    expect(service.getDefaultConnection('github')).toBeUndefined();
    expect(service.getConnection(first.id).enabled).toBe(false);
    expect(service.getConnection(second.id).enabled).toBe(true);
    await expect(service.testConnection(first.id)).rejects.toMatchObject({
      code: 'connection-disabled',
    });
    expect(await service.credentialFor(second.id)).toBe('two');
  });

  it('requires explicit confirmation before reauthentication changes the account', async () => {
    const { service, secrets } = makeService();
    const connection = await service.createConnection({
      provider: 'gitlab',
      displayName: 'Self managed',
      serverUrl: 'https://git.example',
      token: 'old',
    });
    await expect(
      service.reauthenticate(connection.id, 'new', async () => false),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(secrets.values.get(connection.id)).toBe('old');
    const updated = await service.reauthenticate(connection.id, 'new', async () => true);
    expect(updated.accountId).toBe('new');
    expect(secrets.values.get(connection.id)).toBe('new');
  });

  it('does not save a credential when account validation fails', async () => {
    const state = new State();
    const secrets = new Secrets();
    const { service } = makeService(state, secrets, async () => {
      throw new Error('invalid token');
    });
    await expect(
      service.createConnection({
        provider: 'github',
        displayName: 'Bad',
        serverUrl: 'https://github.com',
        token: 'bad-token',
      }),
    ).rejects.toThrow('invalid token');
    expect(secrets.values.size).toBe(0);
    expect(service.listConnections()).toEqual([]);
  });

  it('restores the prior credential if reauthentication metadata cannot be saved', async () => {
    const { service, state, secrets } = makeService();
    const connection = await service.createConnection({
      provider: 'github',
      displayName: 'Work',
      serverUrl: 'https://github.com',
      token: 'old',
    });
    state.failNext = true;
    await expect(service.reauthenticate(connection.id, 'new', async () => true)).rejects.toThrow();
    expect(secrets.values.get(connection.id)).toBe('old');
  });

  it('recovers an unreachable connection through authenticated-user validation', async () => {
    const state = new State();
    const secrets = new Secrets();
    const connection = {
      id: 'recoverable',
      provider: 'github' as const,
      displayName: 'Work',
      serverUrl: 'https://github.com',
      accountId: '7',
      accountLogin: 'alice',
      enabled: true,
      status: 'unreachable' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    state.values.set('reviewdock.connections', [connection]);
    secrets.values.set(connection.id, 'pat');
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response('{"id":7,"login":"alice"}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    try {
      const service = new ConnectionService(state, secrets, {});
      await expect(service.testConnection(connection.id)).rejects.toMatchObject({
        code: 'network',
      });
      expect(service.getConnection(connection.id).status).toBe('unreachable');
      const recovered = await service.testConnection(connection.id);
      expect(recovered.status).toBe('connected');
      expect(recovered.accountId).toBe('7');
      expect(recovered.accountLogin).toBe('alice');
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(String(fetch.mock.calls[1]?.[0])).toBe('https://api.github.com/user');
      expect(fetch.mock.calls[1]?.[1]?.method).toBe('GET');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not dispatch Test Connection if disabling happens during secret lookup', async () => {
    const state = new State();
    let releaseRead!: () => void;
    let started!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const secrets = new Secrets();
    const originalGet = secrets.get.bind(secrets);
    secrets.get = async (id) => {
      started();
      await readGate;
      return originalGet(id);
    };
    const connection = {
      id: 'disable-race',
      provider: 'gitlab' as const,
      displayName: 'Work',
      serverUrl: 'https://gitlab.example',
      accountId: '7',
      accountLogin: 'alice',
      enabled: true,
      status: 'connected' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    state.values.set('reviewdock.connections', [connection]);
    secrets.values.set(connection.id, 'pat');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      const service = new ConnectionService(state, secrets, {});
      const pendingTest = service.testConnection(connection.id);
      await readStarted;
      await service.setEnabled(connection.id, false);
      releaseRead();
      await expect(pendingTest).rejects.toMatchObject({ code: 'connection-disabled' });
      expect(fetch).not.toHaveBeenCalled();
      expect(service.getConnection(connection.id).status).toBe('connected');
    } finally {
      releaseRead();
      vi.unstubAllGlobals();
    }
  });

  it('cancels an in-flight unhealthy connection Test read when disabling it', async () => {
    const state = new State();
    const secrets = new Secrets();
    const connection = {
      id: 'cancel-health-check',
      provider: 'gitlab' as const,
      displayName: 'Work',
      serverUrl: 'https://gitlab.example',
      accountId: '7',
      accountLogin: 'alice',
      enabled: true,
      status: 'unreachable' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    state.values.set('reviewdock.connections', [connection]);
    secrets.values.set(connection.id, 'pat');
    let requestSignal: AbortSignal | undefined;
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined;
          started();
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    );
    vi.stubGlobal('fetch', fetch);
    try {
      const service = new ConnectionService(state, secrets, {});
      const pendingTest = service.testConnection(connection.id);
      await requestStarted;
      await service.setEnabled(connection.id, false);
      await expect(pendingTest).rejects.toMatchObject({ code: 'connection-disabled' });
      expect(requestSignal?.aborted).toBe(true);
      expect(service.getConnection(connection.id).status).toBe('unreachable');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('disconnects and deletes only the selected connection', async () => {
    const { service, secrets } = makeService();
    const first = await service.createConnection({
      provider: 'github',
      displayName: 'One',
      serverUrl: 'https://github.com',
      token: 'one',
    });
    const second = await service.createConnection({
      provider: 'github',
      displayName: 'Two',
      serverUrl: 'https://github.com',
      token: 'two',
    });
    await service.disconnect(first.id);
    expect(service.getConnection(first.id).status).toBe('disconnected');
    expect(secrets.values.has(first.id)).toBe(false);
    expect(secrets.values.get(second.id)).toBe('two');
    await service.deleteConnection(first.id);
    expect(service.listConnections().map((item) => item.id)).toEqual([second.id]);
  });
});

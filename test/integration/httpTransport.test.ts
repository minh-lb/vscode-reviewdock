import { describe, expect, it, vi } from 'vitest';
import type { Connection } from '../../src/domain/models';
import type { SecretStore } from '../../src/application/ports';
import {
  apiBaseUrl,
  normalizeServerUrl,
  ProviderHttpClient,
} from '../../src/infrastructure/http/providerHttpClient';

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: 'connection-id',
  provider: 'github',
  displayName: 'Work',
  serverUrl: 'https://github.com',
  enabled: true,
  status: 'connected',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});
const secretStore = (get: SecretStore['get'] = async () => 'secret-token'): SecretStore => ({
  get,
  set: async () => {},
  delete: async () => {},
});

describe('ProviderHttpClient', () => {
  it('uses GitHub.com API origin and the provider-specific auth header', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    const response = await client.request<{ ok: boolean }>(connection(), 'user');
    expect(apiBaseUrl(connection())).toBe('https://api.github.com');
    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://api.github.com/user');
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer secret-token');
    expect(headers.get('x-github-api-version')).toBe('2026-03-10');
    expect(headers.has('private-token')).toBe(false);
    expect(response.data.ok).toBe(true);
  });

  it('allows only the exact HTTPS GraphQL endpoint with GitHub credentials', async () => {
    const fetch = vi.fn(async () => new Response('{"data":{"ok":true}}', { status: 200 }));
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    await client.request(connection(), 'https://api.github.com/graphql', {
      method: 'POST',
      graphql: true,
      body: JSON.stringify({ query: '{ viewer { login } }' }),
    });
    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://api.github.com/graphql');
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer secret-token',
    );
    await expect(
      client.request(connection(), 'https://api.github.com/graphql', { method: 'POST' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      client.request(connection(), 'https://attacker.example/graphql', {
        method: 'POST',
        graphql: true,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      client.request(connection(), 'https://api.github.com/graphql/extra', {
        method: 'POST',
        graphql: true,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      client.request(connection(), 'https://api.github.com/graphql?query=private', {
        method: 'POST',
        graphql: true,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('routes GHES GraphQL to its exact configured path prefix', async () => {
    const fetch = vi.fn(async () => new Response('{"data":{"ok":true}}', { status: 200 }));
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    await client.request(
      connection({ serverUrl: 'https://ghe.example/prefix' }),
      'https://ghe.example/prefix/api/graphql',
      { method: 'POST', graphql: true, body: '{}' },
    );
    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://ghe.example/prefix/api/graphql');
    await expect(
      client.request(
        connection({ serverUrl: 'https://ghe.example/prefix' }),
        'https://ghe.example/prefix/other/graphql',
        { method: 'POST', graphql: true, body: '{}' },
      ),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('rejects an off-prefix pagination URL before reading the secret', async () => {
    const get = vi.fn(async () => 'secret-token');
    const fetch = vi.fn();
    const client = new ProviderHttpClient(secretStore(get), fetch as typeof globalThis.fetch);
    await expect(
      client.request(
        connection({ provider: 'gitlab', serverUrl: 'https://gitlab.example' }),
        'https://attacker.example/api/v4/projects',
      ),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks live enabled state after the credential read and before dispatch', async () => {
    let enabled = true;
    const store = secretStore(async () => {
      enabled = false;
      return 'secret-token';
    });
    const fetch = vi.fn();
    const client = new ProviderHttpClient(
      store,
      fetch as typeof globalThis.fetch,
      30_000,
      async () => ({ enabled, status: 'connected' }),
    );
    await expect(client.request(connection(), 'user')).rejects.toMatchObject({
      code: 'connection-disabled',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a disabled connection before SecretStore access', async () => {
    const get = vi.fn(async () => 'secret-token');
    const fetch = vi.fn();
    const client = new ProviderHttpClient(secretStore(get), fetch as typeof globalThis.fetch);
    await expect(client.request(connection({ enabled: false }), 'user')).rejects.toMatchObject({
      code: 'connection-disabled',
    });
    expect(get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not follow redirects with credentials', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://attacker.example/collect' },
        }),
    );
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    await expect(client.request(connection(), 'user')).rejects.toMatchObject({ code: 'network' });
    expect(fetch.mock.calls[0]?.[1]?.redirect).toBe('manual');
  });

  it('normalizes enterprise API suffixes and rejects insecure server URLs', () => {
    expect(normalizeServerUrl('github', 'https://ghe.example/api/v3/')).toBe('https://ghe.example');
    expect(apiBaseUrl(connection({ serverUrl: 'https://ghe.example' }))).toBe(
      'https://ghe.example/api/v3',
    );
    expect(normalizeServerUrl('gitlab', 'https://gitlab.example/root/api/v4')).toBe(
      'https://gitlab.example/root',
    );
    expect(() => normalizeServerUrl('github', 'http://github.example')).toThrow();
  });

  it('isolates credentials and auth header names across providers', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const secrets = secretStore(async (id) => (id === 'gh' ? 'github-secret' : 'gitlab-secret'));
    const client = new ProviderHttpClient(secrets, fetch as typeof globalThis.fetch);
    await client.request(connection({ id: 'gh' }), 'user');
    await client.request(
      connection({ id: 'gl', provider: 'gitlab', serverUrl: 'https://gitlab.example' }),
      'user',
    );
    const githubHeaders = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    const gitlabHeaders = new Headers(fetch.mock.calls[1]?.[1]?.headers);
    expect(githubHeaders.get('authorization')).toBe('Bearer github-secret');
    expect(gitlabHeaders.get('private-token')).toBe('gitlab-secret');
    expect(gitlabHeaders.has('authorization')).toBe(false);
    expect(githubHeaders.has('private-token')).toBe(false);
  });

  it('uses form content type for provider form fields', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    await client.request(
      connection({ provider: 'gitlab', serverUrl: 'https://gitlab.example' }),
      'user',
      { method: 'POST', body: new URLSearchParams({ name: 'hello' }) },
    );
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    expect(headers.get('content-type')).toMatch(/^application\/x-www-form-urlencoded/);
  });

  it('keeps a normal GitHub 403 as authorization but maps exhausted rate limit to rate-limit', async () => {
    const fetchPermission = vi.fn(
      async () => new Response('{}', { status: 403, headers: { 'X-RateLimit-Remaining': '12' } }),
    );
    const permissionClient = new ProviderHttpClient(
      secretStore(),
      fetchPermission as typeof globalThis.fetch,
    );
    await expect(permissionClient.request(connection(), 'user')).rejects.toMatchObject({
      code: 'authorization',
    });
    const fetchLimited = vi.fn(
      async () => new Response('{}', { status: 403, headers: { 'X-RateLimit-Remaining': '0' } }),
    );
    const rateClient = new ProviderHttpClient(
      secretStore(),
      fetchLimited as typeof globalThis.fetch,
    );
    await expect(rateClient.request(connection(), 'user')).rejects.toMatchObject({
      code: 'rate-limit',
    });
  });

  it('omits the GitHub API version header for GHES unless configured', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    await client.request(connection({ serverUrl: 'https://ghe.example' }), 'user', {
      headers: { 'X-GitHub-Api-Version': 'untrusted' },
    });
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has('x-github-api-version')).toBe(false);
    const configuredFetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const configured = new ProviderHttpClient(
      secretStore(),
      configuredFetch as typeof globalThis.fetch,
      30_000,
      undefined,
      () => '2026-03-10',
    );
    await configured.request(connection({ serverUrl: 'https://ghe.example' }), 'user');
    expect(
      new Headers(configuredFetch.mock.calls[0]?.[1]?.headers).get('x-github-api-version'),
    ).toBe('2026-03-10');
  });

  it('keeps useful provider errors while redacting request content and returning safe metadata', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ message: 'PAT bad-token; comment SECRET_COMMENT was invalid' }),
          {
            status: 422,
            headers: { 'X-GitHub-Request-Id': 'req-123' },
          },
        ),
    );
    const client = new ProviderHttpClient(
      secretStore(async () => 'bad-token'),
      fetch as typeof globalThis.fetch,
    );
    let error: unknown;
    try {
      await client.request(connection(), 'user', {
        method: 'POST',
        body: JSON.stringify({ body: 'SECRET_COMMENT' }),
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'validation', status: 422, requestId: 'req-123' });
    expect((error as Error).message).toContain('[redacted]');
    expect((error as Error).message).not.toContain('bad-token');
    expect((error as Error).message).not.toContain('SECRET_COMMENT');
  });

  it('returns bounded retry metadata from rate limit headers', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{}', {
          status: 429,
          headers: { 'Retry-After': '3', 'X-Request-Id': 'req-429' },
        }),
    );
    const client = new ProviderHttpClient(secretStore(), fetch as typeof globalThis.fetch);
    await expect(client.request(connection(), 'user')).rejects.toMatchObject({
      code: 'rate-limit',
      status: 429,
      requestId: 'req-429',
      retryAfterMs: 3000,
    });
  });
});

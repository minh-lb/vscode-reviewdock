import type { Connection, ProviderType } from '../../domain/models';
import { AppError, ConnectionDisabledError } from '../../domain/errors';
import type { SecretStore } from '../../application/ports';

export interface HttpRequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}
export type LiveConnectionState = Pick<Connection, 'enabled' | 'status'>;
export type GitHubVersionPolicy = string | ((serverUrl: string) => string | undefined);

const API_SUFFIX: Record<ProviderType, string> = { github: '/api/v3', gitlab: '/api/v4' };

/** Normalize a user supplied provider server URL and reject ambiguous or unsafe forms. */
export function normalizeServerUrl(provider: ProviderType, value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError('Enter a valid HTTPS server URL', 'validation');
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new AppError(
      'Server URL must be HTTPS and cannot contain credentials, query, or fragment',
      'validation',
    );
  url.hostname = url.hostname.toLowerCase();
  url.port = url.port === '443' ? '' : url.port;
  let pathname = url.pathname.replace(/\/+$/, '');
  if (provider === 'github' && url.hostname === 'github.com' && pathname === '')
    return 'https://github.com';
  if (provider === 'gitlab' && url.hostname === 'gitlab.com' && pathname === '')
    return 'https://gitlab.com';
  pathname = pathname.replace(
    new RegExp(`${API_SUFFIX[provider].replaceAll('/', '\\/')}\\/?$`, 'i'),
    '',
  );
  return `${url.origin}${pathname}`;
}

export function apiBaseUrl(connection: Pick<Connection, 'provider' | 'serverUrl'>): string {
  const server = new URL(connection.serverUrl);
  if (
    connection.provider === 'github' &&
    server.hostname === 'github.com' &&
    server.pathname === '/'
  )
    return 'https://api.github.com';
  return `${connection.serverUrl}${API_SUFFIX[connection.provider]}`;
}

export class ProviderHttpClient {
  constructor(
    private readonly secrets: SecretStore,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
    private readonly getLiveState?: (
      connectionId: string,
    ) => Promise<LiveConnectionState | undefined>,
    private readonly githubVersion: GitHubVersionPolicy = (serverUrl) =>
      new URL(serverUrl).hostname === 'github.com' ? '2026-03-10' : undefined,
  ) {}

  private readonly pending = new Map<
    string,
    Set<{ controller: AbortController; method: string }>
  >();

  /** Cancel in-flight reads for a connection when it is disabled. Submitted mutations are left alone. */
  cancelConnection(connectionId: string): void {
    for (const request of this.pending.get(connectionId) ?? [])
      if (request.method === 'GET' || request.method === 'HEAD')
        request.controller.abort(new Error('connection disabled'));
  }

  async request<T>(
    connection: Connection,
    pathOrUrl: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    await this.assertUsable(connection);
    this.validateUrl(connection, pathOrUrl);
    const credential = await this.secrets.get(connection.id);
    if (!credential)
      throw new AppError('This connection has no saved credential', 'authentication');
    await this.assertUsable(connection);
    return this.send<T>(connection, credential, pathOrUrl, options, connection.id);
  }

  /** Revalidate the saved credential against the provider identity endpoint; ignores stored health only. */
  async validateCurrentUser<T>(connection: Connection): Promise<HttpResponse<T>> {
    await this.assertUsable(connection, true);
    const path = 'user';
    this.validateUrl(connection, path);
    const credential = await this.secrets.get(connection.id);
    if (!credential)
      throw new AppError('This connection has no saved credential', 'authentication');
    await this.assertUsable(connection, true);
    return this.send<T>(connection, credential, path, { method: 'GET' }, connection.id, true);
  }

  /** For validating a token before a connection and its secret have been persisted. */
  requestWithCredential<T>(
    connection: Pick<Connection, 'provider' | 'serverUrl'>,
    credential: string,
    pathOrUrl: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    if (!credential) throw new AppError('Credential is required', 'validation');
    return this.send<T>(connection, credential, pathOrUrl, options);
  }

  private async send<T>(
    connection: Pick<Connection, 'provider' | 'serverUrl'>,
    credential: string,
    pathOrUrl: string,
    options: HttpRequestOptions,
    connectionId?: string,
    allowUnhealthy = false,
  ): Promise<HttpResponse<T>> {
    const url = this.validateUrl(connection, pathOrUrl);
    const headers = new Headers(options.headers);
    headers.delete('Authorization');
    headers.delete('PRIVATE-TOKEN');
    headers.delete('X-GitHub-Api-Version');
    headers.set('Accept', 'application/json');
    if (connection.provider === 'github') {
      headers.set('Authorization', `Bearer ${credential}`);
      const version =
        typeof this.githubVersion === 'string'
          ? this.githubVersion
          : this.githubVersion(connection.serverUrl);
      if (version) headers.set('X-GitHub-Api-Version', version);
      headers.set('Accept', 'application/vnd.github+json');
    } else {
      headers.set('PRIVATE-TOKEN', credential);
    }
    if (options.body !== undefined && options.body !== null && !headers.has('Content-Type'))
      headers.set(
        'Content-Type',
        options.body instanceof URLSearchParams
          ? 'application/x-www-form-urlencoded;charset=UTF-8'
          : 'application/json',
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const method = (options.method ?? 'GET').toUpperCase();
    const pending = connectionId ? (this.pending.get(connectionId) ?? new Set()) : undefined;
    if (connectionId && pending) {
      pending.add({ controller, method });
      this.pending.set(connectionId, pending);
    }
    try {
      if (connectionId)
        await this.assertUsable(
          { id: connectionId, enabled: true, status: 'connected' },
          allowUnhealthy,
        );
      const init: RequestInit = {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
        redirect: 'manual',
      };
      if (options.body !== undefined) init.body = options.body;
      const response = await this.fetchImpl(url, init);
      if (response.status >= 300 && response.status < 400)
        throw new AppError(
          'Provider redirected the request; credentials were not forwarded',
          'network',
        );
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw this.httpError(
          response.status,
          response.headers,
          errorBody,
          credential,
          options.body,
        );
      }
      const data =
        response.status === 204 ? undefined : await response.json().catch(() => undefined);
      if (data === undefined && response.status !== 204)
        throw new AppError('Provider returned an invalid JSON response', 'provider-server');
      return { data: data as T, status: response.status, headers: response.headers };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) {
        if (
          connectionId &&
          controller.signal.reason instanceof Error &&
          controller.signal.reason.message === 'connection disabled'
        )
          throw new ConnectionDisabledError(connectionId);
        if (options.signal?.aborted)
          throw new AppError('Request was cancelled', 'network', { cause: error });
        throw new AppError('Provider request timed out', 'timeout', { cause: error });
      }
      throw new AppError('Provider request failed', 'network', { cause: error });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      if (connectionId && pending) {
        for (const request of pending)
          if (request.controller === controller) pending.delete(request);
        if (!pending.size) this.pending.delete(connectionId);
      }
    }
  }

  private validateUrl(
    connection: Pick<Connection, 'provider' | 'serverUrl'>,
    pathOrUrl: string,
  ): URL {
    const base = new URL(apiBaseUrl(connection));
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.replace(/^\/+/, ''), `${base.href.replace(/\/+$/, '')}/`);
    const prefix = base.pathname.replace(/\/+$/, '');
    if (
      url.protocol !== 'https:' ||
      url.origin !== base.origin ||
      !(url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) ||
      url.username ||
      url.password
    )
      throw new AppError('Request URL is outside the configured provider API', 'validation');
    return url;
  }

  private async assertUsable(
    connection: Pick<Connection, 'id' | 'enabled' | 'status'>,
    allowUnhealthy = false,
  ): Promise<void> {
    const live = this.getLiveState ? await this.getLiveState(connection.id) : connection;
    if (!live) throw new AppError('Connection was not found', 'not-found');
    if (!live.enabled) throw new ConnectionDisabledError(connection.id);
    if (!allowUnhealthy && live.status !== 'connected')
      throw new AppError(
        'Connection must be tested or re-authenticated before use',
        'authentication',
      );
  }

  private httpError(
    status: number,
    headers: Headers,
    body: string,
    credential: string,
    requestBody?: BodyInit | null,
  ): AppError {
    const code =
      status === 401
        ? 'authentication'
        : status === 403 &&
            (headers.has('retry-after') || headers.get('x-ratelimit-remaining') === '0')
          ? 'rate-limit'
          : status === 403
            ? 'authorization'
            : status === 404
              ? 'not-found'
              : status === 405
                ? 'operation-not-allowed'
                : status === 409
                  ? 'conflict'
                  : status === 422 || status === 400
                    ? 'validation'
                    : status === 429
                      ? 'rate-limit'
                      : status >= 500
                        ? 'provider-server'
                        : 'unknown';
    const rawRequestId =
      headers.get('x-github-request-id') ?? headers.get('x-request-id') ?? undefined;
    const requestId =
      rawRequestId && /^[a-z\d._:-]{1,128}$/i.test(rawRequestId) ? rawRequestId : undefined;
    const retryAfterMs = this.retryAfter(headers);
    const reason = this.safeProviderReason(body, credential, requestBody);
    return new AppError(`Provider request failed (${status})${reason ? `: ${reason}` : ''}`, code, {
      status,
      ...(requestId ? { requestId } : {}),
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    });
  }

  private retryAfter(headers: Headers): number | undefined {
    const value = headers.get('retry-after');
    if (value) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
      const date = Date.parse(value);
      if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    }
    const reset = Number(headers.get('x-ratelimit-reset'));
    return Number.isFinite(reset) && reset > 0 ? Math.max(0, reset * 1000 - Date.now()) : undefined;
  }

  private safeProviderReason(
    body: string,
    credential: string,
    requestBody?: BodyInit | null,
  ): string | undefined {
    let reason: unknown;
    try {
      reason = (JSON.parse(body) as { message?: unknown })?.message;
    } catch {
      return undefined;
    }
    if (typeof reason !== 'string') return undefined;
    const secrets = [credential, ...this.requestBodyValues(requestBody)].filter(Boolean);
    let safe = reason;
    for (const secret of secrets) safe = safe.split(secret).join('[redacted]');
    safe = [...safe]
      .map((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127 ? ' ' : character;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    return safe || undefined;
  }

  private requestBodyValues(body?: BodyInit | null): string[] {
    if (body instanceof URLSearchParams) return [...body.values()];
    if (typeof body !== 'string') return [];
    try {
      const values: string[] = [];
      const collect = (value: unknown): void => {
        if (typeof value === 'string') values.push(value);
        else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
      };
      collect(JSON.parse(body));
      return values;
    } catch {
      return [body];
    }
  }
}

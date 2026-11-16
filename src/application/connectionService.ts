import { randomUUID } from 'node:crypto';
import type { Connection, ProviderType, ProviderUser } from '../domain/models';
import { AppError, ConnectionDisabledError } from '../domain/errors';
import type { SecretStore } from './ports';
import {
  apiBaseUrl,
  normalizeServerUrl,
  ProviderHttpClient,
} from '../infrastructure/http/providerHttpClient';

export interface ConnectionStateStore {
  get<T>(key: string, fallback: T): T;
  update<T>(key: string, value: T): Promise<void>;
}
export type ValidatedIdentity = ProviderUser;
export type CredentialValidator = (
  provider: ProviderType,
  serverUrl: string,
  token: string,
) => Promise<ValidatedIdentity>;
export interface CreateConnectionInput {
  provider: ProviderType;
  displayName: string;
  serverUrl: string;
  token: string;
}
export type AccountChangeConfirmation = (
  previous: Connection,
  next: ValidatedIdentity,
) => Promise<boolean>;

const CONNECTIONS_KEY = 'reviewdock.connections';
const DEFAULTS_KEY = 'reviewdock.connectionDefaults';
type Defaults = Partial<Record<ProviderType, string>>;

/** Connection lifecycle and credential boundary. Tokens never leave this service. */
export class ConnectionService {
  private mutationQueue: Promise<void> = Promise.resolve();
  private readonly validators: Record<ProviderType, CredentialValidator>;
  private readonly customValidators: Set<ProviderType>;
  private readonly http: ProviderHttpClient;

  constructor(
    private readonly state: ConnectionStateStore,
    private readonly secrets: SecretStore,
    validators: Partial<Record<ProviderType, CredentialValidator>>,
    private readonly idFactory: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
    private readonly cancelReads?: (connectionId: string) => void,
  ) {
    this.customValidators = new Set(
      (['github', 'gitlab'] as const).filter((provider) => validators[provider]),
    );
    this.http = new ProviderHttpClient(secrets, fetch, 30_000, async (id) =>
      this.getLiveConnectionState(id),
    );
    this.validators = {
      github:
        validators.github ??
        ((provider, server, token) => this.validateWithHttp(this.http, provider, server, token)),
      gitlab:
        validators.gitlab ??
        ((provider, server, token) => this.validateWithHttp(this.http, provider, server, token)),
    };
  }

  listConnections(): Connection[] {
    return this.connections();
  }
  getLiveConnectionState(id: string): Pick<Connection, 'enabled' | 'status'> | undefined {
    const connection = this.connections().find((item) => item.id === id);
    return connection ? { enabled: connection.enabled, status: connection.status } : undefined;
  }
  getConnection(id: string): Connection {
    const connection = this.connections().find((item) => item.id === id);
    if (!connection) throw new AppError('Connection was not found', 'not-found');
    return connection;
  }

  /** Validate a token without storing it; the returned identity is safe to show in the host UI. */
  async validateConnection(
    input: Pick<CreateConnectionInput, 'provider' | 'serverUrl' | 'token'>,
  ): Promise<ValidatedIdentity> {
    const serverUrl = normalizeServerUrl(input.provider, input.serverUrl);
    return this.validators[input.provider](input.provider, serverUrl, input.token);
  }

  async createConnection(input: CreateConnectionInput): Promise<Connection> {
    const displayName = input.displayName.trim();
    if (!displayName) throw new AppError('Connection name is required', 'validation');
    const serverUrl = normalizeServerUrl(input.provider, input.serverUrl);
    const identity = await this.validators[input.provider](input.provider, serverUrl, input.token);
    const timestamp = this.now().toISOString();
    const connection: Connection = {
      id: this.idFactory(),
      provider: input.provider,
      displayName,
      serverUrl,
      accountId: identity.id,
      accountLogin: identity.login,
      ...(identity.name ? { accountName: identity.name } : {}),
      enabled: true,
      status: 'connected',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastValidatedAt: timestamp,
    };
    await this.serial(async () => {
      try {
        await this.secrets.set(connection.id, input.token);
      } catch (error) {
        throw new AppError('Could not save connection credential', 'unknown', { cause: error });
      }
      try {
        await this.state.update(CONNECTIONS_KEY, [...this.connections(), connection]);
      } catch (error) {
        await this.secrets.delete(connection.id).catch(() => undefined);
        throw new AppError('Could not save connection settings', 'unknown', { cause: error });
      }
    });
    return connection;
  }

  async testConnection(id: string): Promise<Connection> {
    const connection = this.requireEnabled(id);
    try {
      const identity = this.customValidators.has(connection.provider)
        ? await this.validateStoredWithCustomValidator(connection)
        : await this.validateStoredWithHttp(connection);
      if (connection.accountId && identity.id !== connection.accountId)
        throw new AppError(
          'Credential belongs to a different account; re-authenticate with confirmation',
          'authentication',
        );
      return this.updateConnection(id, (item) => ({
        ...item,
        status: 'connected',
        lastValidatedAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      }));
    } catch (error) {
      if (error instanceof ConnectionDisabledError) throw error;
      await this.updateConnection(id, (item) => ({
        ...item,
        status:
          error instanceof AppError && error.code === 'authentication'
            ? 'reauthentication-required'
            : 'unreachable',
        updatedAt: this.now().toISOString(),
      }));
      throw error;
    }
  }

  async renameConnection(id: string, displayName: string): Promise<Connection> {
    const name = displayName.trim();
    if (!name) throw new AppError('Connection name is required', 'validation');
    return this.updateConnection(id, (item) => ({
      ...item,
      displayName: name,
      updatedAt: this.now().toISOString(),
    }));
  }

  async setEnabled(id: string, enabled: boolean): Promise<Connection> {
    return this.serial(async () => {
      const item = this.getConnection(id);
      if (!enabled) {
        const defaults = this.defaults();
        if (defaults[item.provider] === id) {
          delete defaults[item.provider];
          await this.state.update(DEFAULTS_KEY, defaults);
        }
      }
      const updated = { ...item, enabled, updatedAt: this.now().toISOString() };
      await this.replace(updated);
      if (!enabled) {
        this.http.cancelConnection(id);
        this.cancelReads?.(id);
      }
      return updated;
    });
  }

  async setDefaultConnection(id: string): Promise<void> {
    await this.serial(async () => {
      const connection = this.getConnection(id);
      if (!connection.enabled) throw new ConnectionDisabledError(id);
      await this.state.update(DEFAULTS_KEY, { ...this.defaults(), [connection.provider]: id });
    });
  }

  getDefaultConnection(provider: ProviderType): Connection | undefined {
    const id = this.defaults()[provider];
    if (!id) return undefined;
    const connection = this.connections().find((item) => item.id === id);
    return connection?.enabled ? connection : undefined;
  }

  async reauthenticate(
    id: string,
    token: string,
    confirmAccountChange?: AccountChangeConfirmation,
  ): Promise<Connection> {
    const old = this.requireEnabled(id);
    const identity = await this.validators[old.provider](old.provider, old.serverUrl, token);
    if (
      old.accountId &&
      identity.id !== old.accountId &&
      !(await confirmAccountChange?.(old, identity))
    )
      throw new AppError('Account change was not confirmed', 'validation');
    return this.serial(async () => {
      const current = this.getConnection(id);
      const previousCredential = await this.secrets.get(id);
      await this.secrets.set(id, token);
      const updated: Connection = {
        ...current,
        accountId: identity.id,
        accountLogin: identity.login,
        ...(identity.name ? { accountName: identity.name } : {}),
        status: 'connected',
        lastValidatedAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      };
      try {
        await this.replace(updated);
      } catch (error) {
        if (previousCredential === undefined) await this.secrets.delete(id).catch(() => undefined);
        else await this.secrets.set(id, previousCredential).catch(() => undefined);
        throw error;
      }
      return updated;
    });
  }

  async disconnect(id: string): Promise<Connection> {
    return this.serial(async () => {
      const item = this.getConnection(id);
      await this.secrets.delete(id);
      const updated = {
        ...item,
        status: 'disconnected' as const,
        updatedAt: this.now().toISOString(),
      };
      await this.replace(updated);
      return updated;
    });
  }

  async deleteConnection(id: string): Promise<void> {
    await this.serial(async () => {
      const item = this.getConnection(id);
      await this.secrets.delete(id);
      await this.state.update(
        CONNECTIONS_KEY,
        this.connections().filter((connection) => connection.id !== id),
      );
      const defaults = this.defaults();
      if (defaults[item.provider] === id) {
        delete defaults[item.provider];
        await this.state.update(DEFAULTS_KEY, defaults);
      }
    });
  }

  /** Final guard for provider services: rejects disabled accounts before SecretStorage access. */
  async credentialFor(id: string): Promise<string> {
    const connection = this.requireEnabled(id);
    if (connection.status !== 'connected')
      throw new AppError(
        'Connection must be tested or re-authenticated before use',
        'authentication',
      );
    const credential = await this.secrets.get(id);
    if (!credential)
      throw new AppError('This connection has no saved credential', 'authentication');
    return credential;
  }

  private requireEnabled(id: string): Connection {
    const connection = this.getConnection(id);
    if (!connection.enabled) throw new ConnectionDisabledError(id);
    return connection;
  }
  private connections(): Connection[] {
    return this.state.get<Connection[]>(CONNECTIONS_KEY, []);
  }
  private defaults(): Defaults {
    return this.state.get<Defaults>(DEFAULTS_KEY, {});
  }
  private async replace(connection: Connection): Promise<void> {
    const records = this.connections();
    const index = records.findIndex((item) => item.id === connection.id);
    if (index < 0) throw new AppError('Connection was not found', 'not-found');
    const next = [...records];
    next[index] = connection;
    await this.state.update(CONNECTIONS_KEY, next);
  }
  private async updateConnection(
    id: string,
    update: (current: Connection) => Connection,
  ): Promise<Connection> {
    return this.serial(async () => {
      const updated = update(this.getConnection(id));
      await this.replace(updated);
      return updated;
    });
  }
  private async serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(action);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async validateWithHttp(
    http: ProviderHttpClient,
    provider: ProviderType,
    serverUrl: string,
    token: string,
  ): Promise<ValidatedIdentity> {
    const response = await http.requestWithCredential<unknown>(
      { provider, serverUrl },
      token,
      'user',
      {
        headers: {
          Accept: provider === 'github' ? 'application/vnd.github+json' : 'application/json',
        },
      },
    );
    return this.mapIdentity(provider, response.data);
  }

  private async validateStoredWithHttp(connection: Connection): Promise<ValidatedIdentity> {
    const response = await this.http.validateCurrentUser<unknown>(connection);
    return this.mapIdentity(connection.provider, response.data);
  }

  private async validateStoredWithCustomValidator(
    connection: Connection,
  ): Promise<ValidatedIdentity> {
    const token = await this.secrets.get(connection.id);
    if (!token) throw new AppError('This connection has no saved credential', 'authentication');
    this.requireEnabled(connection.id);
    return this.validators[connection.provider](connection.provider, connection.serverUrl, token);
  }

  private mapIdentity(provider: ProviderType, input: unknown): ValidatedIdentity {
    const value = input as Record<string, unknown>;
    const id = value?.id;
    const login = provider === 'github' ? value?.login : value?.username;
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof login !== 'string')
      throw new AppError('Provider returned an invalid account identity', 'provider-server');
    return {
      id: String(id),
      login,
      ...(typeof value.name === 'string' ? { name: value.name } : {}),
      ...(typeof value.avatar_url === 'string' ? { avatarUrl: value.avatar_url } : {}),
      ...(typeof value.html_url === 'string' ? { webUrl: value.html_url } : {}),
    };
  }
}

export { apiBaseUrl };

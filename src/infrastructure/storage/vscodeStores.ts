import * as vscode from 'vscode';
import type { SecretStore } from '../../application/ports';

export class MementoStore {
  constructor(private readonly memento: vscode.Memento) {}
  get<T>(key: string, fallback: T): T {
    return this.memento.get<T>(key, fallback);
  }
  async update<T>(key: string, value: T): Promise<void> {
    await this.memento.update(key, value);
  }
}

export class VscodeSecretStore implements SecretStore {
  private static readonly prefix = 'reviewdock.connection.';
  constructor(private readonly secrets: vscode.SecretStorage) {}
  async get(id: string): Promise<string | undefined> {
    return this.secrets.get(`${VscodeSecretStore.prefix}${id}`);
  }
  async set(id: string, secret: string): Promise<void> {
    await this.secrets.store(`${VscodeSecretStore.prefix}${id}`, secret);
  }
  async delete(id: string): Promise<void> {
    await this.secrets.delete(`${VscodeSecretStore.prefix}${id}`);
  }
}

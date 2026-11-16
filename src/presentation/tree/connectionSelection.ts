import type { ProviderType } from '../../domain/models';

export interface SelectableConnection {
  id: string;
  provider: ProviderType;
  enabled: boolean;
}
export type ConnectionChoice<T extends SelectableConnection> =
  { kind: 'blocked' } | { kind: 'selected'; connection: T } | { kind: 'choose'; connections: T[] };

/** A workspace binding always wins; defaults only resolve an unbound folder. */
export function connectionChoice<T extends SelectableConnection>(
  hasBinding: boolean,
  enabledConnections: readonly T[],
  defaults: Partial<Record<ProviderType, T | undefined>>,
): ConnectionChoice<T> {
  if (hasBinding) return { kind: 'blocked' };
  const defaultConnections = (['github', 'gitlab'] as const)
    .map((provider) => defaults[provider])
    .filter((connection): connection is T => !!connection?.enabled);
  if (defaultConnections.length === 1)
    return { kind: 'selected', connection: defaultConnections[0]! };
  if (defaultConnections.length > 1) return { kind: 'choose', connections: defaultConnections };
  return {
    kind: 'choose',
    connections: enabledConnections.filter((connection) => connection.enabled),
  };
}

import type { Connection, ReviewRequestFilter, ReviewRequestSummary } from '../../domain/models';

export interface WorkspaceFolderLike {
  uri: { toString(): string };
}

export function selectWorkspaceFolder<T extends WorkspaceFolderLike>(
  folders: readonly T[],
  current?: T,
  explicitlySelected = false,
): T | undefined {
  if (folders.length === 1) return folders[0];
  return explicitlySelected &&
    current &&
    folders.some((folder) => folder.uri.toString() === current.uri.toString())
    ? current
    : undefined;
}

export function resolveFolderBinding<T>(
  folderUri: string | undefined,
  resolve: (uri: string) => T,
): T | undefined {
  return folderUri ? resolve(folderUri) : undefined;
}

export const reviewFilters: readonly { label: string; filter: ReviewRequestFilter }[] = [
  { label: 'Review requested', filter: 'review-requested-from-me' },
  { label: 'Assigned to me', filter: 'assigned-to-me' },
  { label: 'Created by me', filter: 'created-by-me' },
  { label: 'Open', filter: 'open' },
  { label: 'Closed', filter: 'closed' },
  { label: 'Merged', filter: 'merged' },
];

export function connectionLabel(connection: Connection): string {
  const provider = connection.provider === 'github' ? 'GitHub' : 'GitLab';
  const host = new URL(connection.serverUrl).host;
  const account = connection.accountLogin ? ` · @${connection.accountLogin}` : '';
  const enabled = connection.enabled
    ? statusLabel(connection.status)
    : `Disabled · last known ${statusLabel(connection.status)}`;
  return `${provider} · ${connection.displayName}${account} · ${host} · ${enabled}`;
}

export function statusLabel(status: Connection['status']): string {
  return {
    connected: 'Connected',
    'reauthentication-required': 'Re-auth required',
    unreachable: 'Unreachable',
    'configuration-error': 'Configuration error',
    disconnected: 'Disconnected',
  }[status];
}

export function reviewRequestLabel(summary: ReviewRequestSummary): string {
  const state = summary.draft
    ? ' · Draft'
    : summary.state === 'merged'
      ? ' · Merged'
      : summary.state === 'closed'
        ? ' · Closed'
        : '';
  return `${summary.number} · ${summary.title}${state}`;
}

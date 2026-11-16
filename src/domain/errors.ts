export type AppErrorCode =
  | 'authentication'
  | 'authorization'
  | 'connection-disabled'
  | 'conflict'
  | 'network'
  | 'not-found'
  | 'operation-not-allowed'
  | 'provider-server'
  | 'rate-limit'
  | 'timeout'
  | 'unsupported-capability'
  | 'validation'
  | 'unknown';

export class AppError extends Error {
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  constructor(
    message: string,
    readonly code: AppErrorCode,
    options?: { cause?: unknown; status?: number; requestId?: string; retryAfterMs?: number },
  ) {
    super(message, options);
    this.name = new.target.name;
    if (options?.status !== undefined) this.status = options.status;
    if (options?.requestId !== undefined) this.requestId = options.requestId;
    if (options?.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
  }
}
export class UnsupportedCapabilityError extends AppError {
  constructor(
    readonly capability: string,
    message = `Provider does not support ${capability}`,
  ) {
    super(message, 'unsupported-capability');
  }
}
export class ConnectionDisabledError extends AppError {
  constructor(readonly connectionId: string) {
    super('The selected connection is disabled', 'connection-disabled');
  }
}
export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message, 'validation');
  }
}

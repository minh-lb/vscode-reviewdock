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
  constructor(
    message: string,
    readonly code: AppErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
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

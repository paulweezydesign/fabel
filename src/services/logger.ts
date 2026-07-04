export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly data?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export const createConsoleLogger = (scope: string): Logger => {
  const log =
    (level: LogLevel) =>
    (message: string, data?: Record<string, unknown>) => {
      const line = `[${scope}] ${message}`;
      // eslint-disable-next-line no-console
      data === undefined ? console[level](line) : console[level](line, data);
    };
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
};

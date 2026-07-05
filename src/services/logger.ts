export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
  readonly at: string;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Logger that writes structured entries to the console. */
export class ConsoleLogger implements Logger {
  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      level,
      message,
      at: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    };
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }
}

/** Logger that records entries in memory; used by tests to assert behaviour. */
export class MemoryLogger implements Logger {
  private readonly log: LogEntry[] = [];

  private record(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.log.push({
      level,
      message,
      at: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.record("debug", message, meta);
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.record("info", message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.record("warn", message, meta);
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.record("error", message, meta);
  }

  get entries(): readonly LogEntry[] {
    return this.log;
  }
}

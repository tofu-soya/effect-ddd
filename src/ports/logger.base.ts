import * as IO from 'fp-ts/IO';

export interface Logger {
  info(message: string, ...meta: unknown[]): IO.IO<void>;
  error(message: string, trace?: unknown, ...meta: unknown[]): IO.IO<void>;
  warn(message: string, ...meta: unknown[]): IO.IO<void>;
  debug(message: string, ...meta: unknown[]): IO.IO<void>;
}

export interface LoggerWithCtx extends Logger {
  context(): string;
}

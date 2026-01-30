import * as IO from 'fp-ts/IO';
import * as Reader from 'fp-ts/Reader';
import { LoggerWithCtx } from './logger.base';

export interface ConsoleDomainLogger extends LoggerWithCtx {}

export const getConsoleDomainLogger: Reader.Reader<
  string,
  ConsoleDomainLogger
> = (context: string) => {
  const formatMessageWithContext = (message: string) =>
    `[${context}] ${message}`;

  return {
    info:
      (message: string, ...meta: unknown[]): IO.IO<void> =>
      () =>
        console.info(`${formatMessageWithContext(message)}`, ...meta),

    error:
      (message: string, trace?: unknown, ...meta: unknown[]): IO.IO<void> =>
      () =>
        console.error(
          `${formatMessageWithContext(message)} ${trace || '[No trace info]'}`,
          ...meta,
        ),

    warn:
      (message: string, ...meta: unknown[]): IO.IO<void> =>
      () =>
        console.warn(formatMessageWithContext(message), ...meta),

    debug:
      (message: string, ...meta: unknown[]): IO.IO<void> =>
      () =>
        console.debug(formatMessageWithContext(message), ...meta),

    context: () => context,
  };
};

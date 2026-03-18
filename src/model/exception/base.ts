import { Data } from 'effect';

export interface BaseExceptionProps<CONTENT> {
  readonly code: string;
  readonly message: string;
  readonly content?: CONTENT;
}

export const formatExceptionMessage = (
  code: string,
  message: string,
): string => {
  const prefix = `[${code}]`;
  return message.startsWith(prefix) ? message : `${prefix} ${message}`;
};

export class CommonException extends Data.TaggedError('BaseException')<
  BaseExceptionProps<any>
> {}

export const CommonExceptionTrait = {
  construct: (
    code: string,
    message: string,
    content?: unknown,
  ): CommonException =>
    new CommonException({
      code,
      message: formatExceptionMessage(code, message),
      content,
    }),
};

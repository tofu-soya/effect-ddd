import { Data } from 'effect';

export interface BaseExceptionProps<CONTENT> {
  readonly code: string;
  readonly message: string;
  readonly content?: CONTENT;
}

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
      message,
      content,
    }),
};

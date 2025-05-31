export interface BaseException<CONTENT = unknown> {
  readonly _tag: string;
  readonly code: string;
  readonly message: string;
  readonly content?: CONTENT;
}

export const BaseExceptionTrait = {
  construct: (
    tag: string,
    code: string,
    message: string,
    content?: unknown,
  ): BaseException => ({
    _tag: tag,
    code,
    message,
    content,
  }),
};

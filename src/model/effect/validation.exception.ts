import { BaseException } from './exception.base';

export class ValidationException extends BaseException {
  constructor(
    readonly code: string,
    readonly messages: string[],
    readonly loc: string[] = [],
    readonly instruction: string[] = [],
  ) {
    super();
    this.tag = 'ValidationException';
  }
}

export const ValidationExceptionTrait = {
  construct: (
    code: string,
    messages: string | string[],
    loc: string[] = [],
    instruction: string[] = [],
  ): ValidationException => {
    return new ValidationException(
      code,
      Array.isArray(messages) ? messages : [messages],
      loc,
      instruction,
    );
  },
};

import { BaseException, BaseExceptionTrait } from './exception.base';

export class ValidationException implements BaseException {
  readonly _tag = 'ValidationException';
  
  constructor(
    readonly code: string,
    readonly message: string,
    readonly content?: {
      loc?: string[];
      instruction?: string[];
      details?: string[];
    }
  ) {}
}

export const ValidationExceptionTrait = {
  construct: (
    code: string,
    message: string,
    content?: {
      loc?: string[];
      instruction?: string[];
      details?: string[];
    }
  ): ValidationException => {
    return new ValidationException(code, message, content);
  },

  fromBase: (base: BaseException): ValidationException => {
    return new ValidationException(
      base.code,
      base.message,
      { details: [base.message] }
    );
  }
};

import { Data } from 'effect';
import { BaseException } from './base';

export class ValidationException extends Data.TaggedError(
  'ValidationFail',
)<BaseException> {
  static new(
    code: string,
    message: string,
    content?: {
      loc?: string[];
      instruction?: string[];
      details?: string[];
    },
  ): ValidationException {
    return new ValidationException({ code, message, content });
  }
}

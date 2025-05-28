import { Data } from 'effect';
import { BaseException } from './base';

export class OperationException extends Data.TaggedError(
  'Operation',
)<BaseException> {
  static new(
    code: string,
    message: string,
    content?: {
      loc?: string[];
      instruction?: string[];
      details?: string[];
    },
  ): OperationException {
    return new OperationException({ code, message, content });
  }
}

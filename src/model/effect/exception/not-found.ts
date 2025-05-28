import { Data } from 'effect';
import { BaseException } from './base';

export class NotFoundException extends Data.TaggedError(
  'Notfound',
)<BaseException> {
  static new(
    code: string,
    message: string,
    content?: {
      loc?: string[];
      instruction?: string[];
      details?: string[];
    },
  ): NotFoundException {
    return new NotFoundException({ code, message, content });
  }
}

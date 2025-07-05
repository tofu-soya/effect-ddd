import { Data } from 'effect';
import { BaseExceptionProps } from './base';

export interface NotFoundExceptionContent {
  loc?: string[];
  instruction?: string[];
  details?: string[];
}
export class NotFoundException extends Data.TaggedError('Notfound')<
  BaseExceptionProps<NotFoundExceptionContent>
> {
  static new(
    code: string,
    message: string,
    content?: NotFoundExceptionContent,
  ): NotFoundException {
    return new NotFoundException({ code, message, content });
  }
}

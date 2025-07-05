import { Data } from 'effect';
import { NotFoundExceptionContent } from './not-found';
import { BaseExceptionProps } from './base';

interface OperationExceptionContent extends NotFoundExceptionContent {}
export class OperationException extends Data.TaggedError('Operation')<
  BaseExceptionProps<OperationExceptionContent>
> {
  static new(
    code: string,
    message: string,
    content?: OperationExceptionContent,
  ): OperationException {
    return new OperationException({ code, message, content });
  }
}

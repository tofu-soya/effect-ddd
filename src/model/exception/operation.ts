import { Data } from 'effect';
import { NotFoundExceptionContent } from './not-found';
import { BaseExceptionProps, formatExceptionMessage } from './base';

interface OperationExceptionContent extends NotFoundExceptionContent {
  context?: any;
}

export class OperationException extends Data.TaggedError('Operation')<
  BaseExceptionProps<OperationExceptionContent>
> {
  static new(
    code: string,
    message: string,
    content?: OperationExceptionContent,
  ): OperationException {
    return new OperationException({
      code,
      message: formatExceptionMessage(code, message),
      content,
    });
  }
}

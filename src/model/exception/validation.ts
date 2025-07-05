import { Data, ParseResult } from 'effect';
import { ParseError } from 'effect/ParseResult';
import { NotFoundExceptionContent } from './not-found';
import { BaseExceptionProps } from './base';

interface ValidationExceptionContent extends NotFoundExceptionContent {
  parseError?: any;
  // Support multiple violations for complex domain objects
  violations?: Array<{
    rule: string;
    code: string;
    message: string;
  }>;
}

export class ValidationException extends Data.TaggedError('ValidationFail')<
  BaseExceptionProps<ValidationExceptionContent>
> {
  /**
   * Create simple validation exception (current usage - UNCHANGED)
   */
  static new(
    code: string,
    message: string,
    content?: ValidationException['content'],
  ): ValidationException {
    return new ValidationException({ code, message, content });
  }

  /**
   * Create exception with multiple business rule violations
   * (for use within your existing domain builders)
   */
  static withViolations(
    violations: Array<{
      rule: string;
      code: string;
      message: string;
    }>,
  ): ValidationException {
    return new ValidationException({
      code: 'BUSINESS_RULE_VIOLATIONS',
      message: `${violations.length} business rules violated`,
      content: {
        violations,
        details: violations.map((v) => `${v.rule}: ${v.message}`),
      },
    });
  }

  static fromParseError(
    parseError: ParseError,
    code: string = 'PARSE_ERROR_VALIDATION',
    message = 'failed with parse error',
  ): ValidationException {
    return new ValidationException({
      code,
      message,
      content: {
        parseError: ParseResult.ArrayFormatter.formatErrorSync(parseError),
      },
    });
  }

  getViolations() {
    return this.content?.violations || [];
  }
}

import { Data } from 'effect';
import { BaseException } from './base';

export class ValidationException extends Data.TaggedError('ValidationFail')<{
  code: string;
  message: string;
  content?: {
    loc?: string[];
    instruction?: string[];
    details?: string[];
    // Support multiple violations for complex domain objects
    violations?: Array<{
      rule: string;
      code: string;
      message: string;
    }>;
  };
}> {
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

  getViolations() {
    return this.content?.violations || [];
  }
}

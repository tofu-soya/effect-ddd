# Exception Handling

Effect-DDD provides a comprehensive exception handling system with typed errors and structured error information for domain modeling and validation.

## Exception Hierarchy

All exceptions follow a consistent structure with error codes, messages, and optional contextual content.

### Base Exception Interface

```typescript
interface BaseExceptionProps<CONTENT> {
  readonly code: string;
  readonly message: string;
  readonly content?: CONTENT;
}
```

## Exception Types

### ValidationException

Used for validation failures and business rule violations.

#### Factory Methods

##### `ValidationException.new()`
Create a basic validation exception.
```typescript
static new(
  code: string,
  message: string,
  content?: {
    loc?: string[];           // Error location path
    instruction?: string[];   // How to fix the error
    details?: string[];       // Additional error details
    parseError?: any;         // Original parse error if available
    violations?: Array<{      // Multiple validation violations
      rule: string;           // Which rule was violated
      code: string;           // Error code for this violation
      message: string;        // Human-readable message
    }>;
  }
): ValidationException
```

##### `ValidationException.withViolations()`
Create exception with multiple business rule violations.
```typescript
static withViolations(
  violations: Array<{
    rule: string;
    code: string;
    message: string;
  }>
): ValidationException
```

##### `ValidationException.fromParseError()`
Create exception from Effect parse errors.
```typescript
static fromParseError(
  parseError: ParseError,
  code?: string,
  message?: string
): ValidationException
```

#### Instance Methods

##### `getViolations()`
Get all validation violations from the exception.
```typescript
getViolations(): Array<{
  rule: string;
  code: string;
  message: string;
}>
```

#### Usage Examples

```typescript
import { ValidationException } from 'effect-ddd';

// Simple validation error
const emailError = ValidationException.new(
  'INVALID_EMAIL',
  'Invalid email format',
  {
    loc: ['user', 'email'],
    details: ['Provided: not-an-email'],
    instruction: ['Provide valid email address']
  }
);

// Multiple business rule violations
const userValidationError = ValidationException.withViolations([
  {
    rule: 'email_format',
    code: 'INVALID_EMAIL',
    message: 'Must be valid email address'
  },
  {
    rule: 'password_strength',
    code: 'WEAK_PASSWORD',
    message: 'Password must be at least 8 characters'
  }
]);

// From Effect Schema parse error
const parseException = ValidationException.fromParseError(
  schemaParseError,
  'SCHEMA_VALIDATION_FAILED',
  'Schema validation failed'
);
```

### NotFoundException

Used when a requested resource cannot be found.

#### Factory Method

```typescript
static new(
  code: string,
  message: string,
  content?: {
    loc?: string[];           // Location path of the missing resource
    instruction?: string[];   // How to resolve the issue
    details?: string[];       // Additional context
  }
): NotFoundException
```

#### Usage Example

```typescript
import { NotFoundException } from 'effect-ddd';

const userNotFound = NotFoundException.new(
  'USER_NOT_FOUND',
  'User with specified ID not found',
  {
    loc: ['users', '123'],
    instruction: ['Verify user ID exists', 'Check user permissions'],
    details: ['Searched in user repository']
  }
);
```

### OperationException

Used for general operation failures and business operation errors.

#### Factory Method

```typescript
static new(
  code: string,
  message: string,
  content?: {
    loc?: string[];           // Operation location
    instruction?: string[];   // Recovery instructions
    details?: string[];       // Operation details
  }
): OperationException
```

#### Usage Example

```typescript
import { OperationException } from 'effect-ddd';

const paymentFailed = OperationException.new(
  'PAYMENT_FAILED',
  'Payment processing failed',
  {
    loc: ['payment', 'process'],
    instruction: ['Check payment details', 'Retry payment'],
    details: ['Insufficient funds', 'Account: ****1234']
  }
);
```

### CommonException

Generic exception type for basic error handling.

#### Factory (CommonExceptionTrait)

```typescript
const CommonExceptionTrait = {
  construct: (
    code: string,
    message: string,
    content?: unknown
  ): CommonException
}
```

#### Usage Example

```typescript
import { CommonExceptionTrait } from 'effect-ddd';

const authError = CommonExceptionTrait.construct(
  'AUTH_FAILED',
  'Authentication failed',
  { userId: 'user123', attemptedAt: new Date() }
);
```

## Exception Union Types

### BaseException
Union of all domain exceptions:
```typescript
type BaseException =
  | CommonException
  | OperationException
  | ValidationException
  | NotFoundException
  | ParseError;  // From Effect Schema
```

### CoreException
Union for core system exceptions:
```typescript
type CoreException = ParseError | BaseException;
```

## Common Patterns

### Domain Validation
```typescript
// In domain builders
const validateUser = (props: UserProps): Effect.Effect<UserProps, ValidationException> =>
  Effect.gen(function* () {
    if (props.age < 0) {
      return yield* Effect.fail(
        ValidationException.new('INVALID_AGE', 'Age must be non-negative')
      );
    }
    return props;
  });
```

### Repository Operations
```typescript
// In repository implementations
const findUserById = (id: string): Effect.Effect<User, NotFoundException> =>
  Effect.gen(function* () {
    const user = yield* database.findById(id);
    if (!user) {
      return yield* Effect.fail(
        NotFoundException.new('USER_NOT_FOUND', `User ${id} not found`)
      );
    }
    return user;
  });
```

### Business Operations
```typescript
// In domain services
const processPayment = (amount: number): Effect.Effect<PaymentResult, OperationException> =>
  Effect.gen(function* () {
    if (amount <= 0) {
      return yield* Effect.fail(
        OperationException.new('INVALID_AMOUNT', 'Payment amount must be positive')
      );
    }
    // Process payment...
  });
```

## Best Practices

### Exception Selection
- **ValidationException**: Data validation, business rule violations
- **NotFoundException**: Resource not found scenarios
- **OperationException**: Business operation failures
- **CommonException**: Generic errors, system-level issues

### Error Design
1. **Use descriptive codes**: `USER_NOT_FOUND`, `INVALID_EMAIL_FORMAT`
2. **Provide actionable messages**: Help users understand what went wrong
3. **Include context**: Use `loc` to show where the error occurred
4. **Add instructions**: Help users resolve the issue
5. **Structure violations**: Use `withViolations()` for complex validation

### Error Handling
1. **Be specific**: Choose the most appropriate exception type
2. **Include details**: Add debugging information without exposing sensitive data
3. **Chain errors**: Use `fromParseError()` to preserve original error context
4. **Document codes**: Maintain a registry of error codes and their meanings

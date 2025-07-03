# Exception Handling

Effect-DDD provides a comprehensive exception handling system with typed errors and structured error information.

## Base Exception Structure

All exceptions extend from `CommonException` which provides a consistent structure:

```typescript
interface BaseExceptionProps<CONTENT> {
  readonly code: string;
  readonly message: string;
  readonly content?: CONTENT;
}

class CommonException extends Data.TaggedError('BaseException')<
  BaseExceptionProps<any>
> {}
```

## Exception Types

### `ValidationException`

Used for validation failures with detailed violation information.

```typescript
class ValidationException extends Data.TaggedError('ValidationFail')<
  BaseExceptionProps<{
    loc?: string[];       // Location path of the error
    instruction?: string[]; // How to fix the error
    details?: string[];   // Additional error details
    parseError?: any;     // Original parse error if available
    violations?: Array<{  // Multiple validation violations
      rule: string;       // Which rule was violated
      code: string;       // Error code for this violation  
      message: string;    // Human-readable message
    }>;
  }>
>
```

**Factory Methods:**
```typescript
// Create with basic error info
static new(
  code: string,
  message: string,
  content?: ValidationException['content'],
): ValidationException

// Create with multiple violations  
static withViolations(
  violations: Array<{
    rule: string;
    code: string;
    message: string;
  }>,
): ValidationException

// Create from a parse error
static fromParseError(
  parseError: ParseError,
  code?: string,
  message?: string,
): ValidationException
```

**Example Usage:**
```typescript
import { ValidationException } from 'effect-ddd';

// Simple validation error
const error = ValidationException.new(
  'INVALID_EMAIL',
  'Invalid email format',
  {
    loc: ['user', 'email'],
    details: ['Provided: not-an-email']
  }
);

// With multiple violations
const violationsError = ValidationException.withViolations([
  {
    rule: 'email_format',
    code: 'INVALID_EMAIL', 
    message: 'Must be valid email'
  },
  {
    rule: 'password_strength',
    code: 'WEAK_PASSWORD',
    message: 'Password too weak'  
  }
]);

// From parse error
const parseError = new ParseError('Failed to parse');
const parseException = ValidationException.fromParseError(parseError);
```

### `NotFoundException`

Used when a requested resource is not found.

```typescript
class NotFoundException extends Data.TaggedError('Notfound')<
  BaseExceptionProps<{
    loc?: string[];
    instruction?: string[]; 
    details?: string[];
  }>
>
```

**Factory Method:**
```typescript
static new(
  code: string,
  message: string,
  content?: NotFoundException['content'],
): NotFoundException
```

**Example:**
```typescript
const notFound = NotFoundException.new(
  'USER_NOT_FOUND',
  'User with specified ID not found',
  {
    loc: ['users', '123'],
    instruction: ['Check if user exists']
  }
);
```

### `OperationException`

Used for general operation failures.

```typescript
class OperationException extends Data.TaggedError('Operation')<
  BaseExceptionProps<{
    loc?: string[];
    instruction?: string[];
    details?: string[]; 
  }>
>
```

**Factory Method:**
```typescript
static new(
  code: string,
  message: string,
  content?: OperationException['content'],
): OperationException
```

**Example:**
```typescript
const opError = OperationException.new(
  'PAYMENT_FAILED',
  'Payment processing failed',
  {
    details: ['Insufficient funds']
  }
);
```

## Common Exception Factory

For creating basic exceptions:

```typescript
const CommonExceptionTrait = {
  construct: (
    code: string,
    message: string,
    content?: unknown,
  ): CommonException
}
```

**Example:**
```typescript
const error = CommonExceptionTrait.construct(
  'AUTH_FAILED', 
  'Authentication failed'
);
```

## Base Exception Type

All exceptions can be referenced via the `BaseException` type:

```typescript
type BaseException =
  | CommonException
  | OperationException
  | ValidationException
  | NotFoundException
  | ParseError;
```

## Best Practices

1. **Use specific exception types** - Choose the most specific exception type for each case
2. **Provide error codes** - Use consistent, documented error codes
3. **Include location info** - Help identify where the error occurred
4. **Add remediation instructions** - When possible, suggest how to fix
5. **Include details** - Add any relevant debugging information
6. **Use violations for complex validation** - When multiple things can go wrong

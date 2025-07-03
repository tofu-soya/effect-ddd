# Schema Validation

Effect-DDD provides a composable schema builder for declarative validation.

## String Validation

### Basic String Schemas

```typescript
import { pipe } from 'effect';
import { stringSchema, withMinLength, withMaxLength, buildStringSchema } from 'effect-ddd';

const UsernameSchema = pipe(
  stringSchema(),
  withMinLength(3, 'Must be at least 3 characters'),
  withMaxLength(20, 'Cannot exceed 20 characters'),
  buildStringSchema
);
```

### Common String Validators

- `withNonEmpty()` - Requires non-empty string
- `withEmail()` - Validates email format
- `withPattern()` - Custom regex validation
- `withUrl()` - Validates URL format
- `withPhoneNumber()` - Validates phone numbers

## Number Validation

```typescript
import { numberSchema, withMin, withMax, withInteger } from 'effect-ddd';

const AgeSchema = pipe(
  numberSchema(),
  withMin(0, 'Cannot be negative'),
  withMax(120, 'Unlikely age'),
  withInteger('Must be whole number'),
  buildNumberSchema
);
```

### Common Number Validators

- `withPositive()` - Must be > 0
- `withNonNegative()` - Must be >= 0  
- `withInteger()` - Must be whole number
- `withMin()`/`withMax()` - Range validation

## Object Validation

```typescript
import { objectSchema, withCrossFieldValidation } from 'effect-ddd';

const DateRangeSchema = pipe(
  objectSchema({
    start: Schema.Date,
    end: Schema.Date
  }),
  withCrossFieldValidation(
    (range) => range.end > range.start,
    'End date must be after start'
  ),
  buildObjectSchema
);
```

## Common Schemas

Pre-defined schemas for common types:

```typescript
import { CommonSchemas } from 'effect-ddd';

// String schemas
CommonSchemas.Email
CommonSchemas.PhoneNumber 
CommonSchemas.NonEmptyString

// Number schemas  
CommonSchemas.PositiveNumber
CommonSchemas.Age

// Date schemas
CommonSchemas.FutureDate
CommonSchemas.PastDate
```

## Custom Validation

For complex validation logic:

```typescript
import { withValidation } from 'effect-ddd';

const UserSchema = pipe(
  baseSchema,
  withValidation((user) => 
    user.age < 13 && !user.parentalConsent
      ? Effect.fail('Minors require consent')
      : Effect.succeed(user)
  )
);
```

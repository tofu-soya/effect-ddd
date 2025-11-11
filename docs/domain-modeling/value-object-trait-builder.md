# Value Object Trait Builder

**File:** `docs/domain-modeling/value-object-trait-builder.md`

## Overview

The Value Object Trait Builder provides utilities for creating basic value object traits with validation and core operations (`new`, `parse`). For complex value objects with many queries, use this builder only for scaffolding and implement domain logic as separate methods.

## Core Interface

### ValueObjectTrait
```typescript
export interface ValueObjectTrait<
  VO extends ValueObject,
  NewParams = unknown,
  ParseParams = unknown,
> {
  // Core Methods provided by trait
  new(params: NewParams): Effect.Effect<VO, ValidationException>;
  parse(data: ParseParams): Effect.Effect<VO, ValidationException>;
}
```

## Builder API

### Step 1: Initialize Builder
```typescript
import { createValueObject } from 'effect-ddd';

const config = createValueObject<ValueObjectProps, NewParams>('ValueObjectName');
```

### Step 2: Add Validation
```typescript
import { withSchema, withInvariant, withValidation } from 'effect-ddd';

// Option A: Use Effect Schema
const configWithSchema = pipe(
  config,
  withSchema(ValueObjectSchema)
);

// Option B: Use custom parser (alternative to schema)
const configWithParser = pipe(
  config,
  withPropsParser(customParserFunction)
);

// Add business invariants
const configWithInvariant = pipe(
  configWithSchema,
  withInvariant(
    (props) => props.value.length > 0,
    'Value cannot be empty',
    'EMPTY_VALUE'
  )
);

// Add custom validation
const configWithValidation = pipe(
  configWithInvariant,
  withValidation((props) => 
    isValidFormat(props.value)
      ? Effect.succeed(props)
      : Effect.fail(ValidationException.new('INVALID_FORMAT', 'Invalid format'))
  )
);
```

### Step 3: Build Trait
```typescript
import { buildValueObject } from 'effect-ddd';

const BaseValueObjectTrait = pipe(
  configWithValidation,
  buildValueObject
);
```

## Complete Example

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createValueObject,
  withSchema,
  withInvariant,
  buildValueObject,
  ValueObject,
  ValueObjectTrait,
  ValidationException,
} from 'effect-ddd';

// 1. Define types
type EmailProps = {
  value: string;
};

type EmailInput = string;

export type Email = ValueObject<EmailProps>;

// 2. Define schema
const EmailSchema = Schema.Struct({
  value: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(254),
    Schema.includes('@')
  ),
});

// 3. Build base trait using builder utilities
const BaseEmailTrait = pipe(
  createValueObject<EmailProps, EmailInput>('Email'),
  withSchema(EmailSchema),
  withInvariant(
    (props) => {
      const parts = props.value.split('@');
      return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
    },
    'Email must have valid local and domain parts',
    'INVALID_EMAIL_FORMAT'
  ),
  withInvariant(
    (props) => !props.value.startsWith('.') && !props.value.endsWith('.'),
    'Email cannot start or end with a dot',
    'INVALID_EMAIL_DOTS'
  ),
  buildValueObject
);

// 4. Export for use in domain trait implementation
export { BaseEmailTrait };
```

## Usage in Domain Trait

```typescript
// In your main domain file
import { BaseEmailTrait } from './email-base-trait';

export interface IEmailTrait extends ValueObjectTrait<Email, EmailInput, EmailInput> {
  // Domain queries
  getDomain(email: Email): string;
  getLocalPart(email: Email): string;
  isCommonDomain(email: Email): boolean;
}

export const EmailTrait: IEmailTrait = {
  // Inherit builder-provided methods (new, parse)
  ...BaseEmailTrait,
  
  // Implement domain-specific logic
  getDomain: (email) => email.props.value.split('@')[1],
  getLocalPart: (email) => email.props.value.split('@')[0],
  isCommonDomain: (email) => {
    const domain = email.props.value.split('@')[1];
    const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    return commonDomains.includes(domain.toLowerCase());
  },
};
```

## withQuery() Usage

### For Simple Value Objects (Recommended)

When your value object has only a few queries, you can use the builder methods:

```typescript
const SimpleEmailTrait = pipe(
  createValueObject<EmailProps, EmailInput>('Email'),
  withSchema(EmailSchema),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  withQuery('getLocalPart', (props) => props.value.split('@')[0]),
  withQuery('isGmail', (props) => props.value.endsWith('@gmail.com')),
  buildValueObject
);
```

### For Complex Value Objects (Not Recommended)

❌ **Avoid this pattern for value objects with many queries:**

```typescript
// This will hurt TypeScript LSP performance
const ComplexEmailTrait = pipe(
  createValueObject<EmailProps, EmailInput>('Email'),
  withSchema(EmailSchema),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  withQuery('getLocalPart', (props) => props.value.split('@')[0]),
  withQuery('isGmail', (props) => props.value.endsWith('@gmail.com')),
  withQuery('isYahoo', (props) => props.value.endsWith('@yahoo.com')),
  withQuery('isOutlook', (props) => props.value.endsWith('@outlook.com')),
  withQuery('isCommonDomain', (props) => /* complex logic */),
  withQuery('getLength', (props) => props.value.length),
  withQuery('hasNumbers', (props) => /\d/.test(props.value)),
  withQuery('getInitials', (props) => /* complex logic */),
  // ... many more queries
  buildValueObject // <- TypeScript will struggle here
);
```

### API Signatures

#### withQuery()
```typescript
withQuery<K extends string, R>(
  name: K,
  queryFn: (props: ValueObjectProps) => R
): (config: ValueObjectConfig) => ValueObjectConfig & { queries: Record<K, QueryFn> }
```

#### withQueryEffect()
```typescript
withQueryEffect<K extends string, R>(
  name: K,
  queryFn: (props: ValueObjectProps) => Effect.Effect<R, any, any>
): (config: ValueObjectConfig) => ValueObjectConfig & { queries: Record<K, QueryEffectFn> }
```

## Common Patterns

### Email Value Object
```typescript
const EmailTrait = pipe(
  createValueObject<{ value: string }, string>('Email'),
  withPropsParser((emailString: string) =>
    Effect.gen(function* () {
      const normalized = emailString.toLowerCase().trim();
      if (!validator.isEmail(normalized)) {
        return yield* Effect.fail(ValidationException.new('INVALID_EMAIL', 'Invalid email format'));
      }
      return { value: normalized };
    })
  ),
  buildValueObject
);
```

### Money Value Object
```typescript
const MoneyTrait = pipe(
  createValueObject<{ amount: number; currency: string }, { amount: number; currency: string }>('Money'),
  withSchema(Schema.Struct({
    amount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
    currency: Schema.String.pipe(Schema.length(3))
  })),
  withInvariant(
    (props) => ['USD', 'EUR', 'GBP', 'JPY'].includes(props.currency),
    'Currency must be supported',
    'UNSUPPORTED_CURRENCY'
  ),
  buildValueObject
);
```

### URL Value Object
```typescript
const URLTrait = pipe(
  createValueObject<{ value: string }, string>('URL'),
  withPropsParser((urlString: string) =>
    Effect.gen(function* () {
      try {
        const url = new URL(urlString);
        return { value: url.toString() };
      } catch {
        return yield* Effect.fail(ValidationException.new('INVALID_URL', 'Invalid URL format'));
      }
    })
  ),
  buildValueObject
);
```

## Builder Functions Reference

### Core Builders
- `createValueObject<Props, NewParams>(tag: string)` - Initialize value object builder

### Validation
- `withSchema(schema: Schema.Schema)` - Add Effect Schema validation
- `withPropsParser(parser: PropsParser)` - Add custom parsing logic (alternative to schema)
- `withInvariant(predicate, message, code?)` - Add business rule validation
- `withValidation(validator)` - Add custom validation function

### Query Builders (Use with Caution)
- `withQuery(name, queryFn)` - Add synchronous query method to trait
- `withQueryEffect(name, queryFn)` - Add asynchronous query method to trait

### Finalization
- `buildValueObject(config)` - Create the base value object trait

## Best Practices

1. **Use builders for scaffolding only** - Provides `new`, `parse`, and validation
2. **Implement domain logic separately** - Better TypeScript LSP performance
3. **Keep invariants in builders** - Structural and data consistency rules
4. **Domain queries as methods** - Complex computation logic outside builders
5. **Export base trait** - Reuse builder output in domain implementations
6. **Normalize input** - Use `withPropsParser` to clean and validate input data

## Performance Notes

- **Small value objects (1-3 queries)**: `withQuery()` and `withQueryEffect()` are fine
- **Complex value objects (4+ queries)**: Use builders for scaffolding only, implement methods separately
- **TypeScript LSP**: Deep builder chains slow down autocomplete and type checking
- **Compilation speed**: Fewer builder methods = faster TypeScript compilation
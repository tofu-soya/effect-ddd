# Entity Trait Builder

**File:** `docs/domain-modeling/entity-trait-builder.md`

## Overview

The Entity Trait Builder provides utilities for creating basic entity traits with validation and core operations (`new`, `parse`). For complex entities with many commands/queries, use this builder only for scaffolding and implement domain logic as separate methods.

## Core Interface

### EntityTrait
```typescript
export interface EntityTrait<
  E extends Entity,
  NewParams = unknown,
  ParseParams = unknown,
> extends ValueObjectTrait<E, NewParams, ParseParams> {
  // Core Methods provided by trait
  new(params: NewParams): Effect.Effect<E, ValidationException>;
  parse(data: ParseParams): Effect.Effect<E, ValidationException>;
}
```

## Builder API

### Step 1: Initialize Builder
```typescript
import { createEntity } from 'effect-ddd';

const config = createEntity<EntityProps, NewParams>('EntityName');
```

### Step 2: Add Validation
```typescript
import { withSchema, withInvariant, withValidation } from 'effect-ddd';

// Option A: Use Effect Schema
const configWithSchema = pipe(
  config,
  withSchema(EntitySchema)
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
    (props) => props.age >= 0,
    'Age must be non-negative',
    'INVALID_AGE'
  )
);

// Add custom validation
const configWithValidation = pipe(
  configWithInvariant,
  withValidation((props) => 
    props.email.includes('@') 
      ? Effect.succeed(props)
      : Effect.fail(ValidationException.new('INVALID_EMAIL', 'Email must contain @'))
  )
);
```

### Step 3: Build Trait
```typescript
import { buildEntity } from 'effect-ddd';

const BaseEntityTrait = pipe(
  configWithValidation,
  buildEntity
);
```

## Complete Example

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createEntity,
  withSchema,
  withInvariant,
  buildEntity,
  Entity,
  EntityTrait,
  ValidationException,
} from 'effect-ddd';

// 1. Define types
type UserProps = {
  name: string;
  email: string;
  age: number;
  isActive: boolean;
};

type UserInput = {
  name: string;
  email: string;
  age: number;
};

export type User = Entity<UserProps>;

// 2. Define schema
const UserSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.includes('@')),
  age: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  isActive: Schema.Boolean.pipe(Schema.optional).withDefault(() => false),
});

// 3. Build base trait using builder utilities
const BaseUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withInvariant(
    (props) => props.age < 150,
    'Age must be realistic',
    'UNREALISTIC_AGE'
  ),
  withInvariant(
    (props) => props.name.trim().length > 0,
    'Name cannot be empty or whitespace',
    'EMPTY_NAME'
  ),
  buildEntity
);

// 4. Export for use in domain trait implementation
export { BaseUserTrait };
```

## Usage in Domain Trait

```typescript
// In your main domain file
import { BaseUserTrait } from './user-base-trait';

export interface IUserTrait extends EntityTrait<User, UserInput, UserInput> {
  // Domain queries
  getDisplayName(user: User): string;
  isAdult(user: User): boolean;
  
  // Domain commands
  activate(): (user: User) => Effect.Effect<User, ValidationException>;
  updateEmail(newEmail: string): (user: User) => Effect.Effect<User, ValidationException>;
}

export const UserTrait: IUserTrait = {
  // Inherit builder-provided methods (new, parse)
  ...BaseUserTrait,
  
  // Implement domain-specific logic
  getDisplayName: (user) => `${user.props.name} <${user.props.email}>`,
  isAdult: (user) => user.props.age >= 18,
  
  activate: () => (user) =>
    BaseUserTrait.parse({
      ...user.props,
      isActive: true,
    }),
    
  updateEmail: (newEmail) => (user) =>
    Effect.gen(function* () {
      if (!newEmail.includes('@')) {
        return yield* Effect.fail(
          ValidationException.new('INVALID_EMAIL', 'Email must contain @')
        );
      }
      
      return BaseUserTrait.parse({
        ...user.props,
        email: newEmail,
      });
    }),
};
```

## withQuery() and withCommand() Usage

### For Simple Entities (Recommended)

When your entity has only a few queries/commands, you can use the builder methods:

```typescript
const SimpleUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withQuery('getDisplayName', (props) => `${props.name} <${props.email}>`),
  withQuery('isActive', (props) => props.isActive),
  withCommand('activate', (_, props) =>
    Effect.succeed({ props: { ...props, isActive: true } })
  ),
  withCommand('updateEmail', (newEmail: string, props) =>
    Effect.gen(function* () {
      if (!newEmail.includes('@')) {
        return yield* Effect.fail(ValidationException.new('INVALID_EMAIL', 'Invalid email'));
      }
      return { props: { ...props, email: newEmail } };
    })
  ),
  buildEntity
);
```

### For Complex Entities (Not Recommended)

❌ **Avoid this pattern for entities with many operations:**

```typescript
// This will hurt TypeScript LSP performance
const ComplexUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withQuery('getDisplayName', (props) => `${props.name} <${props.email}>`),
  withQuery('isActive', (props) => props.isActive),
  withQuery('isAdult', (props) => props.age >= 18),
  withQuery('getInitials', (props) => props.name.split(' ').map(n => n[0]).join('')),
  withQuery('getDomain', (props) => props.email.split('@')[1]),
  // ... many more queries
  withCommand('activate', activateHandler),
  withCommand('deactivate', deactivateHandler),
  withCommand('updateEmail', updateEmailHandler),
  withCommand('updateName', updateNameHandler),
  withCommand('updateAge', updateAgeHandler),
  // ... many more commands
  buildEntity // <- TypeScript will struggle here
);
```

### API Signatures

#### withQuery()
```typescript
withQuery<K extends string, R>(
  name: K,
  queryFn: (props: EntityProps) => R
): (config: EntityConfig) => EntityConfig & { queries: Record<K, QueryFn> }
```

#### withCommand()
```typescript
withCommand<K extends string, I>(
  name: K,
  commandFn: (
    input: I,
    props: EntityProps,
    entity: Entity
  ) => Effect.Effect<{ props: EntityProps }, ValidationException>
): (config: EntityConfig) => EntityConfig & { commands: Record<K, CommandFn> }
```

## Builder Functions Reference

### Core Builders
- `createEntity<Props, NewParams>(tag: string)` - Initialize entity builder

### Validation
- `withSchema(schema: Schema.Schema)` - Add Effect Schema validation
- `withPropsParser(parser: PropsParser)` - Add custom parsing logic (alternative to schema)
- `withInvariant(predicate, message, code?)` - Add business rule validation
- `withValidation(validator)` - Add custom validation function

### Query and Command Builders (Use with Caution)
- `withQuery(name, queryFn)` - Add query method to trait
- `withCommand(name, commandFn)` - Add command method to trait

### Finalization
- `buildEntity(config)` - Create the base entity trait

## Best Practices

1. **Use builders for scaffolding only** - Provides `new`, `parse`, and validation
2. **Implement domain logic separately** - Better TypeScript LSP performance
3. **Keep invariants in builders** - Structural and data consistency rules
4. **Domain commands as methods** - Complex business logic outside builders
5. **Export base trait** - Reuse builder output in domain implementations

## Performance Notes

- **Small entities (1-3 operations)**: `withQuery()` and `withCommand()` are fine
- **Complex entities (4+ operations)**: Use builders for scaffolding only, implement methods separately
- **TypeScript LSP**: Deep builder chains slow down autocomplete and type checking
- **Compilation speed**: Fewer builder methods = faster TypeScript compilation
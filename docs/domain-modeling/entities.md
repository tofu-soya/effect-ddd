# Entities

Entities represent domain objects with a distinct identity and mutable state. Their state changes are managed through explicit commands.

## Core Interface

```typescript
export interface Entity<Props extends Record<string, unknown>> extends ValueObject<Props> {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Option<Date>;
}

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

## Defining Entities

**Recommended Pattern** for entities with many commands/queries (better TypeScript LSP performance):

### Step 1: Define Types
```typescript
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
```

### Step 2: Define Schema
```typescript
const UserSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.includes('@')),
  age: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  isActive: Schema.Boolean.pipe(Schema.optional).withDefault(() => false),
});
```

### Step 3: Create Base Trait (using builders as utilities)
```typescript
const BaseUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  buildEntity
);
```

> **📖 See:** [Entity Trait Builder Guide](./entity-trait-builder.md) for detailed builder API documentation

### Step 4: Define Trait Interface
```typescript
export interface IUserTrait extends EntityTrait<User, UserInput, UserInput> {
  // Queries
  getDisplayName(user: User): string;
  isAdult(user: User): boolean;
  
  // Commands
  activate(): (user: User) => Effect.Effect<User, ValidationException>;
  updateEmail(newEmail: string): (user: User) => Effect.Effect<User, ValidationException>;
}
```

### Step 5: Implement Domain Logic
```typescript
export const UserTrait: IUserTrait = {
  // Inherit basic operations (new, parse)
  ...BaseUserTrait,
  
  // Implement domain queries
  getDisplayName: (user) => `${user.props.name} <${user.props.email}>`,
  isAdult: (user) => user.props.age >= 18,
  
  // Implement domain commands
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

## Usage

```typescript
const user = await Effect.runPromise(
  UserTrait.new({ name: 'John', email: 'john@example.com', age: 25 })
);
console.log(UserTrait.getDisplayName(user)); // "John <john@example.com>"
console.log(UserTrait.isAdult(user)); // true

const activatedUser = await Effect.runPromise(UserTrait.activate()(user));
console.log(activatedUser.props.isActive); // true
```

## Builder Functions as Utilities

- `createEntity()` / `buildEntity()` are **trait building utilities**
- They provide basic `new`, `parse` operations and schema validation
- **Not intended** for complex domain logic (use normal methods instead for better LSP performance)

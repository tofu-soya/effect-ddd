# Entities

Entities represent domain objects with a distinct identity and mutable state. Their state changes are managed through explicit commands.

## Defining Entities

1. **Define Properties (Props Type):** Create a type (`YourEntityProps`) for the entity's unique properties.
2. **Define Entity Type:** Extend the generic `Entity` type with your `Props` type.
3. **Define Trait Interface:** Create an interface (`IYourEntityTrait`) that extends `EntityTrait<YourEntity, NewParams, ParseParams>`.
4. **Initiate Configuration:** Use `createEntity<YourEntityProps, NewParams>(tag: string)`.
5. **Define Structure and Validation:** Use `withSchema()` with an Effect Schema.
6. **Add Custom Validation Logic:** Use `withValidation()` for additional business rules.
7. **Define Invariants:** Use `withInvariant()` to enforce strict conditions.
8. **Add Queries:** Use `withQuery()` or `withQueryEffect()`.
9. **Add Commands:** Use `withCommand()` to define state-modifying methods.
10. **Build the Trait:** Call `buildEntity()`.

## Example: User Entity

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createEntity,
  withSchema,
  withValidation,
  withQuery,
  withCommand,
  buildEntity,
  Entity,
  EntityTrait,
  ValidationException,
} from 'effect-ddd';

type UserProps = {
  name: string;
  email: string; 
  isActive: boolean;
  age: number;
};

export type User = Entity<UserProps>;

export interface IUserTrait extends EntityTrait<User, UserInput, UserInput> {
  isActive: boolean;
  activate(): CommandOnModel<User>;
}

export const UserTrait: IUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withValidation((props) => 
    props.age < 13 
      ? Effect.fail(ValidationException.new('MINOR_NO_CONSENT', 'Minors require consent'))
      : Effect.succeed(props)
  ),
  withCommand('activate', (_, props) => 
    Effect.succeed({ props: { ...props, isActive: true } })
  ),
  buildEntity,
);
```

## Configuration Methods

### `createEntity<Props, NewParams>(tag: string)`
Initializes entity configuration.

### `withValidation(validator)`
Adds custom validation logic.

### `withCommand(name, handler)`
Adds state-modifying command method.

### `buildEntity(config)`
Finalizes the entity trait.

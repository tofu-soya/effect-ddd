# Value Objects

Value Objects represent descriptive aspects of the domain with no conceptual identity. They are immutable and defined purely by their attributes. Examples include `Email`, `Money`, and `Address`.

## Defining Value Objects

1. **Define Properties (Props Type):** Create a TypeScript type (`YourVOProps`) for the value object's immutable attributes.
2. **Define ValueObject Type:** Extend the generic `ValueObject` type from `effect-ddd` with your `Props` type.
3. **Define Trait Interface:** Create an interface (`IYourVOTrait`) that extends `ValueObjectTrait<YourVO, NewParams, ParseParams>`. This interface will include any custom query methods you add.
4. **Initiate Configuration:** Use `createValueObject<YourVOProps, NewParams>(tag: string)` to start the configuration. The `tag` is a unique identifier.
5. **Define Structure and Validation**:
   - Use `withSchema()` for declarative validation
   - Or `withPropsParser()` for custom parsing logic
6. **Add Queries**:
   - `withQuery()` for synchronous computations
   - `withQueryEffect()` for async computations
7. **Build the Trait:** Call `buildValueObject()`

## Example: Email Value Object

```typescript
import { Effect, pipe } from 'effect';
import {
  createValueObject,
  buildValueObject,
  ValidationException,
  ValueObject,
  ValueObjectTrait,
  withPropsParser,
  withQuery,
} from 'effect-ddd';
import validator from 'validator';

type EmailProps = { value: string };
export type Email = ValueObject<EmailProps>;

export interface IEmailTrait extends ValueObjectTrait<Email, string, string> {
  getDomain(): string;
}

export const EmailTrait: IEmailTrait = pipe(
  createValueObject<Email, string, string>('Email'),
  withPropsParser((emailString: string) =>
    Effect.gen(function* () {
      const normalized = emailString.toLowerCase().trim();
      if (!validator.isEmail(normalized)) {
        return yield* Effect.fail(
          ValidationException.new('INVALID_EMAIL', 'Invalid email format'),
        );
      }
      return { value: normalized };
    }),
  ),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  buildValueObject,
);
```

## Configuration Methods

### `createValueObject<Props, NewParams>(tag: string)`
Initializes value object configuration.

### `withSchema(schema: Schema.Schema<S>)` 
Applies Effect Schema for declarative validation.

### `withPropsParser(propsParser: NewPropsParser)`
Provides custom parsing logic.

### `withQuery(name, query)`
Adds synchronous query method.

### `withQueryEffect(name, query)`
Adds asynchronous query method.

### `buildValueObject(config)`
Finalizes the value object trait.

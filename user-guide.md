# Effect DDD - Comprehensive API Reference

Complete API documentation for the functional domain modeling library with detailed function signatures, examples, and advanced patterns.

## 📋 Table of Contents

1. [🔨 Domain Builder API](#-domain-builder-api)
2. [🧩 Schema Builder API](#-schema-builder-api)
3. [🗃️ Repository Factory API](#%EF%B8%8F-repository-factory-api)
4. [🏛️ Core Traits API](#%EF%B8%8F-core-traits-api)
5. [📢 Domain Events API](#-domain-events-api)
6. [✅ Validation & Exceptions API](#-validation--exceptions-api)
7. [🔧 Utilities & Type Classes](#-utilities--type-classes)
8. [🌐 NestJS Integration - DTO Layer](#-nestjs-integration---dto-layer)
9. [🗄️ NestJS Integration - TypeORM Infrastructure](#%EF%B8%8F-nestjs-integration---typeorm-infrastructure)

---

## 🔨 Domain Builder API

The Domain Builder provides a functional, composable API for creating domain models with built-in validation, queries, and commands. This section guides you through defining Value Objects, Entities, and Aggregate Roots.

### 1. Defining Value Objects

Value Objects represent descriptive aspects of the domain with no conceptual identity. They are immutable and defined purely by their attributes. Examples include `Email`, `Money`, and `Address`.

**Purpose**: Encapsulate data that describes a thing. Equality is based on attribute values, not identity.

**Steps to Define a Value Object:**

1. **Define Properties (Props Type):** Create a TypeScript type (`YourVOProps`) for the value object's immutable attributes.
2. **Define ValueObject Type:** Extend the generic `ValueObject` type from `effect-ddd` with your `Props` type.
3. **Define Trait Interface:** Create an interface (`IYourVOTrait`) that extends `ValueObjectTrait<YourVO, NewParams, ParseParams>`. This interface will include any custom query methods you add.
4. **Initiate Configuration:** Use `createValueObject<YourVOProps, NewParams>(tag: string)` to start the configuration. The `tag` is a unique identifier.
5. **Define Structure and Validation (Choose one):**

   - **`withSchema(schema: Schema.Schema<S>)` (Recommended for declarative validation):**
     Apply an Effect Schema that defines the structure and validation rules for your props. Follow this pattern:

     1. First define the schema (e.g. `MyPropsSchema`)
     2. Infer the props type from it (`type MyProps = typeof MyPropsSchema.Type`)
     3. Use that type for your model (`type MyModel = ValueObject<MyProps>`)
     4. Pass the original schema to `withSchema`

     Example:

     ```typescript
     const MyPropsSchema = Schema.Struct({
       id: Identifier,
       name: CommonSchemas.NonEmptyString,
     });
     type MyProps = typeof MyPropsSchema.Type;
     type MyModel = ValueObject<MyProps>;

     const MyModelTrait = pipe(
       createValueObject<MyModel>('MyModel'),
       withSchema(MyPropsSchema), // Same schema used here
       // ...
     );
     ```

     Benefits:

     - Single source of truth for both runtime validation and types
     - Impossible for types to drift from validation
     - Works perfectly with Effect's type inference

     Schema validation runs before custom validators. Setting `withSchema` clears any existing `propsParser` to avoid conflicts.

   - **`withPropsParser(propsParser: NewPropsParser)` (For complex custom parsing):** Provide a custom parser function that takes input and returns validated properties as an Effect. This is useful for complex business logic, external API calls during validation, or when you need full control over error handling. Setting `withPropsParser` clears any existing `schema` to avoid conflicts.

6. **Add Queries (Optional):**
   - Use `withQuery<K, R>(name: K, query: (props: Props) => R)` for synchronous computations derived from the value object's properties.
   - Use `withQueryEffect<K, R>(name: K, query: (props: Props) => Effect<R, any, any>)` for asynchronous computations or side effects.
7. **Build the Trait:** Call `buildValueObject(config)` to finalize the value object trait, making it ready for use.

---

**Complete Example (Email Value Object using `withPropsParser`):**

```typescript
import { Effect, pipe } from 'effect';
import {
  createValueObject,
  buildValueObject,
  ValidationException,
  ValueObject,
  ValueObjectTrait,
  withPropsParser,
  NonEmptyString,
  withQuery, // Added for potential getDomain example
} from 'effect-ddd';
import validator from 'validator'; // Assuming you use a validator library like 'validator.js'

// 1. Define Props type for Email Value Object
type EmailProps = { value: string };

// 2. Define the Email Value Object type
export type Email = ValueObject<EmailProps>;

// 3. Define the Trait Interface for Email
type EmailQuery<R> = QueryFunction<Email, R>;

export interface IEmailTrait extends ValueObjectTrait<Email, string, string> {
  getDomain(): EmailQuery<string>; // Example custom query
}

// 4-7. Define and Build the Email Trait using withPropsParser
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
  withQuery('getDomain', (props) => props.value.split('@')[1]), // Example custom query
  buildValueObject,
);

// Example Usage
async function usageExample() {
  // Create a valid email
  const validEmailResult = await Effect.runPromise(
    EmailTrait.new('user@example.com'),
  );
  if (validEmailResult._tag === 'Right') {
    console.log('Successfully created email:', validEmailResult.right.unpack()); // { value: "user@example.com" }
    console.log('Email domain:', validEmailResult.right.getDomain()); // example.com
  } else {
    console.error('Failed to create email:', validEmailResult.left);
  }

  // Attempt to create an invalid email
  const invalidEmailResult = await Effect.runPromise(
    EmailTrait.new('invalid-email-format'),
  );
  if (invalidEmailResult._tag === 'Right') {
    console.log(
      'Successfully created email:',
      invalidEmailResult.right.unpack(),
    );
  } else {
    console.error(
      'Failed to create email (expected):',
      invalidEmailResult.left.message,
    ); // Invalid email format
  }
}
usageExample();
```

#### Configuration Creators

These functions initiate the configuration pipeline for different domain model types.

- `createValueObject<Props, NewParams>(tag: string)`

  - **Type Signature:**

    TypeScript

    ```typescript
    function createValueObject<
      VO extends ValueObject,
      NewParams = VO['props'],
      ParseParams = NewParams,
    >(
      tag: string,
    ): DomainConfig<VO, ParseParams, NewParams, Record<string, never>>;
    ```

  - **Parameters:**

    - `tag` (`string`): Unique identifier for the value object type
    - `Props`: TypeScript type representing the value object properties
    - `NewParams`: TypeScript type for the input to the `new` method (defaults to `Props`)

  - **Returns:** `DomainConfig` - Configuration object for further composition
  - **Example:**

    ```typescript
    import { createValueObject, Schema } from 'effect-ddd';
    import { Schema } from 'effect';

    // Schema-first pattern example:
    const EmailSchema = Schema.Struct({
      value: Schema.String.pipe(Schema.email()),
    });
    type EmailProps = typeof EmailSchema.Type;
    type Email = ValueObject<EmailProps>;

    const EmailConfig = createValueObject<Email, string>('Email');
    ```

#### Configuration Transformers - Value Object Specific

These functions apply transformations and add behaviors to value object configurations.

- `withSchema<T, S, NewParams>(schema: Schema.Schema<S>)`

  - **Type Signature:**

    ```typescript
    function withSchema<
      T extends Record<string, any>,
      S extends Record<string, any>,
      NewParams,
    >(
      schema: Schema.Schema<S>,
    ): (config: DomainConfig<T, NewParams>) => DomainConfig<S, NewParams>;
    ```

  - **Parameters:**

    - `schema`: Effect Schema that defines the structure and validation rules

  - **Returns:** Function that transforms the configuration to use the new schema type
  - **Notes:** Setting `withSchema` clears any existing `propsParser` to avoid conflicts. Schema validation runs before custom validators. Provides automatic TypeScript inference.

  - **Best Practice:**
    For robust validation and type safety, follow the schema-first pattern:

    1. First define the schema (e.g. `MyPropsSchema`)
    2. Infer the props type from it (`type MyProps = typeof MyPropsSchema.Type`)
    3. Use that type for your model (`type MyModel = ValueObject<MyProps>`)
    4. Pass the original schema to `withSchema`

    This ensures:

    - Single source of truth for both runtime validation and types
    - Impossible for types to drift from validation
    - Works perfectly with Effect's type inference

- `withPropsParser<TConfig, NewPropsParser>(propsParser: NewPropsParser)`

  - **Type Signature:**

    ```typescript
    function withPropsParser<
      TConfig extends AnyDomainConfig,
      NewPropsParser extends PropsParser<any, any>,
    >(propsParser: NewPropsParser): (config: TConfig) => TConfig;
    ```

  - **Parameters:**

    - `propsParser`: Custom parser function that takes input and returns validated properties as Effect

  - **Returns:** Function that transforms the configuration to use custom parsing logic
  - **Notes:** Setting `withPropsParser` clears any existing `schema` to avoid conflicts. Allows complex business logic and external API calls during validation. Full control over error handling and validation flow.

- `withInvariant<TConfig>(predicate, errorMessage, errorCode?)`

  - **Type Signature:**

    ```typescript
    function withInvariant<TConfig extends AnyDomainConfig>(
      predicate: TConfig extends DomainConfig<infer DM, any, any, any>
        ? (props: DM['props']) => boolean
        : never,
      errorMessage: string,
      errorCode: string = 'INVARIANT_VIOLATION',
    ): (config: TConfig) => TConfig;
    ```

  - **Parameters:**

    - `predicate`: Function that returns `true` if the invariant is satisfied
    - `errorMessage`: Error message when the invariant is violated
    - `errorCode`: Optional error code (defaults to `'INVARIANT_VIOLATION'`)

  - **Returns:** Function that adds the invariant check to the validation chain
  - **Example:**

    ```typescript
    import { pipe } from 'effect';
    import {
      createValueObject,
      withInvariant,
      buildValueObject,
    } from 'effect-ddd';
    import { Schema } from 'effect';

    type MoneyProps = { amount: number; currency: string };
    type MoneyInput = MoneyProps;
    export type Money = ValueObject<MoneyProps>;
    const MoneySchema = Schema.Struct({
      amount: Schema.Number,
      currency: Schema.String,
    });

    export interface IMoneyTrait
      extends ValueObjectTrait<Money, MoneyInput, MoneyInput> {}

    const MoneyTrait: IMoneyTrait = pipe(
      createValueObject<Money, MoneyInput, MoneyInput>('Money'),
      withSchema(MoneySchema),
      withInvariant(
        (props) => props.amount > 0,
        'Amount must be positive',
        'NEGATIVE_AMOUNT',
      ),
      withInvariant(
        (props) => props.amount <= 1000000,
        'Amount exceeds maximum limit',
        'AMOUNT_TOO_LARGE',
      ),
      buildValueObject,
    );
    ```

- `withQuery<TConfig, K, R>(name: K, query: (props: Props) => R)`

  - **Type Signature:**

    ```typescript
    <TConfig extends AnyDomainConfig, K extends string, R>(
        name: K,
        query: TConfig extends DomainConfig<infer DM, any, any, any>
          ? QueryFunction<DM['props'], R>
          : never,
      ) =>
      (
        config: TConfig,
      ): TConfig & {
        queries: TConfig['queries'] & Record<K, typeof query>;
      }
    ```

  - **Parameters:**

    - `name`: Name of the query method that will be added to the trait
    - `query`: Function that takes domain object properties and returns computed value

  - **Returns:** Function that adds the query to the configuration

- `withQueryEffect<TConfig, K, R>(name: K, query: (props: Props) => Effect<R, any, any>)`

  - **Type Signature:**

    ```typescript
    function withQueryEffect<
      TConfig extends AnyDomainConfig,
      K extends string,
      R,
    >(
      name: K,
      query: TConfig extends DomainConfig<infer DM, any, any, any>
        ? (props: DM['props']) => Effect.Effect<R, any, any>
        : never,
    ): (
      config: TConfig,
    ) => TConfig & { queries: TConfig['queries'] & Record<K, typeof query> };
    ```

  - **Parameters:**

    - `name`: Name of the async query method
    - `query`: Function that returns an Effect for async operations

  - **Returns:** Function that adds the async query to the configuration

#### Builders - Value Objects

These functions finalize the configuration into a runnable trait.

- `buildValueObject<T, NewParams>(config: DomainConfig<T, NewParams>)`

  - **Type Signature:**

    ```typescript
    function buildValueObject<T extends ValueObject, NewParams>(
      config: DomainConfig<T, NewParams>,
    ): ValueObjectTrait<T, NewParams, unknown> &
      QueryMethods<T['props'], Queries>;
    ```

  - **Parameters:**

    - `config`: Complete value object configuration

  - **Returns:** Value object trait with `parse`, `new`, and all configured query methods
  - **Example:**

    ```typescript
    import { pipe } from 'effect';
    import {
      createValueObject,
      withSchema,
      withQuery,
      buildValueObject,
    } from 'effect-ddd';
    import { Schema } from 'effect';

    type EmailProps = { value: string };
    const EmailSchema = Schema.Struct({ value: Schema.String }); // Assuming this is defined

    export type Email = ValueObject<EmailProps>;

    type QueryOnModel<R> = QueryFunction<Email, R>;
    // 3. Define the Trait Interface for Email
    export interface IEmailTrait
      extends ValueObjectTrait<Email, string, string> {
      getDomain(): QueryOnModel<string>; // Example custom query
    }

    const EmailTrait = pipe(
      createValueObject<Email, string>('Email'),
      withSchema(EmailSchema),
      withQuery('getDomain', (props) => props.value.split('@')[1]),
      buildValueObject, // Final trait creation
    );

    // Trait has these methods:
    // - EmailTrait.parse(props): Effect<ValueObject<EmailProps>, Error>
    // - EmailTrait.new(emailString): Effect<ValueObject<EmailProps>, Error>
    // - email.getDomain(): string
    ```

---

### 2. Defining Entities

Entities represent domain objects with a distinct identity and mutable state. Their state changes are managed through explicit commands.

**Purpose**: Model objects that have a unique identity and lifecycle, whose attributes may change over time.

**Steps to Define an Entity:**

1. **Define Properties (Props Type):** Create a type (`YourEntityProps`) for the entity's unique properties. `id`, `createdAt`, `updatedAt` properties are automatically managed by Effect-DDD.
2. **Define Entity Type:** Extend the generic `Entity` type from `effect-ddd` with your `Props` type.
3. **Define Trait Interface:** Create an interface (`IYourEntityTrait`) that extends `EntityTrait<YourEntity, NewParams, ParseParams>`. This interface will include any custom query and command methods.
4. **Initiate Configuration:** Use `createEntity<YourEntityProps, NewParams>(tag: string)` to start the configuration.
5. **Define Structure and Validation:** Use `withSchema(schema: Schema.Schema<S>)` with an Effect Schema. This is the primary method for defining the entity's data structure and initial validation.
6. **Add Custom Validation Logic (Optional):** Use `withValidation((props: Props) => ParseResult<Props>)` for additional business rules that run after schema validation. Each validator receives the output of the previous validator.
7. **Define Invariants (Optional):** Use `withInvariant(predicate, errorMessage, errorCode?)` to enforce strict conditions that must always be true for the entity's state.
8. **Customize Creation (`withNew`, Optional):** Use `withNew((params: NewParam, parse: ParseFunction) => ParseResult<DM>)` to override the default `new` method for custom creation logic before validation.
9. **Add Queries:** Use `withQuery` or `withQueryEffect` for synchronous or asynchronous computed properties based on the entity's state.
10. **Add Commands:** Use `withCommand<I>(name: string, handler: CommandHandler<I, Props>)` to define methods that modify the entity's state. The handler takes input, current props, and the entity instance, returning an `Effect` with the new properties.
11. **Build the Trait:** Call `buildEntity(config)` to finalize the entity trait.

---

**Complete Example (User Entity):**

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
  CommonSchemas,
} from 'effect-ddd';

// 1. Define Props type
type UserProps = {
  name: string;
  email: string;
  isActive: boolean;
  age: number;
  parentalConsent?: boolean;
  lastUpdated?: Date; // Added for updateProfile command example
};

// Define input type for new method
type UserInput = {
  name: string;
  email: string;
  age: number;
  parentalConsent?: boolean;
};

// Schema definition (can be shared or defined inline)
const UserSchema = Schema.Struct({
  name: CommonSchemas.NonEmptyString,
  email: CommonSchemas.Email,
  age: CommonSchemas.Age,
  isActive: Schema.Boolean.pipe(Schema.optional),
  parentalConsent: Schema.Boolean.pipe(Schema.optional),
  lastUpdated: Schema.Date.pipe(Schema.optional),
});

// 2. Define Entity type
export type User = Entity<UserProps>;

// 3. Define Trait Interface
type UserQuery<R> = QueryFunction<User, R>;

export interface IUserTrait extends EntityTrait<User, UserInput, UserInput> {
  isActive: UserQuery<boolean>;
  getDisplayName: UserQuery<string>;
  getEmailDomain: UserQuery<string>;
  getPreferences: UserQuery<Effect.Effect<any, any, any>>;
  getSubscriptionStatus: UserQuery<Effect.Effect<any, any, any>>;
  activate: (i: void) => CommandOnModel<User>;
  updateEmail: (i: string) => CommandOnModel<User>;
  updateProfile: (i: { name?: string; email?: string }) => CommandOnModel<User>;
}

// Assume fetchUserPreferences and subscriptionService are defined elsewhere
declare const fetchUserPreferences: (
  id: string,
) => Effect.Effect<any, any, any>;
declare const subscriptionService: { getStatus: (id: string) => Promise<any> };

// 4-11. Define and Build the User Trait
export const UserTrait: IUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withValidation((props: UserProps) =>
    Effect.gen(function* () {
      // Custom business rule validation
      if (props.age < 13 && !props.parentalConsent) {
        return yield* Effect.fail(
          ValidationException.new(
            'MINOR_NO_CONSENT',
            'Minors require parental consent',
          ),
        );
      }
      return props;
    }),
  ),
  withNew((input: UserInput, parse) =>
    Effect.gen(function* () {
      // Custom creation logic, e.g., normalizing input
      const normalizedInput = {
        ...input,
        email: input.email.toLowerCase().trim(),
        name: input.name.trim(),
        isActive: input.isActive ?? false, // Default isActive to false
      };
      return yield* parse(normalizedInput); // Use the provided parse function for validation
    }),
  ),
  withQuery('isAdult', (props) => props.age >= 18),
  withQuery('getDisplayName', (props) => `${props.name} (${props.email})`),
  withQuery('getEmailDomain', (props) => props.email.split('@')[1]),
  withQueryEffect('getPreferences', (props) =>
    Effect.gen(function* () {
      const prefs = yield* fetchUserPreferences(props.id);
      return {
        theme: prefs.theme,
        language: prefs.language,
        notifications: prefs.notifications,
      };
    }),
  ),
  withQueryEffect('getSubscriptionStatus', (props) =>
    Effect.tryPromise({
      try: () => subscriptionService.getStatus(props.id),
      catch: (error) => new Error(`Failed to get subscription: ${error}`),
    }),
  ),
  withCommand('activate', (_, props) =>
    Effect.succeed({ props: { ...props, isActive: true } }),
  ),
  withCommand('updateEmail', (newEmail: string, props) =>
    pipe(
      CommonSchemas.Email.decode(newEmail), // Re-use common schema for validation
      Effect.map((email) => ({ props: { ...props, email } })),
      Effect.mapError(() =>
        ValidationException.new('INVALID_EMAIL', 'Invalid email format'),
      ),
    ),
  ),
  withCommand(
    'updateProfile',
    (input: { name?: string; email?: string }, props: UserProps) =>
      Effect.gen(function* () {
        if (input.email && !CommonSchemas.Email.is(input.email)) {
          // Use Schema for validation
          return yield* Effect.fail(
            ValidationException.new('INVALID_EMAIL', 'Invalid email format'),
          );
        }

        return {
          props: {
            ...props,
            name: input.name ?? props.name,
            email: input.email ?? props.email,
            lastUpdated: new Date(),
          },
        };
      }),
  ),
  buildEntity,
);

// Usage Example
/*import { Effect } from 'effect';// Assuming UserData type for inputtype UserData = { name: string; email: string; age: number; };async function usageExample() {  const userData: UserData = { name: 'John Doe', email: 'john.doe@example.com', age: 30 };  const user = await Effect.runPromise(UserTrait.new(userData));  console.log('Initial user:', user.unpack()); // { name: 'John Doe', email: 'john.doe@example.com', isActive: false, age: 30 }  const activeUser = await Effect.runPromise(UserTrait.activate()(user));  console.log('Activated user:', activeUser.unpack()); // isActive: true  const updatedUser = await Effect.runPromise(UserTrait.updateProfile({ name: 'Jonathan Doe', email: 'jonathan@example.com' })(activeUser));  console.log('Updated user profile:', updatedUser.unpack()); // name: 'Jonathan Doe', email: 'jonathan@example.com', lastUpdated: Date  // Example of using queries  console.log('Is adult:', updatedUser.isAdult()); // true  console.log('Display name:', updatedUser.getDisplayName()); // Jonathan Doe (jonathan@example.com)  const preferences = await Effect.runPromise(updatedUser.getPreferences()); // Calls async query  console.log('User preferences:', preferences);}usageExample();*/
```

#### Configuration Creators - Entities

- `createEntity<Props, NewParams>(tag: string)`

  - **Type Signature:**

    ```typescript
    function createEntity<
      E extends Entity,
      NewParams = E['props'],
      ParseParams = NewParams,
    >(
      tag: string,
    ): EntityConfig<
      E,
      ParseParams,
      NewParams,
      Record<string, never>,
      Record<string, never>
    >;
    ```

  - **Parameters:**

    - `tag` (`string`): Unique identifier for the entity type
    - `Props`: TypeScript type representing the entity properties (excluding `id`, `createdAt`, `updatedAt`)
    - `NewParams`: TypeScript type for the input to the `new` method

  - **Returns:** `EntityConfig` - Configuration object that extends `DomainConfig` with command support
  - **Example:**

    ```typescript
    type UserProps = { name: string; email: string; isActive: boolean };
    type UserInput = { name: string; email: string };
    const UserConfig = createEntity<UserProps, UserInput>('User');
    ```

#### Configuration Transformers - Entity Specific

These functions apply transformations and add behaviors to entity configurations.

- `withValidation<TConfig>(validator: (props: Props) => ParseResult<Props>)`

  - **Type Signature:**

    ```typescript
    function withValidation<TConfig extends AnyDomainConfig>(
      validator: TConfig extends DomainConfig<infer DM, any, any, any>
        ? (props: DM['props']) => ParseResult<DM['props']>
        : never,
    ): (config: TConfig) => TConfig;
    ```

  - **Parameters:**

    - `validator`: Function that takes validated properties and returns Effect with additional validation

  - **Returns:** Function that adds the validator to the configuration's validation chain
  - **Notes:** Validators run in the order they are added. Each validator receives the output of the previous validator. Can modify properties or just validate them.

- `withNew<TConfig>(newMethod: (params: NewParam, parse: ParseFunction) => ParseResult<DM>)`

  - **Type Signature:**

    TypeScript

    ```typescript
    function withNew<TConfig extends AnyDomainConfig>(
      newMethod: TConfig extends DomainConfig<
        infer DM,
        infer ParseParam,
        infer NewParam,
        any
      >
        ? (
            params: NewParam,
            parse: (input: ParseParam) => ParseResult<DM>,
          ) => ParseResult<DM>
        : never,
    ): (config: TConfig) => TConfig & { newMethod: typeof newMethod };
    ```

  - **Parameters:**

    - `newMethod`: Function that takes input parameters and parse function, returns Effect with domain object

  - **Returns:** Function that overrides the default `new` method with custom creation logic

- `withCommand<TConfig, I>(name: string, handler: CommandHandler<I, Props>)`

  - **Type Signature:**

    TypeScript

    ```typescript
    function withCommand<TConfig extends EntityConfig, I>(
      name: string,
      handler: TConfig extends EntityConfig<infer E, any, any, any, any>
        ? (
            input: I,
            props: E['props'],
            entity: E,
          ) => Effect.Effect<{ props: E['props'] }, any, never>
        : never,
    ): (config: TConfig) => TConfig & {
      commands: TConfig['commands'] & Record<string, CommandFunction<any, I>>;
    };
    ```

  - **Parameters:**

    - `name`: Name of the command method
    - `handler`: Function that takes input and current properties, returns new properties
    - `I`: Type of the command input

  - **Returns:** Function that adds the command to the entity configuration

#### Builders - Entities

- `buildEntity<T, NewParams>(config: EntityConfig<T, NewParams>)`

  - **Type Signature:**

    TypeScript

    ```typescript
    function buildEntity<T extends Entity, NewParams>(
      config: EntityConfig<T, NewParams>,
    ): EntityTrait<T, NewParams, unknown> & Commands & Queries;
    ```

  - **Parameters:**

    - `config`: Complete entity configuration

  - **Returns:** Entity trait with `parse`, `new`, commands, and query methods
  - **Example:**

    ```typescript
    import { pipe, Effect } from 'effect';
    import {
      createEntity,
      withSchema,
      withCommand,
      withQuery,
      buildEntity,
      Entity,
      EntityTrait,
      CommandOnModel,
    } from 'effect-ddd';
    import { Schema } from 'effect';

    type UserProps = { name: string; email: string; isActive: boolean };
    type UserInput = { name: string; email: string };

    // Define Entity type
    export type User = Entity<UserProps>;

    // Define Trait Interface
    type UserQuery<R> = QueryFunction<User, R>;

    export interface IUserTrait
      extends EntityTrait<User, UserInput, UserInput> {
      isActive: UserQuery<boolean>;
      activate: (i: void) => CommandOnModel<User, User>;
    }

    const UserSchema = Schema.Struct({
      name: Schema.String,
      email: Schema.String,
      isActive: Schema.Boolean,
    });

    const activateCommand = (_, props: UserProps) =>
      Effect.succeed({ props: { ...props, isActive: true } });

    const UserTrait: IUserTrait = pipe(
      createEntity<UserProps, UserInput>('User'),
      withSchema(UserSchema),
      withCommand('activate', activateCommand),
      withQuery('isActive', (props) => props.isActive),
      buildEntity,
    );

    // Trait has these methods:
    // - UserTrait.parse(props): Effect<Entity<UserProps>, Error>
    // - UserTrait.new(input): Effect<Entity<UserProps>, Error>
    // - UserTrait.activate(): (user: Entity<UserProps>) => Effect<Entity<UserProps>, Error>
    // - user.isActive(): boolean
    ```

---

### 3. Defining Aggregate Roots

Aggregate Roots are special Entities that form a consistency boundary for a cluster of domain objects. All operations on the objects within the aggregate boundary should go through the Aggregate Root, and it is responsible for emitting domain events.

**Purpose**: Enforce invariants across a group of related domain objects. They are the single point of access for changes within their boundary.

**Steps to Define an Aggregate Root:**

1. **Define Properties (Props Type):** Define the aggregate's properties (`YourARProps`).
2. **Define AggregateRoot Type:** Extend the generic `AggregateRoot` type from `effect-ddd` with your `Props` type.
3. **Define Trait Interface:** Create an interface (`IYourARTrait`) that extends `AggregateRootTrait<YourAR, NewParams, ParseParams>`. This will include custom command methods and event handlers.
4. **Initiate Configuration:** Use `createAggregateRoot<YourARProps, NewParams>(tag: string)`.
5. **Define Structure and Validation:** Use `withSchema` for declarative validation of the aggregate's structure.
6. **Add Aggregate Commands:** Use `withAggregateCommand<I>(name: string, handler: CommandHandler<I, Props, Aggregate, CorrelationId>)`. These commands are unique as their handler can return new `props` and an array of `IDomainEvent`s, which are then published.
7. **Add Event Handlers:** Use `withEventHandler(eventName: string, handler: (event: IDomainEvent) => void)` to define logic that processes specific domain events. These handlers typically trigger side effects outside the aggregate.
8. **Build the Trait:** Call `buildAggregateRoot(config)` to finalize the aggregate root trait.

---

**Complete Example (Order Aggregate Root):**

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createAggregateRoot,
  withSchema,
  withAggregateCommand,
  withEventHandler,
  withQuery,
  buildAggregateRoot,
  AggregateRoot,
  AggregateRootTrait,
  ValidationException,
  DomainEventTrait,
  IDomainEvent,
} from 'effect-ddd';

// Assume OrderItem and calculateTotal are defined elsewhere
type OrderItem = {
  productId: string;
  quantity: number;
  price: number;
  productName: string;
};
const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity * item.price, 0);

// 1. Define Props type
type OrderProps = {
  customerId: string;
  items: OrderItem[];
  status: 'draft' | 'confirmed' | 'shipped';
  total: number;
};

// Define input type for new method
type OrderInput = {
  customerId: string;
  shippingAddress?: string;
};

// Schema definition (example)
const OrderItemSchema = Schema.Struct({
  productId: Schema.String,
  quantity: Schema.Number,
  price: Schema.Number,
  productName: Schema.String,
});

const OrderSchema = Schema.Struct({
  customerId: Schema.String,
  items: Schema.Array(OrderItemSchema),
  status: Schema.Literal('draft', 'confirmed', 'shipped'),
  total: Schema.Number,
});

// 2. Define AggregateRoot type
export type Order = AggregateRoot<OrderProps>;

// 3. Define Trait Interface
type OrderQuery<R> = QueryFunction<Order, R>;

export interface IOrderTrait
  extends AggregateRootTrait<Order, OrderInput, OrderInput> {
  addItem: (i: OrderItem) => CommandOnModel<Order, Order>;
  getItemCount: OrderQuery<number>;
  // Define other commands/queries/event handlers as needed
}

// Handler for 'addItem' command (could be defined separately or inline)
const addItemCommand = (
  item: OrderItem,
  props: OrderProps,
  aggregate: Order,
  correlationId: string,
) =>
  Effect.gen(function* () {
    if (props.status !== 'draft') {
      return yield* Effect.fail(
        ValidationException.new(
          'ORDER_LOCKED',
          'Cannot modify confirmed order',
        ),
      );
    }

    const newItems = [...props.items, item];
    const newTotal = calculateTotal(newItems);

    const event = DomainEventTrait.create({
      name: 'OrderItemAdded',
      payload: { item, newTotal },
      correlationId,
      aggregate, // Pass aggregate to automatically add aggregateId and aggregateType
    });

    return {
      props: { ...props, items: newItems, total: newTotal },
      domainEvents: [event],
    };
  });

// Handler for 'OrderConfirmed' event (could be defined separately or inline)
const orderConfirmedHandler = (event: IDomainEvent) => {
  console.log(
    `Order confirmed: ${event.aggregateId} with payload:`,
    event.payload,
  );
  // Here you would trigger side effects, e.g., send confirmation email, reserve inventory.
};

// 4-8. Define and Build the Order Trait
export const OrderTrait: IOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withAggregateCommand('addItem', addItemCommand),
  withQuery('getItemCount', (props) => props.items.length),
  withEventHandler('OrderConfirmed', orderConfirmedHandler),
  buildAggregateRoot,
);

// Usage Example
/*import { IdentifierTrait } from 'effect-ddd';async function usageExample() {  const initialOrder = await Effect.runPromise(OrderTrait.new({ customerId: 'cust-123', items: [], status: 'draft', total: 0 }));  console.log('Initial order:', initialOrder.unpack());  const newItem: OrderItem = { productId: 'prod-001', quantity: 2, price: 50, productName: 'Laptop' };  const correlationId = IdentifierTrait.uuid();  // Note: withAggregateCommand usage requires passing aggregate and correlationId  const orderWithItem = await Effect.runPromise(    OrderTrait.addItem(newItem)(initialOrder, correlationId)  );  console.log('Order after adding item:', orderWithItem.unpack());  console.log('Domain events:', orderWithItem.getDomainEvents()); // Check generated events}usageExample();*/
```

#### Configuration Creators - Aggregate Roots

- `createAggregateRoot<Props, NewParams>(tag: string)`

  - **Type Signature:**

    ```typescript
    function createAggregateRoot<
      A extends AggregateRoot,
      NewParams = A['props'],
      ParseParams = NewParams,
    >(
      tag: string,
    ): AggregateConfig<
      A,
      ParseParams,
      NewParams,
      Record<string, never>,
      Record<string, never>,
      Record<string, never>
    >;
    ```

  - **Parameters:**

    - `tag` (`string`): Unique identifier for the aggregate type
    - `Props`: TypeScript type representing the aggregate properties
    - `NewParams`: TypeScript type for the input to the `new` method

  - **Returns:** `AggregateConfig` - Configuration object with command, query, and event handler support
  - **Example:**

    ```typescript
    type OrderProps = {
      customerId: string;
      items: OrderItem[];
      status: 'draft' | 'confirmed' | 'shipped';
      total: number;
    };
    type OrderInput = { customerId: string; shippingAddress?: string };
    const OrderConfig = createAggregateRoot<OrderProps, OrderInput>('Order');
    ```

#### Configuration Transformers - Aggregate Root Specific

These functions apply transformations and add behaviors to aggregate root configurations.

- `withAggregateCommand<TConfig, I>(name, handler)`

  - **Type Signature:**

    ```typescript
    function withAggregateCommand<TConfig extends AggregateConfig, I>(
      name: string,
      handler: TConfig extends AggregateConfig<infer A, any, any, any, any, any>
        ? (
            input: I,
            props: A['props'],
            aggregate: A,
            correlationId: string,
          ) => Effect.Effect<
            { props: A['props']; domainEvents: IDomainEvent[] },
            any,
            any
          >
        : never,
    ): (config: TConfig) => TConfig & {
      commands: TConfig['commands'] & Record<string, CommandFunction<any, I>>;
    };
    ```

  - **Parameters:**

    - `name`: Name of the command method
    - `handler`: Function that takes input, props, aggregate, and correlationId, returns new state and events

  - **Returns:** Function that adds the aggregate command to the configuration

- `withEventHandler(eventName: string, handler: (event: IDomainEvent) => void)`

  - **Type Signature:**

    ```typescript
    function withEventHandler<TConfig extends AggregateConfig>(
      eventName: string,
      handler: (event: IDomainEvent) => void,
    ): (config: TConfig) => TConfig & {
      eventHandlers: TConfig['eventHandlers'] &
        Record<string, EventHandlerFunction>;
    };
    ```

  - **Parameters:**

    - `eventName`: Name of the domain event to handle
    - `handler`: Function that processes the domain event

  - **Returns:** Function that adds the event handler to the configuration

#### Builders - Aggregate Roots

- `buildAggregateRoot<T, NewParams>(config: AggregateConfig<T, NewParams>)`

  - **Type Signature:**

    ```typescript
    function buildAggregateRoot<T extends AggregateRoot, NewParams>(
      config: AggregateConfig<T, NewParams>,
    ): AggregateRootTrait<T, NewParams, unknown> &
      Commands &
      Queries &
      EventHandlers;
    ```

  - **Parameters:**

    - `config`: Complete aggregate root configuration

  - **Returns:** Aggregate root trait with all methods and event handlers
  - **Example:**

    ```typescript
    import { pipe } from 'effect';
    import {
      createAggregateRoot,
      withSchema,
      withAggregateCommand,
      withEventHandler,
      buildAggregateRoot,
    } from 'effect-ddd';
    import { Schema } from 'effect';

    // Define Order aggregate types
    type OrderProps = {
      customerId: string;
      items: OrderItem[];
      status: 'draft' | 'confirmed' | 'shipped';
      total: number;
    };

    type OrderInput = {
      customerId: string;
      shippingAddress?: string;
    };

    // Define Order aggregate root type
    export type Order = AggregateRoot<OrderProps>;

    // Define OrderQuery type for query methods
    type OrderQuery<R> = QueryFunction<Order, R>;

    // Define Trait Interface
    export interface IOrderTrait
      extends AggregateRootTrait<Order, OrderInput, OrderInput> {
      addItem: (i: OrderItem) => CommandOnModel<Order>;
      getItemCount: OrderQuery<number>;
      getTotal: OrderQuery<number>;
      confirm: (i: void) => CommandOnModel<Order>;
    }

    // Schema definition
    const OrderSchema = Schema.Struct({
      customerId: Schema.String,
      items: Schema.Array(OrderItemSchema),
      status: Schema.Literal('draft', 'confirmed', 'shipped'),
      total: Schema.Number,
    });

    // Command and event handler implementations
    const addItemCommand = (
      item: OrderItem,
      props: OrderProps,
      aggregate: Order,
      correlationId: string,
    ) =>
      Effect.gen(function* () {
        if (props.status !== 'draft') {
          return yield* Effect.fail(
            ValidationException.new(
              'ORDER_LOCKED',
              'Cannot modify confirmed order',
            ),
          );
        }

        const newItems = [...props.items, item];
        const newTotal = calculateTotal(newItems);

        const event = DomainEventTrait.create({
          name: 'OrderItemAdded',
          payload: { item, newTotal },
          correlationId,
          aggregate,
        });

        return {
          props: { ...props, items: newItems, total: newTotal },
          domainEvents: [event],
        };
      });

    const orderConfirmedHandler = (event: IDomainEvent) => {
      console.log(`Order confirmed: ${event.aggregateId}`);
      // Trigger side effects like sending confirmation email
    };

    // Build the OrderTrait
    export const OrderTrait: IOrderTrait = pipe(
      createAggregateRoot<OrderProps, OrderInput>('Order'),
      withSchema(OrderSchema),
      withAggregateCommand('addItem', addItemCommand),
      withQuery('getItemCount', (props) => props.items.length),
      withQuery('getTotal', (props) => props.total),
      withCommand('confirm', (_, props) =>
        Effect.succeed({
          props: { ...props, status: 'confirmed' },
          domainEvents: [
            /* confirmation event */
          ],
        }),
      ),
      withEventHandler('OrderConfirmed', orderConfirmedHandler),
      buildAggregateRoot,
    );

    // Trait has these methods and properties:
    // - OrderTrait.parse(props): Effect<AggregateRoot<OrderProps>, Error>
    // - OrderTrait.new(input): Effect<AggregateRoot<OrderProps>, Error>
    // - OrderTrait.addItem(item): (order) => Effect<AggregateRoot<OrderProps>, Error>
    // - order.getItemCount(): number
    // - OrderTrait.eventHandlers: { OrderConfirmed: Function }
    ```

---

### General Best Practices for Model Definition

- **Imports**: Always ensure you have the necessary imports from `effect` (like `Effect`, `pipe`, `Schema`) and specific builders/utilities from `effect-ddd`.
- **Immutability**: Effect-DDD promotes immutability. Domain objects are immutable; commands do not modify the original object but return new instances with the updated state.
- **Type Safety**: Leverage TypeScript's type inference and explicitly define types for clarity, especially for `Props` and trait interfaces. This helps ensure your domain logic is type-checked and robust.
- **Composition**: The `pipe` function from `effect` is crucial for composing configuration transformers in a readable and functional manner, creating clear pipelines for model definition.
- **Schema-First (for Validation)**: For most validation scenarios, `withSchema` using Effect Schema is the recommended and most expressive approach, offering powerful declarative validation and automatic inference. `withPropsParser` is reserved for advanced, custom parsing needs where a schema might be too restrictive or external logic is deeply involved.

---

## 🧩 Schema Builder API

The Schema Builder provides composable validation schema creation with functional composition.

### String Schema Functions

#### `stringSchema()`

**Type Signature:**

TypeScript

```
function stringSchema(): StringSchemaState;
```

**Returns:** `StringSchemaState` - Initial string schema configuration

#### `withMinLength(min: number, message?: string)`

**Type Signature:**

```typescript
function withMinLength(
  min: number,
  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

**Parameters:**

- `min`: Minimum required length
- `message`: Optional custom error message

#### `withMaxLength(max: number, message?: string)`

**Type Signature:**

```typescript
function withMaxLength(
  max: number,
  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

#### `withPattern(regex: RegExp, message?: string)`

**Type Signature:**

```typescript
function withPattern(
  regex: RegExp,
  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

#### `withEmail(message?: string)`

**Type Signature:**

TypeScript

```typescript
function withEmail(
  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

#### `withStringBrand<B extends string>(brand: B)`

**Type Signature:**

```typescript
function withStringBrand<B extends string>(
  brand: B,
): (state: StringSchemaState) => Schema.BrandSchema<string, B>;
```

#### `buildStringSchema(state: StringSchemaState)`

**Type Signature:**

TypeScript

```
function buildStringSchema(state: StringSchemaState): Schema.Schema<string>;
```

**Example:**

TypeScript

```typescript
import { pipe } from 'effect';
import {
  stringSchema,
  withNonEmpty,
  withMinLength,
  withMaxLength,
  withPattern,
  withStringBrand,
  buildStringSchema,
} from 'effect-ddd';

const UsernameSchema = pipe(
  stringSchema(),
  withNonEmpty('Username is required'),
  withMinLength(3, 'Username must be at least 3 characters'),
  withMaxLength(20, 'Username cannot exceed 20 characters'),
  withPattern(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores',
  ),
  withStringBrand('Username'),
);
```

### Number Schema Functions

#### `numberSchema()`

**Type Signature:**

TypeScript

```
function numberSchema(): NumberSchemaState;
```

#### `withMin(min: number, message?: string)`

**Type Signature:**

```typescript
function withMin(
  min: number,
  message?: string,
): (state: NumberSchemaState) => NumberSchemaState;
```

#### `withPositive(message?: string)`

**Type Signature:**

```typescript
function withPositive(
  message?: string,
): (state: NumberSchemaState) => NumberSchemaState;
```

#### `withInteger(message?: string)`

**Type Signature:**

```typescript
function withInteger(
  message?: string,
): (state: NumberSchemaState) => NumberSchemaState;
```

**Example:**

TypeScript

```typescript
import { pipe } from 'effect';
import {
  numberSchema,
  withMin,
  withMax,
  withInteger,
  withNumberBrand,
} from 'effect-ddd';

const ScoreSchema = pipe(
  numberSchema(),
  withMin(0, 'Score cannot be negative'),
  withMax(100, 'Score cannot exceed 100'),
  withInteger('Score must be a whole number'),
  withNumberBrand('Score'),
);
```

### Object Schema Functions

#### `objectSchema<T>(fields: T)`

**Type Signature:**

```typescript
function objectSchema<T extends Record<string, Schema.Schema<any>>>(
  fields: T,
): ObjectSchemaState<T>;
```

#### `withCrossFieldValidation<T>(predicate, message, code?)`

**Type Signature:**

```typescript
function withCrossFieldValidation<T>(
  predicate: (obj: Schema.Schema.Type<Schema.Struct<T>>) => boolean,
  message: string,
  code?: string,
): (state: ObjectSchemaState<T>) => ObjectSchemaState<T>;
```

**Example:**

```typescript
import { pipe, Schema } from 'effect';
import {
  objectSchema,
  withCrossFieldValidation,
  buildObjectSchema,
} from 'effect-ddd';

const DateRangeSchema = pipe(
  objectSchema({
    startDate: Schema.Date,
    endDate: Schema.Date,
  }),
  withCrossFieldValidation(
    (obj) => obj.endDate > obj.startDate,
    'End date must be after start date',
    'INVALID_DATE_RANGE',
  ),
  buildObjectSchema,
);
```

### Common Schemas

```typescript
import { pipe, Schema } from 'effect';
import {
  stringSchema,
  numberSchema,
  withEmail,
  buildStringSchema,
  withPhoneNumber,
  withUrl,
  withNonEmpty,
  withMaxLength,
  withPositive,
  withNonNegative,
  withInteger,
  withMin,
  withMax,
} from 'effect-ddd';
import {
  createFutureDateSchema,
  createPastDateSchema,
  createTimestampFields,
  createAuditFields,
} from 'effect-ddd/model/value-object/date'; // Assuming these are utility functions

export const CommonSchemas = {
  // Identity schemas
  UUID: Schema.UUID,
  Email: pipe(stringSchema(), withEmail(), buildStringSchema),
  PhoneNumber: pipe(stringSchema(), withPhoneNumber(), buildStringSchema),
  URL: pipe(stringSchema(), withUrl(), buildStringSchema),

  // String schemas
  NonEmptyString: pipe(stringSchema(), withNonEmpty(), buildStringSchema),
  ShortText: pipe(stringSchema(), withMaxLength(255), buildStringSchema),
  LongText: pipe(stringSchema(), withMaxLength(5000), buildStringSchema),

  // Number schemas
  PositiveNumber: pipe(numberSchema(), withPositive(), buildNumberSchema),
  NonNegativeNumber: pipe(numberSchema(), withNonNegative(), buildNumberSchema),
  PositiveInteger: pipe(
    numberSchema(),
    withPositive(),
    withInteger(),
    buildNumberSchema,
  ),
  Age: pipe(
    numberSchema(),
    withMin(0),
    withMax(150),
    withInteger(),
    buildNumberSchema,
  ),

  // Date schemas
  FutureDate: createFutureDateSchema(),
  PastDate: createPastDateSchema(),

  // Common object patterns
  TimestampFields: createTimestampFields(),
  AuditFields: createAuditFields(),
} as const;
```

---

## 🗃️ Repository Factory API

The Repository Factory provides functional composition for creating TypeORM-based repositories with automatic mapping and Effect integration.

### Core Factory Functions

#### `createRepository<DM, OrmEntity, QueryParams>(config: RepositoryConfig<DM, OrmEntity, QueryParams>)`

**Type Signature:**

```typescript
function createRepository<
  DM extends AggregateRoot,
  OrmEntity extends AggregateTypeORMEntityBase,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  config: RepositoryConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `config`: Complete repository configuration with all mappers defined

**Returns:** `Effect<RepositoryPort<DM>, BaseException, DataSource>`

**Example:**

```typescript
import { createRepository } from 'effect-ddd/typeorm';
// Assuming UserEntity and UserTrait are defined elsewhere
declare class UserEntity {}
declare const UserTrait: any;

const userRepository = createRepository({
  entityClass: UserEntity,
  relations: ['profile', 'orders'],
  mappers: {
    toDomain: (entity) => UserTrait.parse(entity),
    toOrm: (domain, existing, repo) =>
      Effect.succeed({ ...existing, ...domain.props, id: domain.id }),
    prepareQuery: (params) => ({ id: params.id }),
  },
});
```

---

#### `createRepositoryWithDefaults<DM, OrmEntity, QueryParams>(partialConfig)`

**Type Signature:**

```typescript
function createRepositoryWithDefaults<
  DM extends AggregateRoot,
  OrmEntity extends AggregateTypeORMEntityBase,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  partialConfig: PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `partialConfig`: Partial configuration with optional mappers

**Returns:** Repository Effect with auto-completed missing mappers

**Example:**

```typescript
import { createRepositoryWithDefaults } from 'effect-ddd/typeorm';
// Assuming ProductEntity and ProductTrait are defined elsewhere
declare class ProductEntity {}
declare const ProductTrait: any;

const productRepository = createRepositoryWithDefaults({
  entityClass: ProductEntity,
  relations: ['category'],
  mappers: {
    toDomain: (entity) => ProductTrait.parse(entity),
    // toOrm and prepareQuery auto-generated
  },
});
```

---

#### `createRepositoryWithConventions<DM, OrmEntity, QueryParams>(config)`

**Type Signature:**

```typescript
function createRepositoryWithConventions<
  DM extends AggregateRoot,
  OrmEntity extends AggregateTypeORMEntityBase,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
  Trait extends AggregateRootTrait<DM, any, any> = AggregateRootTrait<
    DM,
    any,
    any
  >,
>(
  config: ConventionConfig<DM, OrmEntity, QueryParams, Trait>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `config`: Configuration with domain trait for automatic mapping

**Returns:** Repository Effect using convention-based mapping

**Example:**

```typescript
import { createRepositoryWithConventions } from 'effect-ddd/typeorm';
// Assuming OrderEntity and OrderTrait are defined elsewhere
declare class OrderEntity {}
declare const OrderTrait: any;

const orderRepository = createRepositoryWithConventions({
  entityClass: OrderEntity,
  domainTrait: OrderTrait,
  relations: ['items', 'customer'],
  customMappings: {
    prepareQuery: (params) => ({
      customer: { id: params.customerId },
      status: params.status,
    }),
  },
});
```

### Layer Factory Functions

#### `createRepositoryLayer<DM, OrmEntity, QueryParams>(repositoryTag, config)`

**Type Signature:**

```typescript
function createRepositoryLayer<
  DM extends AggregateRoot,
  OrmEntity extends AggregateTypeORMEntityBase,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
  config: RepositoryConfig<DM, OrmEntity, QueryParams>,
): Layer.Layer<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `repositoryTag`: Context tag for the repository
- `config`: Complete repository configuration

**Returns:** Effect Layer for dependency injection

**Example:**

```typescript
import { Context } from 'effect';
import { createRepositoryLayer } from 'effect-ddd/typeorm';
// Assuming RepositoryPort<User>, UserEntity, UserTrait are defined elsewhere
declare interface RepositoryPort<T> {}
declare class UserEntity {}
declare const UserTrait: any;
declare type User = any;

const UserRepositoryTag = Context.Tag<RepositoryPort<User>>();

const UserRepositoryLayer = createRepositoryLayer(UserRepositoryTag, {
  entityClass: UserEntity,
  relations: ['profile'],
  mappers: {
    toDomain: (entity) => UserTrait.parse(entity),
    toOrm: (domain, existing, repo) =>
      Effect.succeed({ ...existing, ...domain.props }),
    prepareQuery: (params) => ({ email: params.email }),
  },
});
```

### Functional Builder Functions

#### `repositoryBuilder<DM, OrmEntity, QueryParams>(entityClass)`

**Type Signature:**

```typescript
function repositoryBuilder<
  DM extends AggregateRoot,
  OrmEntity extends AggregateTypeORMEntityBase,
  QueryParams = any,
>(entityClass: new () => OrmEntity): BuilderState<DM, OrmEntity, QueryParams>;
```

**Parameters:**

- `entityClass`: TypeORM entity class

**Returns:** `BuilderState` for functional composition

#### `withRelations(relations: readonly string[])`

**Type Signature:**

TypeScript

```typescript
function withRelations<DM, OrmEntity, QueryParams>(
  relations: readonly string[],
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

**Parameters:**

- `relations`: Array of relation names to include

#### `withDomainMapper(mapper: (ormEntity: OrmEntity) => Effect<DM, BaseException>)`

**Type Signature:**

```typescript
function withDomainMapper<DM, OrmEntity, QueryParams>(
  mapper: (ormEntity: OrmEntity) => Effect.Effect<DM, BaseException, never>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

#### `withOrmMapper(mapper: (domain: DM, existing?: OrmEntity) => Effect<OrmEntity, BaseException>)`

**Type Signature:**

```typescript
function withOrmMapper<DM, OrmEntity, QueryParams>(
  mapper: (
    domain: DM,
    existing?: OrmEntity,
  ) => Effect.Effect<OrmEntity, BaseException, never>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

#### `withQueryMapper(mapper: (params: QueryParams) => FindOptionsWhere<OrmEntity>)`

**Type Signature:**

```typescript
function withQueryMapper<DM, OrmEntity, QueryParams>(
  mapper: (params: QueryParams) => FindOptionsWhere<OrmEntity>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

#### `build(state: BuilderState)`

**Type Signature:**

```typescript
function build<DM, OrmEntity, QueryParams>(
  state: BuilderState<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

#### `buildLayer(repositoryTag: Context.Tag)`

**Type Signature:**

```typescript
function buildLayer<DM, OrmEntity, QueryParams>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => Layer.Layer<RepositoryPort<DM>, BaseException, DataSource>;
```

**Complete Functional Builder Example:**

```typescript
import { pipe, Effect, Option } from 'effect';
import {
  repositoryBuilder,
  withRelations,
  withDomainMapper,
  withOrmMapper,
  withQueryMapper,
  build,
} from 'effect-ddd/typeorm';

// Domain model types
type Product = {
  id: string;
  props: {
    name: string;
    price: Money;
    category: { id: string };
    createdAt: Date;
    updatedAt?: Option.Option<Date>;
  };
};

type ProductQuery = {
  categoryId?: string;
  status?: string;
  minPrice?: number;
};

// ORM entity class
class ProductEntity {
  id!: string;
  name!: string;
  price!: number;
  currency!: string;
  categoryId!: string;
  createdAt!: Date;
  updatedAt?: Date | null;
}

// Mock implementations
const ProductTrait = {
  parse: (input: any) => Effect.succeed(input as Product),
};

const MoneyTrait = {
  parse: (amount: number) =>
    Effect.succeed({ amount, currency: 'USD' } as Money),
};

const MoreThan = (value: number) => ({ $gt: value });

const productRepository = pipe(
  repositoryBuilder<Product, ProductEntity, ProductQuery>(ProductEntity),
  withRelations(['category', 'reviews', 'variants']),
  withDomainMapper((entity) =>
    Effect.gen(function* () {
      const product = yield* ProductTrait.parse({
        ...entity,
        price: yield* MoneyTrait.parse(entity.price),
      });
      return product;
    }),
  ),
  withOrmMapper((domain, existing) =>
    Effect.succeed({
      ...existing,
      id: domain.id,
      name: domain.props.name,
      price: domain.props.price.amount,
      currency: domain.props.price.currency,
      categoryId: domain.props.category.id,
      createdAt: domain.createdAt,
      updatedAt: Option.getOrNull(domain.updatedAt),
    }),
  ),
  withQueryMapper((params: ProductQuery) => ({
    category: params.categoryId ? { id: params.categoryId } : undefined,
    status: params.status,
    price: params.minPrice ? MoreThan(params.minPrice) : undefined,
  })),
  build,
);
```

### Repository Port Interface

```typescript

interface RepositoryPort<A extends AggregateRoot, QueryParams = any> {
/\*\* _ Save an existing aggregate root and publish domain events _/
save(aggregateRoot: A): Effect.Effect<void, BaseException, never>;

/\*\* _ Add a new aggregate root and publish domain events _/
add(entity: A): Effect.Effect<void, BaseException, never>;

/\*\* _ Save multiple aggregate roots _/
saveMultiple(entities: A[]): Effect.Effect<void, BaseException, never>;

/\*\* _ Find one aggregate root by query parameters _/
findOne(
params: QueryParams,
): Effect.Effect<Option.Option<A>, BaseException, never>;

/\*\* _ Find one aggregate root by query parameters or throw _/
findOneOrThrow(params: QueryParams): Effect.Effect<A, BaseException, never>;

/\*\* _ Find one aggregate root by ID or throw _/
findOneByIdOrThrow(id: Identifier): Effect.Effect<A, BaseException, never>;

/\*\* _ Find many aggregate roots by query parameters _/
findMany(params: QueryParams): Effect.Effect<A[], BaseException, never>;

/\*\* _ Find many aggregate roots with pagination _/
findManyPaginated(
options: FindManyPaginatedParams<QueryParams>,
): Effect.Effect<DataWithPaginationMeta<A[]>, BaseException, never>;

/\*\* _ Delete an aggregate root _/
delete(entity: A): Effect.Effect<void, BaseException, never>;

/\*\* _ Set correlation ID for tracking _/
setCorrelationId?(correlationId: string): this;
}

```

---

## 🏛️ Core Traits API

### ValueObjectGenericTrait

#### `getTag(valueObject): string`

**Type Signature:**

```typescript
function getTag(valueObject: ValueObject): string;
```

#### `unpack<VO extends ValueObject>(valueObject): GetProps<VO>`

**Type Signature:**

```typescript
function unpack<VO extends ValueObject>(valueObject: VO): GetProps<VO>;
```

#### `isEqual<VO extends ValueObject>(vo1, vo2): boolean`

**Type Signature:**

TypeScript

```typescript
function isEqual<VO extends ValueObject>(vo1: VO, vo2: VO): boolean;
```

#### `createValueObjectTrait<VO, N, P>(propsParser, tag): ValueObjectTrait<VO, N, P>`

**Type Signature:**

TypeScript

```typescript
function createValueObjectTrait<
  VO extends ValueObject,
  N = unknown,
  P = unknown,
>(
  propsParser: (raw: P) => ParseResult<VO['props']>,
  tag: string,
): ValueObjectTrait<VO, N, P>;
```

### EntityGenericTrait

#### `getId<E extends Entity>(entity): Identifier`

**Type Signature:**

```typescript
function getId<E extends Entity>(entity: E): Identifier;
```

#### `getCreatedAt<E extends Entity>(entity): Date`

**Type Signature:**

```typescript
function getCreatedAt<E extends Entity>(entity: E): Date;
```

#### `getUpdatedAt<E extends Entity>(entity): Option<Date>`

**Type Signature:**

```typescript
function getUpdatedAt<E extends Entity>(entity: E): Option.Option<Date>;
```

#### `markUpdated<E extends Entity>(entity): E`

**Type Signature:**

```typescript
function markUpdated<E extends Entity>(entity: E): E;
```

#### `asCommand<E, I>(reducerLogic): (input: I) => CommandOnModel<E>`

**Type Signature:**

```typescript
function asCommand<E extends Entity, I>(
  reducerLogic: (
    input: I,
    props: GetProps<E>,
    entity: E,
  ) => Effect.Effect<{ props: GetProps<E> }, CoreException, never>,
): (input: I) => CommandOnModel<E>;
```

### AggGenericTrait

#### `getDomainEvents<A extends AggregateRoot>(aggregate): ReadonlyArray<IDomainEvent>`

**Type Signature:**

TypeScript

```typescript
function getDomainEvents<A extends AggregateRoot>(
  aggregate: A,
): ReadonlyArray<IDomainEvent>;
```

#### `clearEvents<A extends AggregateRoot>(aggregate): A`

**Type Signature:**

TypeScript

```typescript
function clearEvents<A extends AggregateRoot>(aggregate: A): A;
```

#### `addDomainEvent<A extends AggregateRoot>(event): (aggregate: A) => A`

**Type Signature:**

```typescript
function addDomainEvent<A extends AggregateRoot>(
  event: IDomainEvent,
): (aggregate: A) => A;
```

#### `asCommand<A, I>(reducerLogic): (input: I) => CommandOnModel<A>`

**Type Signature:**

TypeScript

```typescript
function asCommand<A extends AggregateRoot, I>(
  reducerLogic: (
    input: I,
    props: GetProps<A>,
    aggregate: A,
    correlationId: string,
  ) => Effect.Effect<
    { props: GetProps<A>; domainEvents: IDomainEvent[] },
    CoreException,
    never
  >,
): (input: I) => CommandOnModel<A>;
```

---

## 📢 Domain Events API

### DomainEventTrait

#### `create<P, A extends AggregateRoot>(params): IDomainEvent<P>`

**Type Signature:**

```typescript
function create<P, A extends AggregateRoot>(params: {
  name: string;
  payload: P;
  correlationId: string;
  causationId?: string;
  userId?: string;
  aggregate?: A;
}): IDomainEvent<P>;
```

**Parameters:**

- `name`: Event name (string identifier)
- `payload`: Event payload data
- `correlationId`: UUID for correlation tracking
- `causationId`: Optional causation identifier
- `userId`: Optional user identifier
- `aggregate`: Optional aggregate root (adds aggregateId and aggregateType)

**Returns:** `IDomainEvent<P>` - Domain event instance

**Example:**

```typescript
import { DomainEventTrait, IdentifierTrait } from 'effect-ddd';
// Assuming orderAggregate is defined elsewhere
declare const orderAggregate: any;

const orderPlacedEvent = DomainEventTrait.create({
  name: 'ORDER_PLACED',
  payload: {
    orderId: '123',
    customerId: 'customer-456',
    totalAmount: 299.99,
  },
  correlationId: IdentifierTrait.uuid(),
  causationId: 'command-123',
  userId: 'user-789',
  aggregate: orderAggregate,
});
```

### Domain Event Publisher

#### `IDomainEventPublisher.publish(event): Effect<void, BaseException>`

**Type Signature:**

TypeScript

```typescript
interface IDomainEventPublisher {
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, never>;
  publishAll(
    events: ReadonlyArray<IDomainEvent>,
  ): Effect.Effect<void, BaseException, never>;
}
```

**Example:**

TypeScript

```typescript
import { Effect, Context } from 'effect';
import { IDomainEventPublisher } from 'effect-ddd/model/event'; // Assuming this import path
// Assuming DomainEventPublisherContext, orderPlacedEvent, event1, event2, event3 are defined elsewhere
declare const DomainEventPublisherContext: Context.Tag<IDomainEventPublisher>;
declare const orderPlacedEvent: any;
declare const event1: any;
declare const event2: any;
declare const event3: any;

const publishEvent = Effect.gen(function* () {
  const publisher = yield* DomainEventPublisherContext;

  yield* publisher.publish(orderPlacedEvent);
  yield* publisher.publishAll([event1, event2, event3]);
});
```

---

## ✅ Validation & Exceptions API

### Base Exception Structure

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

### Exception Types

#### `ValidationException`

**Type Signature:**

```typescript
class ValidationException extends Data.TaggedError('ValidationFail')<
  BaseExceptionProps<{
    loc?: string[];
    instruction?: string[];
    details?: string[];
    parseError?: any;
    violations?: Array<{
      rule: string;
      code: string;
      message: string;
    }>;
  }>
>
```

**Factory Methods:**
```typescript
static new(
  code: string,
  message: string,
  content?: ValidationException['content'],
): ValidationException

static withViolations(
  violations: Array<{
    rule: string;
    code: string;
    message: string;
  }>,
): ValidationException

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
  }
]);

// From parse error
const parseError = new ParseError('Failed to parse');
const parseException = ValidationException.fromParseError(parseError);
```

#### `NotFoundException`

**Type Signature:**
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

#### `OperationException`

**Type Signature:**
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

### Common Exception Factory

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

### Base Exception Type

All exceptions can be referenced via the `BaseException` type:

```typescript
type BaseException =
  | CommonException
  | OperationException
  | ValidationException
  | NotFoundException
  | ParseError;
```

---

## 🔧 Utilities & Type Classes

### Identifier Utilities

#### `IdentifierTrait`

**Type Signature:**

```typescript
interface IidentifierTrait {
  parse: typeof parseId;
  new: typeof parseId;
  uuid(): Identifier;
}

const IdentifierTrait: IidentifierTrait;
```

**Example:**

```typescript

import { IdentifierTrait } from 'effect-ddd';

const id = IdentifierTrait.uuid(); // Generate new UUID
const parsedId = yield \* IdentifierTrait.parse('existing-uuid');

```

### Type Classes

#### `HasProps<T>`

**Type Signature:**

```typescript
type HasProps<T> = {
  readonly props: T;
};

type GetProps<T extends HasProps<unknown>> = T['props'];

function getRawProps<A extends HasProps<unknown>>(a: A): GetProps<A>;
function queryOnProps<A extends HasProps<any>, R>(
  key: keyof GetProps<A>,
): (a: A) => R;
```

#### `ObjectWithId`

**Type Signature:**

```typescript
type ObjectWithId = {
  readonly id: Identifier;
};
```

#### `WithTime`

**Type Signature:**

```typescript
type WithTime = {
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
};
```

### Application Layer

#### `Command<T>`

**Type Signature:**

```typescript

type Command<T> = HasProps<T> & {
readonly lifecycle: LifeCycleMeta;
};

const CommandTrait = {
factory<Cmd extends Command<unknown>>(params: {
lifecycle: Option.Option<LifeCycleMeta>;
props: GetProps<Cmd>;
}): Cmd;

queryProps: typeof queryOnProps;
getProps: typeof getRawProps;
correlationId<T>(command: T): string; // Corrected to T, assuming T is Command<unknown>
};

```

#### `Query<T>`

**Type Signature:**

```typescript

type Query<T> = {
readonly props: T;
};

const QueryTrait = {
factory<Q extends Query<unknown>>(props: GetProps<Q>): Q;
queryProps: typeof queryOnProps;
};

```

#### `CommandHandler<Cmd, Res>` & `QueryHandler<Q, Res>`

**Type Signature:**

```typescript
type CommandHandler<Cmd extends Command<unknown>, Res> = (
  command: Cmd,
) => Effect.Effect<Res, BaseException>;

type QueryHandler<Q extends Query<unknown>, Res> = (
  query: Q,
) => Effect.Effect<Res, BaseException>;
```

### Functional Programming Utilities

#### `randomItem<T>(items: T[]): T`

**Type Signature:**

```typescript
function randomItem<T>(items: T[]): T;
```

**Parameters:**

- `items`: Array of items to choose from

**Returns:** Randomly selected item from the array

#### `toSnakeCase(str: string): string`

**Type Signature:**

```typescript
function toSnakeCase(str: string): string;
```

**Parameters:**

- `str`: String to convert

**Returns:** String converted to snake_case

#### `now(): Date`

**Type Signature:**

```typescript
function now(): Date;
```

**Returns:** Current date and time

This comprehensive API reference provides detailed information about all the major components and utilities in the effect-ddd library, including complete type signatures, parameter descriptions, and practical examples for each function and interface.

---

## 🌐 NestJS Integration - DTO Layer

The NestJS DTO layer provides standardized response structures, Swagger decorators, and utility functions for building consistent HTTP APIs with automatic OpenAPI documentation.

### Response DTOs

These DTOs provide consistent response structures for all API endpoints with built-in Swagger documentation support.

#### `NormalResponseDto<T>`

Wraps single-item responses with a message field.

**Type Signature:**
```typescript
class NormalResponseDto<T> {
  data: T;
  message: string;
}
```

**Properties:**
- `data`: The response payload of type `T`
- `message`: Status or success message (e.g., "Success", "User created")

#### `PaginationResponseDto<T>`

Wraps paginated list responses with metadata.

**Type Signature:**
```typescript
class PaginationResponseDto<T> {
  message: string;
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

**Properties:**
- `message`: Status message
- `data`: Array of items of type `T`
- `total`: Total number of items across all pages
- `page`: Current page number (1-indexed)
- `limit`: Items per page

#### `PaginationMetaDto`

Standalone metadata for pagination (useful when separating data and metadata).

**Type Signature:**
```typescript
class PaginationMetaDto {
  total: number;
  page: number;
  limit: number;
}
```

### Swagger Decorators

These decorators automatically generate OpenAPI documentation for your NestJS endpoints.

#### `ApiOkResponseNormal<DataDto>(dataDto, isArray?, isOptional?)`

Decorator for normal responses with automatic Swagger schema generation.

**Type Signature:**
```typescript
function ApiOkResponseNormal<DataDto extends Type<unknown>>(
  dataDto: DataDto,
  isArray?: boolean,
  isOptional?: boolean,
): MethodDecorator
```

**Parameters:**
- `dataDto`: The DTO class for the `data` property
- `isArray`: Whether `data` is an array (default: `false`)
- `isOptional`: Whether `data` can be `null` (default: `false`)

**Returns:** NestJS method decorator with OpenAPI metadata

#### `ApiOkResponsePaginated<DataDto>(dataDto)`

Decorator for paginated responses with automatic Swagger schema generation.

**Type Signature:**
```typescript
function ApiOkResponsePaginated<DataDto extends Type<unknown>>(
  dataDto: DataDto,
): MethodDecorator
```

**Parameters:**
- `dataDto`: The DTO class for items in the `data` array

**Returns:** NestJS method decorator with OpenAPI metadata

### Utility Functions

Helper functions to create response objects following the standard structure.

#### `toNormalResponse(message?)`

Creates a normal response wrapper function.

**Type Signature:**
```typescript
function toNormalResponse(
  message?: string
): <T>(data: T) => NormalResponseDto<T>
```

**Parameters:**
- `message`: Success message (default: `"Success"`)

**Returns:** Function that wraps data into `NormalResponseDto`

**Usage Pattern:**
```typescript
const wrapSuccess = toNormalResponse("Operation completed");
return wrapSuccess(userData); // { data: userData, message: "Operation completed" }
```

#### `toPaginationResponse<T>(data, total, page, limit, message?)`

Creates a paginated response object.

**Type Signature:**
```typescript
function toPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string,
): PaginationResponseDto<T>
```

**Parameters:**
- `data`: Array of items for current page
- `total`: Total number of items across all pages
- `page`: Current page number
- `limit`: Items per page
- `message`: Success message (default: `"Success"`)

**Returns:** Complete `PaginationResponseDto` object

---

### Complete Usage Examples

#### Example 1: Simple CRUD Controller

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiOkResponseNormal,
  toNormalResponse,
} from 'effect-ddd/infra/nestjs/dto';

// Your domain/DTO types
class UserDto {
  id: string;
  name: string;
  email: string;
}

class CreateUserDto {
  name: string;
  email: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @ApiOkResponseNormal(UserDto) // Automatic Swagger documentation
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);

    // Use utility to wrap response
    return toNormalResponse('User retrieved successfully')(user);
    // Returns: { data: user, message: "User retrieved successfully" }
  }

  @Post()
  @ApiOkResponseNormal(UserDto)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);

    return toNormalResponse('User created successfully')(user);
    // Returns: { data: user, message: "User created successfully" }
  }
}
```

#### Example 2: Paginated List Endpoint

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiOkResponsePaginated,
  toPaginationResponse,
} from 'effect-ddd/infra/nestjs/dto';

class ProductDto {
  id: string;
  name: string;
  price: number;
  category: string;
}

class ListProductsQueryDto {
  page?: number = 1;
  limit?: number = 10;
  category?: string;
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOkResponsePaginated(ProductDto) // Automatic Swagger for pagination
  async findAll(@Query() query: ListProductsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;

    // Service returns { items, total }
    const { items, total } = await this.productsService.findAll({
      page,
      limit,
      category: query.category,
    });

    // Use utility to create paginated response
    return toPaginationResponse(
      items,
      total,
      page,
      limit,
      'Products retrieved successfully',
    );
    /* Returns:
    {
      message: "Products retrieved successfully",
      data: [...products],
      total: 150,
      page: 1,
      limit: 10
    }
    */
  }
}
```

#### Example 3: Optional and Array Responses

```typescript
import { Controller, Get, Delete, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiOkResponseNormal,
  toNormalResponse,
} from 'effect-ddd/infra/nestjs/dto';

class TagDto {
  id: string;
  name: string;
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // Response with array of items
  @Get(':id/tags')
  @ApiOkResponseNormal(TagDto, true) // isArray = true
  async getTags(@Param('id') id: string) {
    const tags = await this.postsService.getTags(id);

    return toNormalResponse('Tags retrieved')(tags);
    // Returns: { data: [...tags], message: "Tags retrieved" }
  }

  // Response with optional data (might be null)
  @Get(':id/featured-image')
  @ApiOkResponseNormal(ImageDto, false, true) // isOptional = true
  async getFeaturedImage(@Param('id') id: string) {
    const image = await this.postsService.getFeaturedImage(id);

    return toNormalResponse('Image retrieved')(image); // image might be null
    // Returns: { data: image | null, message: "Image retrieved" }
  }

  // Void response (no data)
  @Delete(':id')
  @ApiOkResponseNormal(Object, false, true) // Allow null data
  async delete(@Param('id') id: string) {
    await this.postsService.delete(id);

    return { data: null, message: 'Post deleted successfully' };
  }
}
```

#### Example 4: Effect Integration Pattern

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { Effect, pipe } from 'effect';
import {
  ApiOkResponseNormal,
  toNormalResponse,
} from 'effect-ddd/infra/nestjs/dto';
import { BaseException } from 'effect-ddd';

class OrderDto {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: string;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @ApiOkResponseNormal(OrderDto)
  async findOne(@Param('id') id: string) {
    // Service returns Effect<Order, BaseException>
    const orderEffect = this.ordersService.findOne(id);

    // Transform Effect to include response wrapper
    const responseEffect = pipe(
      orderEffect,
      Effect.map(toNormalResponse('Order retrieved')),
    );

    // Execute Effect and return result
    return Effect.runPromise(responseEffect);
    // Returns: { data: order, message: "Order retrieved" }
  }

  @Get()
  @ApiOkResponsePaginated(OrderDto)
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    // Service returns Effect<{ items, total }, BaseException>
    const ordersEffect = this.ordersService.findAll({ page, limit });

    const responseEffect = pipe(
      ordersEffect,
      Effect.map(({ items, total }) =>
        toPaginationResponse(items, total, page, limit, 'Orders retrieved'),
      ),
    );

    return Effect.runPromise(responseEffect);
  }
}
```

### Best Practices

1. **Consistency**: Always use these DTOs for API responses to maintain a consistent structure across your application.

2. **Swagger Documentation**: Apply `@ApiOkResponseNormal` or `@ApiOkResponsePaginated` decorators to all endpoints for automatic OpenAPI documentation.

3. **Error Handling**: These DTOs are for successful responses. Use NestJS exception filters for error responses.

4. **Message Quality**: Provide meaningful messages that describe the operation result:
   ```typescript
   // Good
   toNormalResponse('User profile updated successfully')(user)

   // Bad (too generic)
   toNormalResponse('Success')(user)
   ```

5. **Pagination Metadata**: Always include accurate `total`, `page`, and `limit` values for pagination responses.

6. **Type Safety**: Let TypeScript infer the generic type `T` from your data:
   ```typescript
   const user: User = { ... };
   toNormalResponse()(user) // Type is NormalResponseDto<User>
   ```

---

## 🗄️ NestJS Integration - TypeORM Infrastructure

The TypeORM infrastructure layer provides transaction management, repository patterns, and seamless integration between Effect-based domain repositories and NestJS application handlers using the **Unit of Work pattern** with **CLS (Continuation Local Storage)**.

### Overview

This module enables:

- ✅ **Transaction-aware repositories** that automatically participate in active transactions
- ✅ **Unit of Work pattern** for explicit transaction boundary control
- ✅ **@Transactional decorator** for automatic transaction management in handlers
- ✅ **Effect integration** for functional composition with domain repositories
- ✅ **CLS-based context** for request-scoped transactions without explicit parameter passing
- ✅ **Zero configuration** - Effect repositories automatically detect and use transactional contexts

### Key Components

#### 1. BaseRepository

Transaction-aware base repository that automatically uses the correct EntityManager from CLS context.

**Type Signature:**
```typescript
class TypeOrmBaseRepository<T extends ObjectLiteral> {
  constructor(dataSource: DataSource, entity: new () => T);

  getEntityManager(): EntityManager;
  getRepository(): Repository<T>;

  // All standard TypeORM repository methods
  create(entityLike: DeepPartial<T>): T;
  save<A>(entity: A, options?: SaveOptions): Promise<A & T>;
  find(options?: FindManyOptions<T>): Promise<T[]>;
  findOne(options: FindOneOptions<T>): Promise<T | null>;
  // ... and more
}
```

#### 2. UnitOfWork Service

Injectable service for managing transactional boundaries using Effect-based return types.

**Type Signature:**
```typescript
import { Effect } from 'effect';
import { OperationException, BaseException } from 'effect-ddd';

@Injectable()
class UnitOfWork {
  begin(): Effect.Effect<EntityManager, OperationException>;
  commit(): Effect.Effect<void, BaseException>;
  rollback(): Effect.Effect<void, OperationException>;
  isActive(): boolean;
  execute<T>(
    work: (entityManager: EntityManager) => Effect.Effect<T, BaseException>,
    options?: { autoCommit?: boolean }
  ): Effect.Effect<T, BaseException>;
}
```

**Note**: All methods return `Effect` types. When calling directly (outside `@Transactional`), use `Effect.runPromise()`:
```typescript
await Effect.runPromise(this.unitOfWork.commit());
```

#### 3. @Transactional Decorator

Method decorator for automatic transaction management in NestJS handlers.

**Type Signature:**
```typescript
function Transactional(
  options?: {
    autoCommit?: boolean;
    unitOfWorkProperty?: string;
  }
): MethodDecorator
```

**Parameters:**
- `autoCommit`: Auto-commit on success (default: `true`)
- `unitOfWorkProperty`: Property name for injected UnitOfWork (default: `'unitOfWork'`)

### Quick Start

#### 1. Setup CLS Middleware

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ClsMiddleware } from 'effect-ddd/nestjs';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
```

#### 2. Register UnitOfWork

**Important**: `UnitOfWork` requires `DataSource` injection, so TypeORM must be configured first.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitOfWork } from 'effect-ddd/nestjs';

@Module({
  imports: [
    // TypeORM provides DataSource for dependency injection
    TypeOrmModule.forRoot({
      type: 'postgres',
      // ... your database config
    }),
    // Or in a feature module:
    // TypeOrmModule.forFeature([YourEntity]),
  ],
  providers: [
    UnitOfWork,  // NestJS auto-injects DataSource
  ],
})
export class MyModule {}
```

**Alternative 1**: If you use a custom `dataSourceFactory`:

When using `TypeOrmModule.forRootAsync()` with a custom `dataSourceFactory`, the `DataSource` is not automatically exposed. You need to provide it manually:

```typescript
import { DataSource, getDataSourceToken } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options) => {
        return new DataSource(options).initialize();
      },
    }),
  ],
  providers: [
    // Expose DataSource from TypeORM's internal token
    {
      provide: DataSource,
      useFactory: (dataSource: DataSource) => dataSource,
      inject: [getDataSourceToken()],  // Get from TypeORM's token
    },
    UnitOfWork,  // Will now receive DataSource via DI
  ],
})
export class MyModule {}
```

**Alternative 2**: Manual UnitOfWork provider:

```typescript
import { DataSource } from 'typeorm';

@Module({
  providers: [
    {
      provide: UnitOfWork,
      useFactory: (dataSource: DataSource) => new UnitOfWork(dataSource),
      inject: [DataSource],
    },
  ],
})
export class MyModule {}
```

#### 3. Use @Transactional Decorator

```typescript
import { Injectable } from '@nestjs/common';
import { Transactional, UnitOfWork } from 'effect-ddd/nestjs';

@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,  // Injected by NestJS
    private readonly userRepo: UserRepository,
  ) {}

  @Transactional()
  async execute(command: CreateUserCommand): Promise<User> {
    // All repository operations here are transactional
    const user = await this.userRepo.save(newUser);
    return user;
    // Auto-committed on success, auto-rolled back on error
  }
}
```

### Usage Patterns

#### Pattern 1: Decorator with Auto-Commit (Recommended)

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()
  async createOrder(data: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(newOrder);
    await this.inventoryRepo.reserve(order.items);
    return order; // Auto-committed
  }
}
```

#### Pattern 2: Manual Commit Control

```typescript
import { Effect } from 'effect';

@Injectable()
export class ComplexService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional({ autoCommit: false })
  async complexOperation(data: ComplexData): Promise<void> {
    await this.doStep1();
    await this.doStep2();

    // Commit at specific point (Effect-based)
    await Effect.runPromise(this.unitOfWork.commit());

    // Non-transactional operations after commit
    await this.sendEmail();
  }
}
```

#### Pattern 3: Effect Integration

Effect repositories automatically work with UnitOfWork:

```typescript
import { pipe, Effect } from 'effect';
import { withUnitOfWork } from 'effect-ddd/nestjs';

const createUser = (data: UserData) =>
  pipe(
    Effect.gen(function* () {
      const repo = yield* UserRepositoryContext;
      const user = yield* User.create(data);
      yield* repo.save(user); // Uses transactional EntityManager!
      return user;
    }),
    withUnitOfWork({ autoCommit: true })
  );
```

#### Pattern 4: Programmatic UnitOfWork

```typescript
import { Effect } from 'effect';

async doWork(): Promise<void> {
  // execute() returns Effect, wrap with Effect.runPromise
  await Effect.runPromise(
    this.unitOfWork.execute((entityManager) => {
      const repo = entityManager.getRepository(UserEntity);
      return Effect.promise(() => repo.save(user));
      // Auto-committed on success
    })
  );
}
```

### How It Works

The infrastructure uses CLS (Continuation Local Storage) to share the transactional `EntityManager` across the request context:

```
┌─────────────────────────────────────────────────────────┐
│              @Transactional Decorator                   │
│          or UnitOfWork.begin() called                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              UnitOfWork Service                         │
│  • Creates QueryRunner & EntityManager                  │
│  • Injects into CLS namespace                          │
│  • Key: 'ENTITY_MANAGER' → EntityManager               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         CLS Namespace (per-request storage)             │
│         Stores: EntityManager, UnitOfWorkContext        │
└─────────────┬────────────────────────┬──────────────────┘
              │                        │
              ▼                        ▼
    ┌──────────────────┐    ┌──────────────────────┐
    │  BaseRepository  │    │  Effect Repository   │
    │  (NestJS)        │    │  (Domain)            │
    │                  │    │                      │
    │  Reads from CLS  │    │  Reads from CLS      │
    │  Uses same EM    │    │  Uses same EM        │
    └──────────────────┘    └──────────────────────┘
```

**Key Points:**
- Both Promise-based and Effect-based repositories read from the same CLS context
- No configuration needed - repositories automatically detect and use transactional context
- Falls back to default DataSource.manager when not in a transaction

### Effect Repository Integration

Effect repositories from `src/ports/database/typeorm/effect-repository.factory.ts` automatically participate in transactions:

```typescript
// Domain Layer - Define Effect repository
const userRepository = createTypeormRepository({
  dataSource,
  entityClass: UserEntity,
  relations: ['profile'],
  toDomain: (entity) => UserTrait.parse(entity),
  toOrm: (domain, existing, repo) => Effect.succeed({ ...domain }),
  prepareQuery: (params) => ({ id: params.id }),
});

// Application Layer - Use with @Transactional
@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,  // Injected by NestJS
    private readonly dataSource: DataSource,   // Injected by NestJS
  ) {}

  @Transactional()
  async execute(command: CreateUserCommand): Promise<User> {
    // Effect repository uses transactional EntityManager from CLS
    const program = pipe(
      userRepository,
      Effect.flatMap((repo) => {
        const user = User.create(command);
        return repo.save(user); // Transactional!
      })
    );

    return Effect.runPromise(program);
  }
}
```

### Utilities

#### getCurrentEntityManager()

Get the current transactional EntityManager from CLS context.

```typescript
import { getCurrentEntityManager } from 'effect-ddd/nestjs';

const em = getCurrentEntityManager();
if (em) {
  // Use transactional EntityManager
}
```

#### isInTransaction()

Check if currently executing within a transactional context.

```typescript
import { isInTransaction } from 'effect-ddd/nestjs';

if (isInTransaction()) {
  console.log('Running in transaction');
}
```

#### requireEntityManager()

Get EntityManager or throw error if not in transactional context.

```typescript
import { requireEntityManager } from 'effect-ddd/nestjs';

const em = requireEntityManager(); // Throws if not in transaction
```

### Best Practices

1. **Use @Transactional for handlers**: Apply decorator at the usecase handler level for clear transaction boundaries

2. **Keep transactions short**: Only include database operations, avoid slow external API calls

3. **One transaction per request**: Avoid nested transactions - use a single `@Transactional` per handler

4. **Effect integration**: Effect repositories automatically work - no special configuration needed

5. **Manual commit when needed**: Use `autoCommit: false` when you need to commit at a specific point

6. **Error handling**: Let the decorator handle rollbacks - avoid catching and swallowing errors

### Detailed Documentation

For comprehensive guides, examples, and advanced patterns, see:

- **[TypeORM Infrastructure Guide](../docs/typeorm/README.md)** - Complete setup, usage patterns, API reference, troubleshooting
- **[Effect Integration Guide](../docs/typeorm/EFFECT_INTEGRATION.md)** - How Effect repositories integrate with UnitOfWork, functional patterns, complete examples
- **[Concurrency and Isolation Deep Dive](../docs/typeorm/CONCURRENCY_AND_ISOLATION.md)** - How CLS provides isolation for concurrent requests, singleton safety, transaction sharing patterns

---

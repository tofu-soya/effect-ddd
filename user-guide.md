# Effect DDD - Comprehensive API ReferencF

Complete API documentation for the functional domain modeling library with detailed function signatures, examples, and advanced patterns.

## 📋 Table of Contents

1. [🔨 Domain Builder API](#-domain-builder-api)
2. [🧩 Schema Builder API](#-schema-builder-api)
3. [🗃️ Repository Factory API](#%EF%B8%8F-repository-factory-api)
4. [🏛️ Core Traits API](#%EF%B8%8F-core-traits-api)
5. [📢 Domain Events API](#-domain-events-api)
6. [✅ Validation & Exceptions API](#-validation--exceptions-api)
7. [🔧 Utilities & Type Classes](#-utilities--type-classes)

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
   - **`withSchema(schema: Schema.Schema<S>)` (Recommended for declarative validation):** Apply an Effect Schema that defines the structure and validation rules for your props. This is the primary way for robust validation and automatic TypeScript inference. Setting `withSchema` clears any existing `propsParser` to avoid conflicts. Schema validation runs before custom validators.
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
    ): DomainConfig<
      VO,
      ParseParams,
      NewParams,
      Record<string, never>
    >;
    ```

  - **Parameters:**

    - `tag` (`string`): Unique identifier for the value object type
    - `Props`: TypeScript type representing the value object properties
    - `NewParams`: TypeScript type for the input to the `new` method (defaults to `Props`)

  - **Returns:** `DomainConfig` - Configuration object for further composition
  - **Example:**

    ```typescript
    import { createValueObject } from 'effect-ddd';

    // Simple value object where new() takes same input as props
    const SimpleConfig = createValueObject<{ value: string }>('Simple');

    // Value object where new() takes different input type
    const EmailConfig = createValueObject<{ value: string }, string>('Email');
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
  activate: (i: void) => CommandOnModel<User, User>;
  updateEmail: (i: string) => CommandOnModel<User, User>;
  updateProfile: (i: { name?: string; email?: string }) => CommandOnModel<User, User>;
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

    TypeScript

    ```
    function createEntity<
      E extends Entity,
      NewParams = E['props'],
      ParseParams = NewParams,
    >(
      tag: string,
    ): EntityConfig<E, ParseParams, NewParams, Record<string, never>, Record<string, never>>;
    ```

  - **Parameters:**

    - `tag` (`string`): Unique identifier for the entity type
    - `Props`: TypeScript type representing the entity properties (excluding `id`, `createdAt`, `updatedAt`)
    - `NewParams`: TypeScript type for the input to the `new` method

  - **Returns:** `EntityConfig` - Configuration object that extends `DomainConfig` with command support
  - **Example:**

    TypeScript

    ```
    type UserProps = { name: string; email: string; isActive: boolean; };
    type UserInput = { name: string; email: string; };
    const UserConfig = createEntity<UserProps, UserInput>('User');
    ```

#### Configuration Transformers - Entity Specific

These functions apply transformations and add behaviors to entity configurations.

- `withValidation<TConfig>(validator: (props: Props) => ParseResult<Props>)`

  - **Type Signature:**

    TypeScript

    ```
    function withValidation<TConfig extends AnyDomainConfig>(
      validator: TConfig extends DomainConfig<infer DM, any, any, any>    ? (props: DM['props']) => ParseResult<DM['props']>    : never,
    ): (config: TConfig) => TConfig;
    ```

  - **Parameters:**

    - `validator`: Function that takes validated properties and returns Effect with additional validation

  - **Returns:** Function that adds the validator to the configuration's validation chain
  - **Notes:** Validators run in the order they are added. Each validator receives the output of the previous validator. Can modify properties or just validate them.

- `withNew<TConfig>(newMethod: (params: NewParam, parse: ParseFunction) => ParseResult<DM>)`

  - **Type Signature:**

    TypeScript

    ```
    function withNew<TConfig extends AnyDomainConfig>(
      newMethod: TConfig extends DomainConfig<    infer DM,    infer ParseParam,    infer NewParam,    any
      >    ? (        params: NewParam,        parse: (input: ParseParam) => ParseResult<DM>,      ) => ParseResult<DM>    : never,
    ): (config: TConfig) => TConfig & { newMethod: typeof newMethod };
    ```

  - **Parameters:**

    - `newMethod`: Function that takes input parameters and parse function, returns Effect with domain object

  - **Returns:** Function that overrides the default `new` method with custom creation logic

- `withCommand<TConfig, I>(name: string, handler: CommandHandler<I, Props>)`

  - **Type Signature:**

    TypeScript

    ```
    function withCommand<TConfig extends EntityConfig, I>(
      name: string,  handler: TConfig extends EntityConfig<infer E, any, any, any, any>    ? (        input: I,        props: E['props'],        entity: E,      ) => Effect.Effect<{ props: E['props'] }, any, never>    : never,
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

    ```
    function buildEntity<T extends Entity, NewParams>(
      config: EntityConfig<T, NewParams>,
    ): EntityTrait<T, NewParams, unknown> & Commands & Queries;
    ```

  - **Parameters:**

    - `config`: Complete entity configuration

  - **Returns:** Entity trait with `parse`, `new`, commands, and query methods
  - **Example:**

    TypeScript

    ```
    import { pipe } from 'effect';
    import { createEntity, withSchema, withCommand, withQuery, buildEntity } from 'effect-ddd';
    import { Schema } from 'effect';

    // Assuming UserProps, UserInput, UserSchema, activateCommand are defined
    type UserProps = { name: string; email: string; isActive: boolean; };
    type UserInput = { name: string; email: string; };
    const UserSchema = Schema.Struct({ name: Schema.String, email: Schema.String, isActive: Schema.Boolean });
    const activateCommand = (_, props: UserProps) => Effect.succeed({ props: { ...props, isActive: true } });

    const UserTrait = pipe(
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

TypeScript

```
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
type OrderItem = { productId: string; quantity: number; price: number; productName: string };
const calculateTotal = (items: OrderItem[]): number => items.reduce((sum, item) => sum + item.quantity * item.price, 0);

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
    productName: Schema.String
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

export interface IOrderTrait extends AggregateRootTrait<Order, OrderInput, OrderInput> {
  addItem: (i: OrderItem) => CommandOnModel<Order, Order>;
  getItemCount: OrderQuery<number>;
  // Define other commands/queries/event handlers as needed
}

// Handler for 'addItem' command (could be defined separately or inline)
const addItemCommand = (
  item: OrderItem,  props: OrderProps,  aggregate: Order,  correlationId: string,
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
    console.log(`Order confirmed: ${event.aggregateId} with payload:`, event.payload);
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

    TypeScript

    ```
    function createAggregateRoot<
      A extends AggregateRoot,
      NewParams = A['props'],
      ParseParams = NewParams,
    >(
      tag: string,
    ): AggregateConfig<A, ParseParams, NewParams, Record<string, never>, Record<string, never>, Record<string, never>>;
    ```

  - **Parameters:**

    - `tag` (`string`): Unique identifier for the aggregate type
    - `Props`: TypeScript type representing the aggregate properties
    - `NewParams`: TypeScript type for the input to the `new` method

  - **Returns:** `AggregateConfig` - Configuration object with command, query, and event handler support
  - **Example:**

    TypeScript

    ```
    type OrderProps = { customerId: string; items: OrderItem[]; status: 'draft' | 'confirmed' | 'shipped'; total: number; };
    type OrderInput = { customerId: string; shippingAddress?: string; };
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

    TypeScript

    ```
    function buildAggregateRoot<T extends AggregateRoot, NewParams>(
      config: AggregateConfig<T, NewParams>,
    ): AggregateRootTrait<T, NewParams, unknown> &  Commands &  Queries &  EventHandlers;
    ```

  - **Parameters:**

    - `config`: Complete aggregate root configuration

  - **Returns:** Aggregate root trait with all methods and event handlers
  - **Example:**

    TypeScript

    ```
    import { pipe } from 'effect';
    import { createAggregateRoot, withSchema, withAggregateCommand, withEventHandler, buildAggregateRoot } from 'effect-ddd';
    import { Schema } from 'effect';

    // Assuming OrderProps, OrderInput, OrderSchema, addItemCommand, orderConfirmedHandler are defined
    type OrderProps = { customerId: string; items: any[]; status: string; total: number; };
    type OrderInput = { customerId: string; shippingAddress?: string; };
    const OrderSchema = Schema.Struct({ customerId: Schema.String, items: Schema.Array(Schema.unknown), status: Schema.String, total: Schema.Number });
    const addItemCommand = () => {}; // Placeholder
    const orderConfirmedHandler = () => {}; // Placeholder

    const OrderTrait = pipe(
      createAggregateRoot<OrderProps, OrderInput>('Order'),
      withSchema(OrderSchema),
      withAggregateCommand('addItem', addItemCommand),
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

TypeScript

```
function withMinLength(
  min: number,  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

**Parameters:**

- `min`: Minimum required length
- `message`: Optional custom error message

#### `withMaxLength(max: number, message?: string)`

**Type Signature:**

TypeScript

```
function withMaxLength(
  max: number,  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

#### `withPattern(regex: RegExp, message?: string)`

**Type Signature:**

TypeScript

```
function withPattern(
  regex: RegExp,  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

#### `withEmail(message?: string)`

**Type Signature:**

TypeScript

```
function withEmail(
  message?: string,
): (state: StringSchemaState) => StringSchemaState;
```

#### `withStringBrand<B extends string>(brand: B)`

**Type Signature:**

TypeScript

```
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

```
import { pipe } from 'effect';
import { stringSchema, withNonEmpty, withMinLength, withMaxLength, withPattern, withStringBrand, buildStringSchema } from 'effect-ddd';

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

TypeScript

```
function withMin(
  min: number,  message?: string,
): (state: NumberSchemaState) => NumberSchemaState;
```

#### `withPositive(message?: string)`

**Type Signature:**

TypeScript

```
function withPositive(
  message?: string,
): (state: NumberSchemaState) => NumberSchemaState;
```

#### `withInteger(message?: string)`

**Type Signature:**

TypeScript

```
function withInteger(
  message?: string,
): (state: NumberSchemaState) => NumberSchemaState;
```

**Example:**

TypeScript

```
import { pipe } from 'effect';
import { numberSchema, withMin, withMax, withInteger, withNumberBrand } from 'effect-ddd';

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

TypeScript

```
function objectSchema<T extends Record<string, Schema.Schema<any>>>(
  fields: T,
): ObjectSchemaState<T>;
```

#### `withCrossFieldValidation<T>(predicate, message, code?)`

**Type Signature:**

TypeScript

```
function withCrossFieldValidation<T>(
  predicate: (obj: Schema.Schema.Type<Schema.Struct<T>>) => boolean,  message: string,  code?: string,
): (state: ObjectSchemaState<T>) => ObjectSchemaState<T>;
```

**Example:**

TypeScript

```
import { pipe, Schema } from 'effect';
import { objectSchema, withCrossFieldValidation, buildObjectSchema } from 'effect-ddd';

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

TypeScript

```
import { pipe, Schema } from 'effect';
import { stringSchema, numberSchema, withEmail, buildStringSchema, withPhoneNumber, withUrl, withNonEmpty, withMaxLength, withPositive, withNonNegative, withInteger, withMin, withMax } from 'effect-ddd';
import { createFutureDateSchema, createPastDateSchema, createTimestampFields, createAuditFields } from 'effect-ddd/model/value-object/date'; // Assuming these are utility functions

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
function createRepository<  DM extends AggregateRoot,  OrmEntity extends AggregateTypeORMEntityBase,  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,>(
  config: RepositoryConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```
```

**Parameters:**

- `config`: Complete repository configuration with all mappers defined

**Returns:** `Effect<RepositoryPort<DM>, BaseException, DataSource>`

**Example:**

TypeScript

```
import { createRepository } from 'effect-ddd/typeorm';
// Assuming UserEntity and UserTrait are defined elsewhere
declare class UserEntity {};
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

TypeScript

```
function createRepositoryWithDefaults<  DM extends AggregateRoot,  OrmEntity extends AggregateTypeORMEntityBase,  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,>(
  partialConfig: PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `partialConfig`: Partial configuration with optional mappers

**Returns:** Repository Effect with auto-completed missing mappers

**Example:**

TypeScript

```
import { createRepositoryWithDefaults } from 'effect-ddd/typeorm';
// Assuming ProductEntity and ProductTrait are defined elsewhere
declare class ProductEntity {};
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

TypeScript

```
function createRepositoryWithConventions<  DM extends AggregateRoot,  OrmEntity extends AggregateTypeORMEntityBase,  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,  Trait extends AggregateRootTrait<DM, any, any> = AggregateRootTrait<    DM,    any,    any
  >,>(
  config: ConventionConfig<DM, OrmEntity, QueryParams, Trait>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `config`: Configuration with domain trait for automatic mapping

**Returns:** Repository Effect using convention-based mapping

**Example:**

TypeScript

```
import { createRepositoryWithConventions } from 'effect-ddd/typeorm';
// Assuming OrderEntity and OrderTrait are defined elsewhere
declare class OrderEntity {};
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

TypeScript

```
function createRepositoryLayer<  DM extends AggregateRoot,  OrmEntity extends AggregateTypeORMEntityBase,  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,  config: RepositoryConfig<DM, OrmEntity, QueryParams>,
): Layer.Layer<RepositoryPort<DM>, BaseException, DataSource>;
```

**Parameters:**

- `repositoryTag`: Context tag for the repository
- `config`: Complete repository configuration

**Returns:** Effect Layer for dependency injection

**Example:**

TypeScript

```
import { Context } from 'effect';
import { createRepositoryLayer } from 'effect-ddd/typeorm';
// Assuming RepositoryPort<User>, UserEntity, UserTrait are defined elsewhere
declare interface RepositoryPort<T> {}
declare class UserEntity {};
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

TypeScript

```
function repositoryBuilder<  DM extends AggregateRoot,  OrmEntity extends AggregateTypeORMEntityBase,  QueryParams = any,>(entityClass: new () => OrmEntity): BuilderState<DM, OrmEntity, QueryParams>;
```

**Parameters:**

- `entityClass`: TypeORM entity class

**Returns:** `BuilderState` for functional composition

#### `withRelations(relations: readonly string[])`

**Type Signature:**

TypeScript

```
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

TypeScript

```
function withDomainMapper<DM, OrmEntity, QueryParams>(
  mapper: (ormEntity: OrmEntity) => Effect.Effect<DM, BaseException, never>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

#### `withOrmMapper(mapper: (domain: DM, existing?: OrmEntity) => Effect<OrmEntity, BaseException>)`

**Type Signature:**

TypeScript

```
function withOrmMapper<DM, OrmEntity, QueryParams>(
  mapper: (    domain: DM,    existing?: OrmEntity,  ) => Effect.Effect<OrmEntity, BaseException, never>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

#### `withQueryMapper(mapper: (params: QueryParams) => FindOptionsWhere<OrmEntity>)`

**Type Signature:**

TypeScript

```
function withQueryMapper<DM, OrmEntity, QueryParams>(
  mapper: (params: QueryParams) => FindOptionsWhere<OrmEntity>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => BuilderState<DM, OrmEntity, QueryParams>;
```

#### `build(state: BuilderState)`

**Type Signature:**

TypeScript

```
function build<DM, OrmEntity, QueryParams>(
  state: BuilderState<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSource>;
```

#### `buildLayer(repositoryTag: Context.Tag)`

**Type Signature:**

TypeScript

```
function buildLayer<DM, OrmEntity, QueryParams>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
): (
  state: BuilderState<DM, OrmEntity, QueryParams>,
) => Layer.Layer<RepositoryPort<DM>, BaseException, DataSource>;
```

**Complete Functional Builder Example:**

TypeScript

```
import { pipe, Effect, Option } from 'effect';
import { repositoryBuilder, withRelations, withDomainMapper, withOrmMapper, withQueryMapper, build } from 'effect-ddd/typeorm';
// Assuming Product, ProductEntity, ProductQuery, ProductTrait, MoneyTrait are defined elsewhere
declare type Product = any;
declare type ProductQuery = { categoryId?: string; status?: string; minPrice?: number };
declare class ProductEntity { id: string; name: string; price: number; currency: string; categoryId: string; createdAt: Date; updatedAt?: Date | null; };
declare const ProductTrait: any;
declare const MoneyTrait: any;
declare const MoreThan: any;

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

TypeScript

```
interface RepositoryPort<A extends AggregateRoot, QueryParams = any> {
  /**   * Save an existing aggregate root and publish domain events   */
  save(aggregateRoot: A): Effect.Effect<void, BaseException, never>;

  /**   * Add a new aggregate root and publish domain events   */
  add(entity: A): Effect.Effect<void, BaseException, never>;

  /**   * Save multiple aggregate roots   */
  saveMultiple(entities: A[]): Effect.Effect<void, BaseException, never>;

  /**   * Find one aggregate root by query parameters   */
  findOne(
    params: QueryParams,
  ): Effect.Effect<Option.Option<A>, BaseException, never>;

  /**   * Find one aggregate root by query parameters or throw   */
  findOneOrThrow(params: QueryParams): Effect.Effect<A, BaseException, never>;

  /**   * Find one aggregate root by ID or throw   */
  findOneByIdOrThrow(id: Identifier): Effect.Effect<A, BaseException, never>;

  /**   * Find many aggregate roots by query parameters   */
  findMany(params: QueryParams): Effect.Effect<A[], BaseException, never>;

  /**   * Find many aggregate roots with pagination   */
  findManyPaginated(
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<A[]>, BaseException, never>;

  /**   * Delete an aggregate root   */
  delete(entity: A): Effect.Effect<void, BaseException, never>;

  /**   * Set correlation ID for tracking   */
  setCorrelationId?(correlationId: string): this;
}
```

---

## 🏛️ Core Traits API

### ValueObjectGenericTrait

#### `getTag(valueObject): string`

**Type Signature:**

TypeScript

```
function getTag(valueObject: ValueObject): string;
```

#### `unpack<VO extends ValueObject>(valueObject): GetProps<VO>`

**Type Signature:**

TypeScript

```
function unpack<VO extends ValueObject>(valueObject: VO): GetProps<VO>;
```

#### `isEqual<VO extends ValueObject>(vo1, vo2): boolean`

**Type Signature:**

TypeScript

```
function isEqual<VO extends ValueObject>(vo1: VO, vo2: VO): boolean;
```

#### `createValueObjectTrait<VO, N, P>(propsParser, tag): ValueObjectTrait<VO, N, P>`

**Type Signature:**

TypeScript

```
function createValueObjectTrait<  VO extends ValueObject,  N = unknown,  P = unknown,>(
  propsParser: (raw: P) => ParseResult<VO['props']>,  tag: string,
): ValueObjectTrait<VO, N, P>;
```

### EntityGenericTrait

#### `getId<E extends Entity>(entity): Identifier`

**Type Signature:**

TypeScript

```
function getId<E extends Entity>(entity: E): Identifier;
```

#### `getCreatedAt<E extends Entity>(entity): Date`

**Type Signature:**

TypeScript

```
function getCreatedAt<E extends Entity>(entity: E): Date;
```

#### `getUpdatedAt<E extends Entity>(entity): Option<Date>`

**Type Signature:**

TypeScript

```
function getUpdatedAt<E extends Entity>(entity: E): Option.Option<Date>;
```

#### `markUpdated<E extends Entity>(entity): E`

**Type Signature:**

TypeScript

```
function markUpdated<E extends Entity>(entity: E): E;
```

#### `asCommand<E, I>(reducerLogic): (input: I) => CommandOnModel<E>`

**Type Signature:**

TypeScript

```
function asCommand<E extends Entity, I>(
  reducerLogic: (    input: I,    props: GetProps<E>,    entity: E,  ) => Effect.Effect<{ props: GetProps<E> }, CoreException, never>,
): (input: I) => CommandOnModel<E>;
```

### AggGenericTrait

#### `getDomainEvents<A extends AggregateRoot>(aggregate): ReadonlyArray<IDomainEvent>`

**Type Signature:**

TypeScript

```
function getDomainEvents<A extends AggregateRoot>(
  aggregate: A,
): ReadonlyArray<IDomainEvent>;
```

#### `clearEvents<A extends AggregateRoot>(aggregate): A`

**Type Signature:**

TypeScript

```
function clearEvents<A extends AggregateRoot>(aggregate: A): A;
```

#### `addDomainEvent<A extends AggregateRoot>(event): (aggregate: A) => A`

**Type Signature:**

TypeScript

```
function addDomainEvent<A extends AggregateRoot>(
  event: IDomainEvent,
): (aggregate: A) => A;
```

#### `asCommand<A, I>(reducerLogic): (input: I) => CommandOnModel<A>`

**Type Signature:**

TypeScript

```
function asCommand<A extends AggregateRoot, I>(
  reducerLogic: (    input: I,    props: GetProps<A>,    aggregate: A,    correlationId: string,  ) => Effect.Effect<    { props: GetProps<A>; domainEvents: IDomainEvent[] },    CoreException,    never
  >,
): (input: I) => CommandOnModel<A>;
```

---

## 📢 Domain Events API

### DomainEventTrait

#### `create<P, A extends AggregateRoot>(params): IDomainEvent<P>`

**Type Signature:**

TypeScript

```
function create<P, A extends AggregateRoot>(params: {  name: string;  payload: P;  correlationId: string;  causationId?: string;  userId?: string;  aggregate?: A;}): IDomainEvent<P>;
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

TypeScript

```
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

```
interface IDomainEventPublisher {
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, never>;
  publishAll(
    events: ReadonlyArray<IDomainEvent>,
  ): Effect.Effect<void, BaseException, never>;
}
```

**Example:**

TypeScript

```
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

### Exception Types

#### `ValidationException`

**Type Signature:**

TypeScript

```
class ValidationException extends Data.TaggedError('ValidationFail')<{
  code: string;
  message: string;
  content?: {
    loc?: string[];
    instruction?: string[];
    details?: string[];
    violations?: Array<{ rule: string; code: string; message: string; }>;
  };
}>
```

#### `ValidationException.new(code, message, content?): ValidationException`

**Type Signature:**

TypeScript

```
static new(
  code: string,
  message: string,
  content?: ValidationException['content'],
): ValidationException
```

#### `ValidationException.withViolations(violations): ValidationException`

**Type Signature:**

TypeScript

```
static withViolations(
  violations: Array<{ rule: string; code: string; message: string; }>,
): ValidationException
```

**Example:**

TypeScript

```
import { ValidationException } from 'effect-ddd';

// Simple validation error
const validationError = ValidationException.new(
  'INVALID_EMAIL',
  'Email format is invalid',
  {
    loc: ['user', 'email'],
    instruction: ['Email must be a valid email address'],
    details: ['Provided: not-an-email'],
  },
);

// Multiple violations
const multipleViolations = ValidationException.withViolations([
  { rule: 'email_format', code: 'INVALID_EMAIL', message: 'Invalid email' },
  {
    rule: 'password_strength',
    code: 'WEAK_PASSWORD',
    message: 'Password too weak',
  },
]);
```

#### `NotFoundException`

**Type Signature:**

TypeScript

```
class NotFoundException extends Data.TaggedError('Notfound')<BaseException>

static new(code: string, message: string, content?: BaseException['content']): NotFoundException
```

#### `OperationException`

**Type Signature:**

TypeScript

```
class OperationException extends Data.TaggedError('Operation')<BaseException>

static new(code: string, message: string, content?: BaseException['content']): OperationException
```

---

## 🔧 Utilities & Type Classes

### Identifier Utilities

#### `IdentifierTrait`

**Type Signature:**

TypeScript

```
interface IidentifierTrait {
  parse: typeof parseId;
  new: typeof parseId;
  uuid(): Identifier;
}

const IdentifierTrait: IidentifierTrait;
```

**Example:**

TypeScript

```
import { IdentifierTrait } from 'effect-ddd';

const id = IdentifierTrait.uuid(); // Generate new UUID
const parsedId = yield * IdentifierTrait.parse('existing-uuid');
```

### Type Classes

#### `HasProps<T>`

**Type Signature:**

TypeScript

```
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

TypeScript

```
type ObjectWithId = {
  readonly id: Identifier;
};
```

#### `WithTime`

**Type Signature:**

TypeScript

```
type WithTime = {
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
};
```

### Application Layer

#### `Command<T>`

**Type Signature:**

TypeScript

```
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

TypeScript

```
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

TypeScript

```
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

TypeScript

```
function randomItem<T>(items: T[]): T;
```

**Parameters:**

- `items`: Array of items to choose from

**Returns:** Randomly selected item from the array

#### `toSnakeCase(str: string): string`

**Type Signature:**

TypeScript

```
function toSnakeCase(str: string): string;
```

**Parameters:**

- `str`: String to convert

**Returns:** String converted to snake_case

#### `now(): Date`

**Type Signature:**

TypeScript

```
function now(): Date;
```

**Returns:** Current date and time

This comprehensive API reference provides detailed information about all the major components and utilities in the effect-ddd library, including complete type signatures, parameter descriptions, and practical examples for each function and interface.

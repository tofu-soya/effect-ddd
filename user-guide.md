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

---

## 🔨 Domain Builder API

The Domain Builder provides a functional, composable API for creating domain models with built-in validation, queries, and commands.

### Configuration Creators

#### `createValueObject<Props, NewParams>(tag: string)`

**Type Signature:**

```typescript
function createValueObject<
  Props extends Record<string, any>,
  NewParams = Props,
>(
  tag: string,
): DomainConfig<ValueObject<Props>, unknown, NewParams, Record<string, never>>;
```

**Parameters:**

- `tag` (`string`): Unique identifier for the value object type
- `Props`: TypeScript type representing the value object properties
- `NewParams`: TypeScript type for the input to the `new` method (defaults to `Props`)

**Returns:** `DomainConfig` - Configuration object for further composition

**Example:**

```typescript
import { createValueObject } from 'effect-ddd';

// Simple value object where new() takes same input as props
const SimpleConfig = createValueObject<{ value: string }>('Simple');

// Value object where new() takes different input type
const EmailConfig = createValueObject<{ value: string }, string>('Email');
```

---

#### `createEntity<Props, NewParams>(tag: string)`

**Type Signature:**

```typescript
function createEntity<Props extends Record<string, any>, NewParams = Props>(
  tag: string,
): EntityConfig<
  Entity<Props>,
  unknown,
  NewParams,
  Record<string, never>,
  Record<string, never>
>;
```

**Parameters:**

- `tag` (`string`): Unique identifier for the entity type
- `Props`: TypeScript type representing the entity properties (excluding `id`, `createdAt`, `updatedAt`)
- `NewParams`: TypeScript type for the input to the `new` method

**Returns:** `EntityConfig` - Configuration object that extends `DomainConfig` with command support

**Example:**

```typescript
type UserProps = {
  name: string;
  email: string;
  isActive: boolean;
};

type UserInput = {
  name: string;
  email: string;
};

const UserConfig = createEntity<UserProps, UserInput>('User');
```

---

#### `createAggregateRoot<Props, NewParams>(tag: string)`

**Type Signature:**

```typescript
function createAggregateRoot<
  Props extends Record<string, any>,
  NewParams = Props,
>(
  tag: string,
): AggregateConfig<
  AggregateRoot<Props>,
  unknown,
  NewParams,
  Record<string, never>,
  Record<string, never>,
  Record<string, never>
>;
```

**Parameters:**

- `tag` (`string`): Unique identifier for the aggregate type
- `Props`: TypeScript type representing the aggregate properties
- `NewParams`: TypeScript type for the input to the `new` method

**Returns:** `AggregateConfig` - Configuration object with command, query, and event handler support

**Example:**

```typescript
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

const OrderConfig = createAggregateRoot<OrderProps, OrderInput>('Order');
```

### Configuration Transformers

#### `withSchema<T, S, NewParams>(schema: Schema.Schema<S>)`

**Type Signature:**

```typescript
function withSchema<
  T extends Record<string, any>,
  S extends Record<string, any>,
  NewParams,
>(
  schema: Schema.Schema<S>,
): (config: DomainConfig<T, NewParams>) => DomainConfig<S, NewParams>;
```

**Parameters:**

- `schema`: Effect Schema that defines the structure and validation rules

**Returns:** Function that transforms the configuration to use the new schema type

**Example:**

```typescript
import { Schema } from 'effect';
import { createValueObject } from 'effect-ddd';

const UserSchema = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  age: Schema.Number,
  isActive: Schema.Boolean,
});

const UserConfig = pipe(
  createEntity('User'),
  withSchema(UserSchema), // Now typed as Schema.Schema.Type<typeof UserSchema>
);
```

**Notes:**

- Setting `withSchema` clears any existing `propsParser` to avoid conflicts
- Schema validation runs before custom validators
- Provides automatic TypeScript inference

---

#### `withPropsParser<TConfig, NewPropsParser>(propsParser: NewPropsParser)`

**Type Signature:**

```typescript
function withPropsParser<
  TConfig extends AnyDomainConfig,
  NewPropsParser extends PropsParser<any, any>,
>(propsParser: NewPropsParser): (config: TConfig) => TConfig;
```

**Parameters:**

- `propsParser`: Custom parser function that takes input and returns validated properties as Effect

**Returns:** Function that transforms the configuration to use custom parsing logic

**Example:**

```typescript
const EmailTrait = pipe(
  createValueObject<{ value: string }, string>('Email'),
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
  buildValueObject,
);
```

**Notes:**

- Setting `withPropsParser` clears any existing `schema` to avoid conflicts
- Allows complex business logic and external API calls during validation
- Full control over error handling and validation flow

---

#### `withValidation<TConfig>(validator: (props: Props) => ParseResult<Props>)`

**Type Signature:**

```typescript
function withValidation<TConfig extends AnyDomainConfig>(
  validator: TConfig extends DomainConfig<infer DM, any, any, any>
    ? (props: DM['props']) => ParseResult<DM['props']>
    : never,
): (config: TConfig) => TConfig;
```

**Parameters:**

- `validator`: Function that takes validated properties and returns Effect with additional validation

**Returns:** Function that adds the validator to the configuration's validation chain

**Example:**

```typescript
const UserTrait = pipe(
  createEntity<UserProps>('User'),
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

      if (props.email.endsWith('@competitor.com')) {
        return yield* Effect.fail(
          ValidationException.new(
            'COMPETITOR_EMAIL',
            'Competitor emails not allowed',
          ),
        );
      }

      return props;
    }),
  ),
  buildEntity,
);
```

**Notes:**

- Validators run in the order they are added
- Each validator receives the output of the previous validator
- Can modify properties or just validate them

---

#### `withInvariant<TConfig>(predicate, errorMessage, errorCode?)`

**Type Signature:**

```typescript
function withInvariant<TConfig extends AnyDomainConfig>(
  predicate: TConfig extends DomainConfig<infer DM, any, any, any>
    ? (props: DM['props']) => boolean
    : never,
  errorMessage: string,
  errorCode: string = 'INVARIANT_VIOLATION',
): (config: TConfig) => TConfig;
```

**Parameters:**

- `predicate`: Function that returns `true` if the invariant is satisfied
- `errorMessage`: Error message when the invariant is violated
- `errorCode`: Optional error code (defaults to `'INVARIANT_VIOLATION'`)

**Returns:** Function that adds the invariant check to the validation chain

**Example:**

```typescript
const MoneyTrait = pipe(
  createValueObject<MoneyProps>('Money'),
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

---

#### `withNew<TConfig>(newMethod: (params: NewParam, parse: ParseFunction) => ParseResult<DM>)`

**Type Signature:**

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

**Parameters:**

- `newMethod`: Function that takes input parameters and parse function, returns Effect with domain object

**Returns:** Function that overrides the default `new` method with custom creation logic

**Example:**

```typescript
import { createEntity } from 'effect-ddd';

const UserTrait = pipe(
  createEntity<UserProps, UserInput>('User'), 
  withSchema(UserSchema),
  withNew((input: UserInput, parse) =>
    Effect.gen(function* () {
      // Custom creation logic
      const normalizedInput = {
        ...input,
        email: input.email.toLowerCase().trim(),
        name: input.name.trim(),
      };

      // Use the provided parse function for validation
      return yield* parse(normalizedInput);
    }),
  ),
  buildEntity,
);
```

---

#### `withQuery<TConfig, K, R>(name: K, query: (props: Props) => R)`

**Type Signature:**

```typescript
function withQuery<TConfig extends AnyDomainConfig, K extends string, R>(
  name: K,
  query: TConfig extends DomainConfig<infer DM, any, any, any>
    ? (props: DM['props']) => R
    : never,
): (
  config: TConfig,
) => TConfig & { queries: TConfig['queries'] & Record<K, typeof query> };
```

**Parameters:**

- `name`: Name of the query method that will be added to the trait
- `query`: Function that takes domain object properties and returns computed value

**Returns:** Function that adds the query to the configuration

**Example:**

```typescript
const UserTrait = pipe(
  createEntity<UserProps>('User'),
  withSchema(UserSchema),
  withQuery('isAdult', (props) => props.age >= 18),
  withQuery(
    'getDisplayName',
    (props) => `${props.firstName} ${props.lastName}`,
  ),
  withQuery('getEmailDomain', (props) => props.email.split('@')[1]),
  buildEntity,
);

// Usage
const user = yield * UserTrait.new(userData);
console.log(user.isAdult()); // boolean
console.log(user.getDisplayName()); // string
console.log(user.getEmailDomain()); // string
```

---

#### `withQueryEffect<TConfig, K, R>(name: K, query: (props: Props) => Effect<R, any, any>)`

**Type Signature:**

```typescript
function withQueryEffect<TConfig extends AnyDomainConfig, K extends string, R>(
  name: K,
  query: TConfig extends DomainConfig<infer DM, any, any, any>
    ? (props: DM['props']) => Effect.Effect<R, any, any>
    : never,
): (
  config: TConfig,
) => TConfig & { queries: TConfig['queries'] & Record<K, typeof query> };
```

**Parameters:**

- `name`: Name of the async query method
- `query`: Function that returns an Effect for async operations

**Returns:** Function that adds the async query to the configuration

**Example:**

```typescript
const UserTrait = pipe(
  createEntity<UserProps>('User'),
  withSchema(UserSchema),
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
  buildEntity,
);

// Usage
const user = yield * UserTrait.new(userData);
const preferences = yield * user.getPreferences();
const subscription = yield * user.getSubscriptionStatus();
```

---

#### `withCommand<TConfig, I>(name: string, handler: CommandHandler<I, Props>)`

**Type Signature:**

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

**Parameters:**

- `name`: Name of the command method
- `handler`: Function that takes input and current properties, returns new properties
- `I`: Type of the command input

**Returns:** Function that adds the command to the entity configuration

**Example:**

```typescript
const UserTrait = pipe(
  createEntity<UserProps>('User'),
  withSchema(UserSchema),
  withCommand(
    'updateProfile',
    (input: { name?: string; email?: string }, props: UserProps) =>
      Effect.gen(function* () {
        if (input.email && !validator.isEmail(input.email)) {
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
  withCommand('activate', (_, props) =>
    Effect.succeed({ props: { ...props, isActive: true } }),
  ),
  buildEntity,
);

// Usage
const user = yield * UserTrait.new(userData);
const updatedUser =
  yield *
  UserTrait.updateProfile({
    name: 'New Name',
    email: 'new@email.com',
  })(user);
```

---

#### `withAggregateCommand<TConfig, I>(name, handler)`

**Type Signature:**

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

**Parameters:**

- `name`: Name of the command method
- `handler`: Function that takes input, props, aggregate, and correlationId, returns new state and events

**Returns:** Function that adds the aggregate command to the configuration

**Example:**

```typescript
const OrderTrait = pipe(
  createAggregateRoot<OrderProps>('Order'),
  withSchema(OrderSchema),
  withAggregateCommand(
    'addItem',
    (
      item: OrderItem,
      props: OrderProps,
      aggregate: AggregateRoot<OrderProps>,
      correlationId: string,
    ) =>
      Effect.gen(function* () {
        // Business validation
        if (props.status !== 'draft') {
          return yield* Effect.fail(
            ValidationException.new(
              'ORDER_LOCKED',
              'Cannot modify confirmed order',
            ),
          );
        }

        // Calculate new state
        const newItems = [...props.items, item];
        const newTotal = calculateTotal(newItems);

        // Create domain event
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
      }),
  ),
  buildAggregateRoot,
);
```

---

#### `withEventHandler(eventName: string, handler: (event: IDomainEvent) => void)`

**Type Signature:**

```typescript
function withEventHandler<TConfig extends AggregateConfig>(
  eventName: string,
  handler: (event: IDomainEvent) => void,
): (config: TConfig) => TConfig & {
  eventHandlers: TConfig['eventHandlers'] &
    Record<string, EventHandlerFunction>;
};
```

**Parameters:**

- `eventName`: Name of the domain event to handle
- `handler`: Function that processes the domain event

**Returns:** Function that adds the event handler to the configuration

**Example:**

```typescript
const OrderTrait = pipe(
  createAggregateRoot<OrderProps>('Order'),
  withAggregateCommand('confirm', confirmOrderHandler),
  withEventHandler('OrderConfirmed', (event) => {
    console.log(`Order confirmed: ${event.aggregateId}`);
    // Trigger side effects:
    // - Send confirmation email
    // - Reserve inventory
    // - Process payment
  }),
  withEventHandler('OrderCancelled', (event) => {
    console.log(`Order cancelled: ${event.payload.reason}`);
    // Trigger side effects:
    // - Release inventory
    // - Process refund
  }),
  buildAggregateRoot,
);
```

### Builders

#### `buildValueObject<T, NewParams>(config: DomainConfig<T, NewParams>)`

**Type Signature:**

```typescript
function buildValueObject<T extends ValueObject, NewParams>(
  config: DomainConfig<T, NewParams>,
): ValueObjectTrait<T, NewParams, unknown> & QueryMethods<T['props'], Queries>;
```

**Parameters:**

- `config`: Complete value object configuration

**Returns:** Value object trait with `parse`, `new`, and all configured query methods

**Example:**

```typescript
import { createValueObject } from 'effect-ddd';

const EmailTrait = pipe(
  createValueObject<EmailProps, string>('Email'),
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

#### `buildEntity<T, NewParams>(config: EntityConfig<T, NewParams>)`

**Type Signature:**

```typescript
function buildEntity<T extends Entity, NewParams>(
  config: EntityConfig<T, NewParams>,
): EntityTrait<T, NewParams, unknown> & Commands & Queries;
```

**Parameters:**

- `config`: Complete entity configuration

**Returns:** Entity trait with `parse`, `new`, commands, and query methods

**Example:**

```typescript
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

#### `buildAggregateRoot<T, NewParams>(config: AggregateConfig<T, NewParams>)`

**Type Signature:**

```typescript
function buildAggregateRoot<T extends AggregateRoot, NewParams>(
  config: AggregateConfig<T, NewParams>,
): AggregateRootTrait<T, NewParams, unknown> &
  Commands &
  Queries &
  EventHandlers;
```

**Parameters:**

- `config`: Complete aggregate root configuration

**Returns:** Aggregate root trait with all methods and event handlers

**Example:**

```typescript
import { createAggregateRoot } from 'effect-ddd';

const OrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withAggregateCommand('addItem', addItemCommand),
  withQuery('getItemCount', (props) => props.items.length),
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

## 🧩 Schema Builder API

The Schema Builder provides composable validation schema creation with functional composition.

### String Schema Functions

#### `stringSchema()`

**Type Signature:**

```typescript
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

```typescript
function buildStringSchema(state: StringSchemaState): Schema.Schema<string>;
```

**Example:**

```typescript
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

```typescript
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

```typescript
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
import { pipe } from 'effect';

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
  /**
   * Save an existing aggregate root and publish domain events
   */
  save(aggregateRoot: A): Effect.Effect<void, BaseException, never>;

  /**
   * Add a new aggregate root and publish domain events
   */
  add(entity: A): Effect.Effect<void, BaseException, never>;

  /**
   * Save multiple aggregate roots
   */
  saveMultiple(entities: A[]): Effect.Effect<void, BaseException, never>;

  /**
   * Find one aggregate root by query parameters
   */
  findOne(
    params: QueryParams,
  ): Effect.Effect<Option.Option<A>, BaseException, never>;

  /**
   * Find one aggregate root by query parameters or throw
   */
  findOneOrThrow(params: QueryParams): Effect.Effect<A, BaseException, never>;

  /**
   * Find one aggregate root by ID or throw
   */
  findOneByIdOrThrow(id: Identifier): Effect.Effect<A, BaseException, never>;

  /**
   * Find many aggregate roots by query parameters
   */
  findMany(params: QueryParams): Effect.Effect<A[], BaseException, never>;

  /**
   * Find many aggregate roots with pagination
   */
  findManyPaginated(
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<A[]>, BaseException, never>;

  /**
   * Delete an aggregate root
   */
  delete(entity: A): Effect.Effect<void, BaseException, never>;

  /**
   * Set correlation ID for tracking
   */
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

```typescript
function isEqual<VO extends ValueObject>(vo1: VO, vo2: VO): boolean;
```

#### `createValueObjectTrait<VO, N, P>(propsParser, tag): ValueObjectTrait<VO, N, P>`

**Type Signature:**

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

```typescript
function getDomainEvents<A extends AggregateRoot>(
  aggregate: A,
): ReadonlyArray<IDomainEvent>;
```

#### `clearEvents<A extends AggregateRoot>(aggregate): A`

**Type Signature:**

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
import { DomainEventTrait } from 'effect-ddd';

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

```typescript
interface IDomainEventPublisher {
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, never>;
  publishAll(
    events: ReadonlyArray<IDomainEvent>,
  ): Effect.Effect<void, BaseException, never>;
}
```

**Example:**

```typescript
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

```typescript
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

```typescript
static new(
  code: string,
  message: string,
  content?: ValidationException['content'],
): ValidationException
```

#### `ValidationException.withViolations(violations): ValidationException`

**Type Signature:**

```typescript
static withViolations(
  violations: Array<{ rule: string; code: string; message: string; }>,
): ValidationException
```

**Example:**

```typescript
// Simple validation error
import { ValidationException } from 'effect-ddd';

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

```typescript
class NotFoundException extends Data.TaggedError('Notfound')<BaseException>

static new(code: string, message: string, content?: BaseException['content']): NotFoundException
```

#### `OperationException`

**Type Signature:**

```typescript
class OperationException extends Data.TaggedError('Operation')<BaseException>

static new(code: string, message: string, content?: BaseException['content']): OperationException
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
const id = IdentifierTrait.uuid(); // Generate new UUID
const parsedId = yield * IdentifierTrait.parse('existing-uuid');
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
  correlationId<T>(command: Command<T>): string;
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

This comprehensive API reference provides detailed information about all the major components and utilities in the yl-ddd-ts library, including complete type signatures, parameter descriptions, and practical examples for each function and interface.

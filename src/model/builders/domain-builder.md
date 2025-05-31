# Functional Domain Builder

The Functional Domain Builder provides a composable, declarative API for creating domain models using functional programming patterns. It builds on top of the existing trait infrastructure while offering enhanced developer experience through functional composition with `pipe`.

## Overview

While you can create domain models using the trait infrastructure directly (as shown in previous sections), the Functional Domain Builder offers several advantages:

- **Reduced Boilerplate**: Less repetitive code compared to manual trait creation
- **Better Composition**: Easily combine validation, commands, queries, and event handlers
- **Enhanced Type Safety**: Full TypeScript inference with custom input types
- **Declarative API**: Clear, readable domain model definitions
- **Trait Integration**: Leverages existing `ValueObjectGenericTrait`, `EntityGenericTrait`, and `AggGenericTrait`

## Basic Usage

### Creating a Value Object

```typescript
import { pipe, Effect, Schema } from 'effect';
import {
  createValueObject,
  withSchema,
  withNew,
  withQuery,
  withInvariant,
  buildValueObject,
} from '@model/functional-domain-builder';

const EmailSchema = Schema.Struct({
  value: Schema.String,
});

type EmailProps = Schema.Schema.Type<typeof EmailSchema>;

const EmailTrait = pipe(
  createValueObject<EmailProps, string>('Email'),
  withSchema(EmailSchema),
  withNew((emailString: string) =>
    Effect.succeed({ value: emailString.toLowerCase().trim() }),
  ),
  withInvariant(
    (props) => validator.isEmail(props.value),
    'Invalid email format',
  ),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  buildValueObject,
);

// Usage
const email = yield * EmailTrait.new('USER@EXAMPLE.COM');
console.log(email.props.value); // user@example.com
console.log(email.getDomain()); // example.com
```

### Creating an Entity with Commands

```typescript
import {
  createEntity,
  withCommand,
  withQueries,
  buildEntity,
} from '@model/functional-domain-builder';

const UserSchema = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  isActive: Schema.Boolean,
  registeredAt: Schema.Date,
});

type UserProps = Schema.Schema.Type<typeof UserSchema>;
type UserInput = { name: string; email: string };

const UserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withNew((input: UserInput) =>
    Effect.succeed({
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      isActive: true,
      registeredAt: new Date(),
    }),
  ),
  withQueries({
    isActive: (props) => props.isActive,
    getDisplayName: (props) => `${props.name} (${props.email})`,
    getDaysSinceRegistration: (props) =>
      Math.floor(
        (Date.now() - props.registeredAt.getTime()) / (1000 * 60 * 60 * 24),
      ),
  }),
  withCommand('activate', (_, props) =>
    Effect.succeed({ ...props, isActive: true }),
  ),
  withCommand('updateName', (newName: string, props) =>
    Effect.succeed({ ...props, name: newName.trim() }),
  ),
  buildEntity,
);
```

### Creating an Aggregate Root with Events

```typescript
import {
  createAggregateRoot,
  withAggregateCommand,
  withEventHandler,
  buildAggregateRoot,
} from '@model/functional-domain-builder';

const OrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withNew(createOrderLogic),
  withQueries({
    getItemCount: (props) => props.items.length,
    isEmpty: (props) => props.items.length === 0,
    canBeModified: (props) => props.status === 'draft',
  }),
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
              'ORDER_NOT_MODIFIABLE',
              'Cannot modify confirmed order',
            ),
          );
        }

        const newItems = [...props.items, item];
        const newTotal = calculateTotal(newItems);

        return {
          props: { ...props, items: newItems, total: newTotal },
          domainEvents: [
            DomainEventTrait.create({
              name: 'OrderItemAdded',
              payload: { item },
              correlationId,
              aggregate,
            }),
          ],
        };
      }),
  ),
  withEventHandler('OrderItemAdded', (event) => {
    console.log(`Item added: ${event.payload.item.productName}`);
    // Trigger side effects like inventory reservation
  }),
  buildAggregateRoot,
);
```

## API Reference

### Configuration Creators

#### `createValueObject<Props, NewParams = Props>(tag: string)`

Creates a configuration object for building a value object trait.

**Type Signature:**

```typescript
function createValueObject<
  Props extends Record<string, any>,
  NewParams = Props,
>(tag: string): DomainConfig<Props, NewParams>;
```

**Parameters:**

- `tag` (`string`): Unique identifier for the value object type. Used for the `_tag` property and error messages.
- `Props`: TypeScript type representing the properties of the value object
- `NewParams`: TypeScript type for the input to the `new` method (defaults to `Props`)

**Returns:**
`DomainConfig<Props, NewParams>` - Configuration object for further composition

**Example:**

```typescript
// Simple value object where new() takes same input as props
const SimpleConfig = createValueObject<{ value: string }>('Simple');

// Value object where new() takes different input type
const EmailConfig = createValueObject<{ value: string }, string>('Email');
```

---

#### `createEntity<Props, NewParams = Props>(tag: string)`

Creates a configuration object for building an entity trait.

**Type Signature:**

```typescript
function createEntity<Props extends Record<string, any>, NewParams = Props>(
  tag: string,
): EntityConfig<Props, NewParams>;
```

**Parameters:**

- `tag` (`string`): Unique identifier for the entity type
- `Props`: TypeScript type representing the entity properties (excluding `id`, `createdAt`, `updatedAt`)
- `NewParams`: TypeScript type for the input to the `new` method

**Returns:**
`EntityConfig<Props, NewParams>` - Configuration object that extends `DomainConfig` with command support

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

#### `createAggregateRoot<Props, NewParams = Props>(tag: string)`

Creates a configuration object for building an aggregate root trait.

**Type Signature:**

```typescript
function createAggregateRoot<
  Props extends Record<string, any>,
  NewParams = Props,
>(tag: string): AggregateConfig<Props, NewParams>;
```

**Parameters:**

- `tag` (`string`): Unique identifier for the aggregate type
- `Props`: TypeScript type representing the aggregate properties
- `NewParams`: TypeScript type for the input to the `new` method

**Returns:**
`AggregateConfig<Props, NewParams>` - Configuration object with command, query, and event handler support

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

Adds Effect Schema validation to the domain object configuration.

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

- `schema`: Effect Schema that defines the structure and validation rules for the domain object properties

**Returns:**
Function that transforms the configuration to use the new schema type

**Example:**

```typescript
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

- The schema is used for both `parse()` and `new()` method validation unless overridden
- Schema validation runs before custom validators

---

#### `withNew<T, NewParams, NewNewParams>(newMethod: (params: NewNewParams) => ParseResult<T>)`

Overrides the default `new` method with custom creation logic and input type.

**Type Signature:**

```typescript
function withNew<T extends Record<string, any>, NewParams, NewNewParams>(
  newMethod: (params: NewNewParams) => ParseResult<T>,
): (config: DomainConfig<T, NewParams>) => DomainConfig<T, NewNewParams>;
```

**Parameters:**

- `newMethod`: Function that takes input parameters and returns an Effect containing the validated properties

**Returns:**
Function that transforms the configuration to use the custom creation logic

**Example:**

```typescript
const EmailTrait = pipe(
  createValueObject<{ value: string }, string>('Email'),
  withSchema(Schema.Struct({ value: Schema.String })),
  withNew((emailString: string) =>
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

// Usage
const email = yield * EmailTrait.new('USER@EXAMPLE.COM'); // Takes string
const parsed = yield * EmailTrait.parse({ value: 'user@example.com' }); // Takes object
```

**Notes:**

- The `parse` method still uses the original schema validation
- Custom validation and business logic can be embedded in the new method
- Input type can be completely different from the props type

---

#### `withValidation<T, NewParams>(validator: (props: T) => ParseResult<T>)`

Adds custom validation logic that runs after schema validation.

**Type Signature:**

```typescript
function withValidation<T extends Record<string, any>, NewParams>(
  validator: (props: T) => ParseResult<T>,
): (config: DomainConfig<T, NewParams>) => DomainConfig<T, NewParams>;
```

**Parameters:**

- `validator`: Function that takes validated properties and returns an Effect with additional validation

**Returns:**
Function that adds the validator to the configuration's validation chain

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
- Validators can modify the properties or just validate them

---

#### `withInvariant<T, NewParams>(predicate: (props: T) => boolean, errorMessage: string, errorCode?: string)`

Adds invariant validation using a predicate function.

**Type Signature:**

```typescript
function withInvariant<T extends Record<string, any>, NewParams>(
  predicate: (props: T) => boolean,
  errorMessage: string,
  errorCode?: string,
): (config: DomainConfig<T, NewParams>) => DomainConfig<T, NewParams>;
```

**Parameters:**

- `predicate`: Function that returns `true` if the invariant is satisfied
- `errorMessage`: Error message when the invariant is violated
- `errorCode`: Optional error code (defaults to `'INVARIANT_VIOLATION'`)

**Returns:**
Function that adds the invariant check to the validation chain

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

**Notes:**

- Invariants are a convenient way to add simple validation rules
- Multiple invariants can be added and they all must pass
- Equivalent to `withValidation` with a predicate check

---

#### `withQuery<T, NewParams, R>(name: string, query: (props: T) => R)`

Adds a synchronous query method to the domain object.

**Type Signature:**

```typescript
function withQuery<T extends Record<string, any>, NewParams, R>(
  name: string,
  query: (props: T) => R,
): (config: DomainConfig<T, NewParams>) => DomainConfig<T, NewParams>;
```

**Parameters:**

- `name`: Name of the query method that will be added to the trait
- `query`: Function that takes the domain object properties and returns a computed value

**Returns:**
Function that adds the query to the configuration

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

**Notes:**

- Queries are pure functions that don't modify state
- Query methods are added directly to the built trait
- Queries have access to all properties of the domain object

---

#### `withQueryEffect<T, NewParams, R>(name: string, query: (props: T) => Effect.Effect<R, any, any>)`

Adds an asynchronous query method that returns an Effect.

**Type Signature:**

```typescript
function withQueryEffect<T extends Record<string, any>, NewParams, R>(
  name: string,
  query: (props: T) => Effect.Effect<R, any, any>,
): (config: DomainConfig<T, NewParams>) => DomainConfig<T, NewParams>;
```

**Parameters:**

- `name`: Name of the async query method
- `query`: Function that returns an Effect for async operations

**Returns:**
Function that adds the async query to the configuration

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

**Notes:**

- Async queries can perform side effects like API calls or database queries
- They return Effects that must be executed with `yield*` or `Effect.runPromise`
- Error handling is built into the Effect system

---

#### `withCommand<T, I, NewParams>(name: string, handler: (input: I, props: T) => Effect.Effect<T, any, any>)`

Adds a command to an entity configuration. Uses `EntityGenericTrait.asCommand` internally.

**Type Signature:**

```typescript
function withCommand<T extends Record<string, any>, I, NewParams>(
  name: string,
  handler: (input: I, props: T) => Effect.Effect<T, any, any>,
): (config: EntityConfig<T, NewParams>) => EntityConfig<T, NewParams>;
```

**Parameters:**

- `name`: Name of the command method
- `handler`: Function that takes input and current properties, returns new properties
- `I`: Type of the command input
- `T`: Type of the entity properties

**Returns:**
Function that adds the command to the entity configuration

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
          ...props,
          name: input.name ?? props.name,
          email: input.email ?? props.email,
          lastUpdated: new Date(),
        };
      }),
  ),
  withCommand('activate', (_, props) =>
    Effect.succeed({ ...props, isActive: true }),
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
const activeUser = yield * UserTrait.activate()(updatedUser);
```

**Notes:**

- Commands automatically handle entity lifecycle (updatedAt timestamp)
- Commands return new entity instances (immutable updates)
- Input validation can be performed within the command handler
- Commands use the existing `EntityGenericTrait.asCommand` infrastructure

---

#### `withAggregateCommand<T, I, NewParams>(name, handler)`

Adds a command to an aggregate root that can emit domain events.

**Type Signature:**

```typescript
function withAggregateCommand<T extends Record<string, any>, I, NewParams>(
  name: string,
  handler: (
    input: I,
    props: T,
    aggregate: AggregateRoot<T>,
    correlationId: string,
  ) => Effect.Effect<{ props: T; domainEvents: IDomainEvent[] }, any, any>,
): (config: AggregateConfig<T, NewParams>) => AggregateConfig<T, NewParams>;
```

**Parameters:**

- `name`: Name of the command method
- `handler`: Function that takes input, props, aggregate, and correlationId, returns new state and events
- `I`: Type of the command input

**Returns:**
Function that adds the aggregate command to the configuration

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

        if (item.quantity <= 0) {
          return yield* Effect.fail(
            ValidationException.new(
              'INVALID_QUANTITY',
              'Quantity must be positive',
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

// Usage
const order = yield * OrderTrait.new(orderData);
const updatedOrder = yield * OrderTrait.addItem(orderItem)(order);
console.log(updatedOrder.domainEvents.length); // 1
```

**Notes:**

- Aggregate commands can modify state and emit domain events
- Events are automatically added to the aggregate's domain events collection
- Uses `AggGenericTrait.asCommand` internally
- CorrelationId is automatically provided for event tracking

---

#### `withEventHandler(eventName: string, handler: Function)`

Adds an event handler for processing domain events.

**Type Signature:**

```typescript
function withEventHandler<T, NewParams>(
  eventName: string,
  handler: (event: IDomainEvent) => void,
): (config: AggregateConfig<T, NewParams>) => AggregateConfig<T, NewParams>;
```

**Parameters:**

- `eventName`: Name of the domain event to handle
- `handler`: Function that processes the domain event

**Returns:**
Function that adds the event handler to the configuration

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
    // - Update analytics
  }),
  withEventHandler('OrderCancelled', (event) => {
    console.log(`Order cancelled: ${event.payload.reason}`);
    // Trigger side effects:
    // - Release inventory
    // - Process refund
    // - Send cancellation notice
  }),
  buildAggregateRoot,
);

// Process events
const order = yield * OrderTrait.confirm()(draftOrder);
order.domainEvents.forEach((event) => {
  const handler = OrderTrait.eventHandlers[event.name];
  if (handler) {
    handler(event);
  }
});
```

**Notes:**

- Event handlers are for side effects, not state changes
- Handlers are stored in the `eventHandlers` property of the built trait
- Events must be manually processed by iterating over `domainEvents`
- Handlers should be idempotent for reliability

### Builders

#### `buildValueObject<T, NewParams>(config: DomainConfig<T, NewParams>)`

Creates the final value object trait from the configuration.

**Type Signature:**

```typescript
function buildValueObject<T extends Record<string, any>, NewParams>(
  config: DomainConfig<T, NewParams>,
): ValueObjectTrait<ValueObject<T>, NewParams, unknown>;
```

**Parameters:**

- `config`: Complete value object configuration

**Returns:**
Value object trait with `parse`, `new`, and all configured query methods

**Example:**

```typescript
const EmailTrait = pipe(
  createValueObject<EmailProps, string>('Email'),
  withSchema(EmailSchema),
  withNew(emailCreationLogic),
  withQuery('getDomain', getDomainQuery),
  buildValueObject, // Final trait creation
);

// Trait has these methods:
// - EmailTrait.parse(props): Effect<ValueObject<EmailProps>, Error>
// - EmailTrait.new(emailString): Effect<ValueObject<EmailProps>, Error>
// - email.getDomain(): string
```

---

#### `buildEntity<T, NewParams>(config: EntityConfig<T, NewParams>)`

Creates the final entity trait from the configuration.

**Type Signature:**

```typescript
function buildEntity<T extends Record<string, any>, NewParams>(
  config: EntityConfig<T, NewParams>,
): EntityTrait<Entity<T>, NewParams, unknown> & Commands & Queries;
```

**Parameters:**

- `config`: Complete entity configuration

**Returns:**
Entity trait with `parse`, `new`, commands, and query methods

**Example:**

```typescript
const UserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withCommands({ activate: activateCommand, updateName: updateNameCommand }),
  withQueries({ isActive: isActiveQuery, getDisplayName: displayNameQuery }),
  buildEntity,
);

// Trait has these methods:
// - UserTrait.parse(props): Effect<Entity<UserProps>, Error>
// - UserTrait.new(input): Effect<Entity<UserProps>, Error>
// - UserTrait.activate(): (user: Entity<UserProps>) => Effect<Entity<UserProps>, Error>
// - user.isActive(): boolean
// - user.getDisplayName(): string
```

---

#### `buildAggregateRoot<T, NewParams>(config: AggregateConfig<T, NewParams>)`

Creates the final aggregate root trait from the configuration.

**Type Signature:**

```typescript
function buildAggregateRoot<T extends Record<string, any>, NewParams>(
  config: AggregateConfig<T, NewParams>,
): AggregateRootTrait<AggregateRoot<T>, NewParams, unknown> &
  Commands &
  Queries &
  EventHandlers;
```

**Parameters:**

- `config`: Complete aggregate root configuration

**Returns:**
Aggregate root trait with all methods and event handlers

**Example:**

```typescript
const OrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withAggregateCommands({ addItem: addItemCommand, confirm: confirmCommand }),
  withQueries({ getItemCount: itemCountQuery, isEmpty: isEmptyQuery }),
  withEventHandlers({ OrderConfirmed: orderConfirmedHandler }),
  buildAggregateRoot,
);

// Trait has these methods and properties:
// - OrderTrait.parse(props): Effect<AggregateRoot<OrderProps>, Error>
// - OrderTrait.new(input): Effect<AggregateRoot<OrderProps>, Error>
// - OrderTrait.addItem(item): (order) => Effect<AggregateRoot<OrderProps>, Error>
// - order.getItemCount(): number
// - order.isEmpty(): boolean
// - OrderTrait.eventHandlers: { OrderConfirmed: Function }
```

### Convenience Functions

#### `withQueries<T, NewParams>(queries: Record<string, (props: T) => any>)`

Adds multiple query methods at once.

**Type Signature:**

```typescript
function withQueries<T extends Record<string, any>, NewParams>(
  queries: Record<string, (props: T) => any>,
): (config: DomainConfig<T, NewParams>) => DomainConfig<T, NewParams>;
```

**Example:**

```typescript
const ProductTrait = pipe(
  createEntity<ProductProps>('Product'),
  withQueries({
    isInStock: (props) => props.stockQuantity > 0,
    isLowStock: (props) => props.stockQuantity <= 5,
    getDisplayPrice: (props) => `${props.price.toFixed(2)}`,
    canBeSold: (props) => props.isActive && props.stockQuantity > 0,
  }),
  buildEntity,
);
```

#### `withCommands<T, NewParams>(commands: Record<string, Function>)`

Adds multiple entity commands at once.

#### `withAggregateCommands<T, NewParams>(commands: Record<string, Function>)`

Adds multiple aggregate commands at once.

#### `composeValidations<T, NewParams>(...validators: Array<(props: T) => ParseResult<T>>)`

Combines multiple validation functions into a single validator.

**Example:**

```typescript
const UserTrait = pipe(
  createEntity<UserProps>('User'),
  composeValidations(
    validateEmailFormat,
    validateAgeRequirement,
    validateTermsAcceptance,
  ),
  buildEntity,
);
```

#### `predicateValidation<T, NewParams>(predicate: (props: T) => boolean, message: string, code?: string)`

Creates a validation function from a predicate.

**Example:**

```typescript
const ProductTrait = pipe(
  createEntity<ProductProps>('Product'),
  predicateValidation(
    (props) => props.price > 0,
    'Price must be positive',
    'NEGATIVE_PRICE',
  ),
  buildEntity,
);
```

## Key Features

### Custom Creation Logic

The `withNew` transformer allows you to define custom creation logic with different input types:

```typescript
// Value Object: new() takes string, parse() takes { value: string }
const EmailTrait = pipe(
  createValueObject<EmailProps, string>('Email'),
  withNew((emailString: string) =>
    Effect.succeed({ value: emailString.toLowerCase().trim() }),
  ),
  // ...
);

// Entity: new() takes simplified input, parse() takes full props
const UserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withNew((input: UserInput) =>
    Effect.gen(function* () {
      const normalizedEmail = input.email.toLowerCase().trim();

      if (!validator.isEmail(normalizedEmail)) {
        return yield* Effect.fail(
          ValidationException.new('INVALID_EMAIL', 'Invalid email format'),
        );
      }

      return {
        name: input.name.trim(),
        email: normalizedEmail,
        isActive: true,
        registeredAt: new Date(),
      };
    }),
  ),
  // ...
);
```

### Rich Query Support

Add both synchronous and asynchronous queries to your domain models:

```typescript
const ProductTrait = pipe(
  createEntity<ProductProps>('Product'),
  withQueries({
    // Simple property queries
    isInStock: (props) => props.stockQuantity > 0,
    isLowStock: (props) => props.stockQuantity <= 5,

    // Computed queries
    getStockStatus: (props) => {
      if (props.stockQuantity === 0) return 'out-of-stock';
      if (props.stockQuantity <= 5) return 'low-stock';
      return 'in-stock';
    },

    // Business logic queries
    canBeSold: (props) => props.isActive && props.stockQuantity > 0,
  }),

  // Async queries for external data
  withQueryEffect(
    'getSupplierInfo',
    (props) => () =>
      Effect.gen(function* () {
        const supplier = yield* fetchSupplierData(props.supplierId);
        return {
          name: supplier.name,
          contact: supplier.contact,
          leadTime: supplier.leadTime,
        };
      }),
  ),
  buildEntity,
);

// Usage
const product = yield * ProductTrait.new(productData);
console.log(product.isInStock()); // true
console.log(product.getStockStatus()); // "in-stock"
const supplierInfo = yield * product.getSupplierInfo();
```

### Composable Validation

Build complex validation by composing simpler validators:

```typescript
const UserTrait = pipe(
  createEntity<UserProps>('User'),
  withSchema(UserSchema),

  // Individual validations
  withInvariant((props) => props.name.length > 0, 'Name cannot be empty'),
  withInvariant(
    (props) => validator.isEmail(props.email),
    'Invalid email format',
  ),

  // Or compose multiple validations
  composeValidations(
    (props) =>
      props.age >= 18
        ? Effect.succeed(props)
        : Effect.fail(
            ValidationException.new('UNDERAGE', 'Must be 18 or older'),
          ),
    (props) =>
      props.termsAccepted
        ? Effect.succeed(props)
        : Effect.fail(
            ValidationException.new('TERMS_NOT_ACCEPTED', 'Must accept terms'),
          ),
  ),

  buildEntity,
);
```

### Integration with Existing Traits

The functional builder preserves all existing trait functionality:

```typescript
const user = yield * UserTrait.new({ name: 'John', email: 'john@example.com' });

// Existing trait methods still work
console.log(EntityGenericTrait.getTag(user)); // "User"
console.log(EntityGenericTrait.getId(user)); // user.id
const updated = EntityGenericTrait.markUpdated(user);

// Plus new functional builder methods
console.log(user.isActive()); // true
console.log(user.getDisplayName()); // "John (john@example.com)"

// Commands use existing infrastructure
const activatedUser = yield * UserTrait.activate()(user);
```

## Migration from Manual Traits

If you have existing domain models created manually, you can migrate them gradually:

### Before (Manual Trait Creation)

```typescript
const UserPropsParser = (raw: UserInput) => {
  // Manual validation logic
  return Effect.succeed({
    name: raw.name.trim(),
    email: raw.email.toLowerCase(),
    isActive: true,
    registeredAt: new Date(),
  });
};

const UserTrait = EntityGenericTrait.createEntityTrait(UserPropsParser, 'User');

// Manually add commands
UserTrait.activate = EntityGenericTrait.asCommand((_, props) =>
  Effect.succeed({ ...props, isActive: true }),
);
```

### After (Functional Builder)

```typescript
const UserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withNew((input: UserInput) =>
    Effect.succeed({
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      isActive: true,
      registeredAt: new Date(),
    }),
  ),
  withCommand('activate', (_, props) =>
    Effect.succeed({ ...props, isActive: true }),
  ),
  withQueries({
    isActive: (props) => props.isActive,
    getDisplayName: (props) => `${props.name} (${props.email})`,
  }),
  buildEntity,
);
```

## Best Practices

### 1. Use Descriptive Query Names

```typescript
// Good
withQueries({
  canBeCancelled: (props) => props.status === 'pending',
  getDaysUntilExpiry: (props) => calculateDaysUntil(props.expiryDate),
  isEligibleForDiscount: (props) => props.totalPurchases > 1000,
}),

// Avoid
withQueries({
  check: (props) => props.status === 'pending',
  days: (props) => calculateDaysUntil(props.expiryDate),
  discount: (props) => props.totalPurchases > 1000,
}),
```

### 2. Keep Commands Focused

```typescript
// Good - single responsibility
withCommands({
  updateEmail: (newEmail, props) => updateEmailLogic(newEmail, props),
  updateName: (newName, props) => updateNameLogic(newName, props),
  activate: (_, props) => Effect.succeed({ ...props, isActive: true }),
}),

// Avoid - doing too much in one command
withCommand('updateProfile', (data, props) => {
  // Don't update multiple unrelated fields in one command
}),
```

### 3. Use Type-Safe Input Types

```typescript
// Good - specific input type
type UserCreationInput = {
  name: string;
  email: string;
  birthDate: Date;
};

const UserTrait = pipe(
  createEntity<UserProps, UserCreationInput>('User'),
  withNew((input: UserCreationInput) => {
    // Input is properly typed
    return Effect.succeed({
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      age: calculateAge(input.birthDate),
      registeredAt: new Date(),
    });
  }),
  buildEntity,
);
```

### 4. Group Related Functionality

```typescript
const OrderTrait = pipe(
  createAggregateRoot<OrderProps>('Order'),
  withSchema(OrderSchema),

  // Queries grouped by concern
  withQueries({
    // Status queries
    isConfirmed: (props) => props.status === 'confirmed',
    canBeModified: (props) => props.status === 'draft',

    // Financial queries
    getSubtotal: (props) => calculateSubtotal(props.items),
    getTaxAmount: (props) => calculateTax(props.items),

    // Item queries
    getItemCount: (props) => props.items.length,
    isEmpty: (props) => props.items.length === 0,
  }),

  // Commands grouped by domain
  withAggregateCommands({
    // Item management
    addItem: addItemCommand,
    removeItem: removeItemCommand,

    // Order lifecycle
    confirm: confirmOrderCommand,
    cancel: cancelOrderCommand,
    ship: shipOrderCommand,
  }),

  buildAggregateRoot,
);
```

This functional approach provides a more declarative and composable way to build domain models while maintaining full compatibility with the existing trait infrastructure.

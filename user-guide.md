# Effect Domain Model API Documentation

This document provides comprehensive documentation for the Effect-based domain modeling library located in `src/model/effect`. The library implements Domain-Driven Design patterns using Effect's functional programming capabilities with a railway-oriented style.

## Table of Contents

1. [Core Concepts](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#core-concepts)
2. [Domain Model](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#domain-model)
3. [Value Objects](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#value-objects)
4. [Entities](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#entities)
5. [Aggregate Roots](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#aggregate-roots)
6. [Domain Events](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#domain-events)
7. [Repositories](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#repositories)
8. [Validation & Exceptions](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#validation--exceptions)
9. [Complete Examples](https://claude.ai/chat/ac9f1dff-574d-4bb7-be73-806f31e28ec5#complete-examples)

## Core Concepts

The library follows these principles:

- **Railway-oriented programming**: All operations return Effect monads
- **Immutability**: All domain objects are immutable
- **Type safety**: Extensive use of branded types and schemas
- **Composability**: Traits and generic interfaces enable reuse

## Domain Model

### Base Types and Interfaces

```typescript
// Base domain model type
type DomainModel<Props> = {
  readonly _tag: string; // Type identifier
  readonly props: Props; // Domain properties
  readonly createdAt: Date; // Creation timestamp
};

// Domain model trait for parsing and creation
interface DomainModelTrait<D extends DomainModel, NewParams, ParseParams> {
  parse: Parser<D, ParseParams>;
  new: Parser<D, NewParams>;
}
```

### GenericDomainModelTrait

The `GenericDomainModelTrait` provides core functionality for all domain models. It's the foundation that other traits (Entity, ValueObject, Aggregate) build upon.

#### Available Methods

##### 1. `getTag(domainModel): string`

Retrieves the type identifier of a domain model.

typescript

```typescript
import { pipe } from 'effect';
import { GenericDomainModelTrait } from 'yl-ddd-ts';

const user = { _tag: 'User', props: { name: 'John' }, createdAt: new Date() };
const tag = GenericDomainModelTrait.getTag(user); // 'User'
```

##### 2. `unpack<T extends DomainModel>(domainModel): GetProps<T>`

Extracts the properties from a domain model.

typescript

```typescript
const userProps = GenericDomainModelTrait.unpack(user);
// { name: 'John' }

// Usage in pipelines
pipe(user, GenericDomainModelTrait.unpack, (props) => console.log(props.name));
```

##### 3. `parsingProps<I, T extends DomainModel>(raw): ParseResult<T['props']>`

Default props parser - typically overridden by specific implementations.

typescript

```typescript
// This is the base implementation that just passes through
pipe(
  { name: 'John', age: 30 },
  GenericDomainModelTrait.parsingProps,
  Effect.match({
    onFailure: (error) => console.error(error),
    onSuccess: (props) => console.log(props),
  }),
);
```

##### 4. `createDomainModelTrait<I, N, DM>(propsParsing, tag): DomainModelTrait<DM, N, I>`

Factory function to create domain model traits with custom parsing logic.

typescript

```typescript
import { Effect, pipe, Schema } from 'effect';
import { GenericDomainModelTrait, NonEmptyString } from 'yl-ddd-ts';

// Define a custom domain model
type Product = DomainModel<{
  name: NonEmptyString;
  price: PositiveNumber;
  inStock: boolean;
}>;

// Create the trait
const ProductTrait = GenericDomainModelTrait.createDomainModelTrait
  { name: string; price: number; inStock: boolean; createdAt: Date },
  { name: string; price: number },
  Product
>(
  // Props parser
  (input) => pipe(
    Effect.all({
      name: Schema.decode(NonEmptyString)(input.name),
      price: Schema.decode(PositiveNumber)(input.price),
      inStock: Effect.succeed(input.inStock ?? true)
    })
  ),
  'Product'
);

// Usage
pipe(
  ProductTrait.new({ name: 'Laptop', price: 999 }),
  Effect.match({
    onFailure: error => console.error('Failed:', error),
    onSuccess: product => console.log('Created:', product)
  })
);
```

##### 5. `asQuery<DM, R>(queryLogic): QueryOnModel<DM, R>`

Creates a query function that extracts information from a domain model using Effect.

typescript

```typescript
// Define queries
const getProductValue = GenericDomainModelTrait.asQuery<Product, number>(
  (props) => Effect.succeed(props.price * (props.inStock ? 1 : 0)),
);

const getProductInfo = GenericDomainModelTrait.asQuery<Product, string>(
  (props, product) =>
    pipe(
      Effect.succeed(`${props.name} - $${props.price}`),
      Effect.tap(() =>
        Effect.sync(() => console.log('Queried at:', product.createdAt)),
      ),
    ),
);

// Use queries
pipe(
  product,
  getProductValue,
  Effect.match({
    onFailure: (error) => console.error(error),
    onSuccess: (value) => console.log('Product value:', value),
  }),
);

// Compose queries
const getProductReport = (product: Product) =>
  pipe(
    Effect.all({
      info: getProductInfo(product),
      value: getProductValue(product),
    }),
    Effect.map(({ info, value }) => ({
      summary: info,
      stockValue: value,
    })),
  );

// Define queries with pattern matching
const getProductStatus = GenericDomainModelTrait.asQuery<Product, string>(
  (props) =>
    pipe(props, (p) =>
      match(p)
        .with({ inStock: false }, () => Effect.succeed('OUT_OF_STOCK'))
        .with({ price: P.when((price) => price > 1000) }, () =>
          Effect.succeed('PREMIUM'),
        )
        .with({ category: 'FOOD' }, () => Effect.succeed('PERISHABLE'))
        .otherwise(() => Effect.succeed('AVAILABLE')),
    ),
);

const getDiscountedPrice = GenericDomainModelTrait.asQuery<Product, number>(
  (props) =>
    pipe(props.category, (cat) =>
      match(cat)
        .with('ELECTRONICS', () => Effect.succeed(props.price * 0.9))
        .with('CLOTHING', () => Effect.succeed(props.price * 0.8))
        .with('FOOD', () => Effect.succeed(props.price * 0.95))
        .exhaustive(),
    ),
);

// Calculate discount based on multiple conditions
const calculateDiscount = GenericDomainModelTrait.asQuery<Product, number>(
  (props) =>
    pipe(props, (p) =>
      match(p)
        .with(
          { category: 'ELECTRONICS', price: P.when((price) => price > 1000) },
          () => Effect.succeed(0.2),
        )
        .with(
          { category: 'ELECTRONICS', price: P.when((price) => price > 500) },
          () => Effect.succeed(0.1),
        )
        .with({ category: 'CLOTHING', inStock: true }, () =>
          Effect.succeed(0.15),
        )
        .otherwise(() => Effect.succeed(0)),
    ),
);
```

##### 6. `asQueryOpt<DM, R>(queryLogic): (dm: DM) => Option<R>`

Creates a query function that returns Option instead of Effect.

typescript

```typescript
import { Option, pipe } from 'effect';
import { match, P } from 'ts-pattern';

// Define optional queries
const getDiscountPercentage = GenericDomainModelTrait.asQueryOpt<
  Product,
  number
>((props) =>
  pipe(props, (p) =>
    match(p)
      .with(
        { price: P.when((price) => price > 1000), category: 'ELECTRONICS' },
        () => Option.some(20),
      )
      .with(
        { price: P.when((price) => price > 500), category: 'ELECTRONICS' },
        () => Option.some(10),
      )
      .with({ category: 'CLOTHING' }, () => Option.some(15))
      .otherwise(() => Option.none()),
  ),
);

const getWarning = GenericDomainModelTrait.asQueryOpt<Product, string>(
  (props) =>
    pipe(props, (p) =>
      match(p)
        .with({ inStock: false }, () => Option.some('Product is out of stock'))
        .with({ category: 'FOOD', price: P.when((price) => price < 5) }, () =>
          Option.some('Low margin product'),
        )
        .otherwise(() => Option.none()),
    ),
);
```

###

### Value Objects

Immutable objects representing domain concepts, identified by their attributes.

#### Base Types

```typescript
interface ValueObject<Props> extends DomainModel<Props> {}

interface ValueObjectTrait<VO, NewParam, ParseParam> {
  parse: (input: ParseParam) => ParseResult<VO>;
  new: (params: NewParam) => ParseResult<VO>;
}
```

### Creating Value Objects

Value objects are immutable objects identified by their attributes.

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  ValueObject,
  ValueObjectGenericTrait,
  NonEmptyString,
  URL,
} from 'yl-ddd-ts';

// Define the value object type
type Address = ValueObject<{
  street: NonEmptyString;
  city: NonEmptyString;
  postalCode: string;
}>;

// Define input type
type AddressInput = {
  street: string;
  city: string;
  postalCode: string;
};

// Create the trait
const AddressTrait = ValueObjectGenericTrait.createValueObjectTrait;
Address,
  AddressInput,
  AddressInput >
    ((input) =>
      pipe(
        Effect.all({
          street: Schema.decode(NonEmptyString)(input.street),
          city: Schema.decode(NonEmptyString)(input.city),
          postalCode: Effect.succeed(input.postalCode),
        }),
      ),
    'Address');

// Usage
pipe(
  AddressTrait.new({
    street: '123 Main St',
    city: 'New York',
    postalCode: '10001',
  }),
  Effect.match({
    onFailure: (error) => console.error('Validation failed:', error),
    onSuccess: (address) => console.log('Created address:', address),
  }),
);
```

### Pre-built Value Objects

The library provides several pre-built value objects:

```typescript
import { Schema, pipe, Effect } from 'effect';
import {
  NonEmptyString,
  Email,
  Username,
  PhoneNumber,
  URL,
  PositiveNumber,
} from 'yl-ddd-ts';

// NonEmptyString
pipe(
  Schema.decode(NonEmptyString)('Hello'),
  Effect.match({
    onFailure: (error) => console.error(error),
    onSuccess: (value) => console.log(value), // Branded string
  }),
);

// Email validation
pipe(
  Schema.decode(Email)('user@example.com'),
  Effect.match({
    onFailure: (error) => console.error('Invalid email'),
    onSuccess: (email) => console.log('Valid email:', email),
  }),
);

// Username (1-20 chars, alphanumeric with . and _)
pipe(
  Schema.decode(Username)('john_doe'),
  Effect.match({
    onFailure: (error) => console.error(error),
    onSuccess: (username) => console.log(username),
  }),
);

// URL validation
pipe(
  Schema.decode(URL)('https://example.com'),
  Effect.match({
    onFailure: (error) => console.error('Invalid URL'),
    onSuccess: (url) => console.log('Valid URL:', url),
  }),
);
```

### Complex Value Objects

```typescript
// Value object with nested value objects
type Money = ValueObject<{
  amount: PositiveNumber;
  currency: Currency;
}>;

type Currency = ValueObject<{
  code: string;
  symbol: string;
}>;

const CurrencyTrait = ValueObjectGenericTrait.createValueObjectTrait
  Currency,
  { code: string; symbol: string },
  { code: string; symbol: string }
>(
  (input) => pipe(
    Effect.all({
      code: pipe(
        input.code,
        Schema.decode(Schema.String.pipe(Schema.length(3))),
      ),
      symbol: Schema.decode(NonEmptyString)(input.symbol)
    })
  ),
  'Currency'
);

const MoneyTrait = ValueObjectGenericTrait.createValueObjectTrait
  Money,
  { amount: number; currency: Currency },
  { amount: number; currency: Currency }
>(
  (input) => pipe(
    Effect.all({
      amount: Schema.decode(PositiveNumber)(input.amount),
      currency: Effect.succeed(input.currency)
    })
  ),
  'Money'
);

// Usage with railway style
pipe(
  CurrencyTrait.new({ code: 'USD', symbol: '$' }),
  Effect.flatMap(currency =>
    MoneyTrait.new({ amount: 100, currency })
  ),
  Effect.match({
    onFailure: (error) => console.error('Failed to create money:', error),
    onSuccess: (money) => console.log('Created money:', money)
  })
);
```

### ValueObjectGenericTrait

The `ValueObjectGenericTrait` implements functionality specific to value objects - immutable objects identified by their attributes.

#### Available Methods

##### 1. `getTag(valueObject): string`

Inherited from GenericDomainModelTrait.

```typescript
const email = { _tag: 'Email', props: { value: 'test@example.com' } };
const tag = ValueObjectGenericTrait.getTag(email); // 'Email'
```

##### 2. `unpack<VO extends ValueObject>(valueObject): GetProps<VO>`

Extracts properties from a value object.

```typescript
const emailProps = ValueObjectGenericTrait.unpack(email);
// { value: 'test@example.com' }
```

##### 3. `isEqual<VO extends ValueObject>(vo1, vo2): boolean`

Compares two value objects for structural equality.

```typescript
const email1 = { _tag: 'Email', props: { value: 'test@example.com' } };
const email2 = { _tag: 'Email', props: { value: 'test@example.com' } };
const email3 = { _tag: 'Email', props: { value: 'other@example.com' } };

ValueObjectGenericTrait.isEqual(email1, email2); // true
ValueObjectGenericTrait.isEqual(email1, email3); // false

// Different types are never equal
const phone = { _tag: 'Phone', props: { value: '+1234567890' } };
ValueObjectGenericTrait.isEqual(email1, phone); // false
```

##### 4. `createValueObjectTrait<VO, N, P>(propsParser, tag): ValueObjectTrait<VO, N, P>`

Factory for creating value object traits with validation.

```typescript
import { Effect, pipe, Schema } from 'effect';
import { match, P } from 'ts-pattern';
import { ValueObjectGenericTrait, NonEmptyString } from 'yl-ddd-ts';

// Phone number value object with correct pattern matching
type PhoneNumber = ValueObject<{
  countryCode: string;
  number: string;
  type: PhoneType;
}>;

type PhoneType = 'MOBILE' | 'LANDLINE' | 'FAX';

// Railway style validators
const validateCountryCode = (
  code: string,
): Effect.Effect<string, ValidationException> =>
  pipe(code, (c) =>
    match(c)
      .with(P.string.regex(/^\+\d{1,3}$/), (code) => Effect.succeed(code))
      .otherwise((code) =>
        Effect.fail(
          ValidationException.new(
            'INVALID_COUNTRY_CODE',
            `Invalid country code: ${code}`,
          ),
        ),
      ),
  );

const validatePhoneType = (
  type: string,
): Effect.Effect<PhoneType, ValidationException> =>
  pipe(type.toUpperCase(), (t) =>
    match(t)
      .with(
        'MOBILE',
        (): Effect.Effect<PhoneType, ValidationException> =>
          Effect.succeed('MOBILE'),
      )
      .with('LANDLINE', () => Effect.succeed('LANDLINE'))
      .with('FAX', () => Effect.succeed('FAX'))
      .otherwise((type) =>
        Effect.fail(
          ValidationException.new(
            'INVALID_PHONE_TYPE',
            `Invalid phone type: ${type}`,
          ),
        ),
      ),
  );

const validatePhoneNumber = (
  number: string,
  type: PhoneType,
): Effect.Effect<string, ValidationException> =>
  pipe({ number, type }, (input) =>
    match(input)
      .with(
        { type: 'MOBILE', number: P.string.regex(/^\d{10}$/) },
        ({ number }) => Effect.succeed(number),
      )
      .with(
        {
          type: P.union('LANDLINE', 'FAX'),
          number: P.string.regex(/^\d{7,10}$/),
        },
        ({ number }) => Effect.succeed(number),
      )
      .otherwise(({ number, type }) =>
        Effect.fail(
          ValidationException.new(
            'INVALID_PHONE_NUMBER',
            `Invalid ${type} number: ${number}`,
          ),
        ),
      ),
  );

const PhoneNumberTrait = ValueObjectGenericTrait.createValueObjectTrait;
PhoneNumber,
  PhoneInput,
  PhoneInput >
    ((input) =>
      pipe(
        Effect.Do,
        Effect.bind('countryCode', () =>
          validateCountryCode(input.countryCode),
        ),
        Effect.bind('type', () => validatePhoneType(input.type)),
        Effect.bind('number', ({ type }) =>
          validatePhoneNumber(input.number, type),
        ),
      ),
    'PhoneNumber');
```

#### Advanced Value Object Patterns

##### Nested Value Objects

```typescript
type Money = ValueObject<{
  amount: PositiveNumber;
  currency: Currency;
}>;

type Currency = ValueObject<{
  code: CurrencyCode;
  symbol: string;
  decimals: number;
}>;

type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY';

// Currency configurations using pattern matching
const getCurrencyConfig = (code: string): Effect.Effect<Currency['props'], ValidationException> =>
  pipe(
    code.toUpperCase(),
    c => match(c)
      .with('USD', () => Effect.succeed({ code: 'USD' as CurrencyCode, symbol: '$', decimals: 2 }))
      .with('EUR', () => Effect.succeed({ code: 'EUR' as CurrencyCode, symbol: '€', decimals: 2 }))
      .with('GBP', () => Effect.succeed({ code: 'GBP' as CurrencyCode, symbol: '£', decimals: 2 }))
      .with('JPY', () => Effect.succeed({ code: 'JPY' as CurrencyCode, symbol: '¥', decimals: 0 }))
      .otherwise(code =>
        Effect.fail(
          ValidationException.new('INVALID_CURRENCY', `Unsupported currency: ${code}`)
        )
      )
  );

const CurrencyTrait = ValueObjectGenericTrait.createValueObjectTrait
  Currency,
  { code: string }
>(
  (input) => getCurrencyConfig(input.code),
  'Currency'
);

const MoneyTrait = ValueObjectGenericTrait.createValueObjectTrait
  Money,
  { amount: number; currencyCode: string }
>(
  (input) => pipe(
    Effect.Do,
    Effect.bind('amount', () => Schema.decode(PositiveNumber)(input.amount)),
    Effect.bind('currency', () =>
      CurrencyTrait.new({ code: input.currencyCode })
    )
  ),
  'Money'
);

// Money operations with pattern matching
const convertMoney = (
  money: Money,
  toCurrency: CurrencyCode,
  rate: number
): Effect.Effect<Money, ValidationException> =>
  pipe(
    ValueObjectGenericTrait.unpack(money),
    props => match({ from: props.currency.props.code, to: toCurrency })
      .with({ from: P._, to: P.when(to => to === props.currency.props.code) },
        () => Effect.succeed(money) // Same currency, no conversion
      )
      .otherwise(() =>
        MoneyTrait.new({
          amount: props.amount * rate,
          currencyCode: toCurrency
        })
      )
  );
```

##### Value Object Collections

```typescript
type EmailList = ValueObject<{
  primary: Email;
  secondary: Email[];
  maxEmails: number;
}>;

const EmailListTrait = ValueObjectGenericTrait.createValueObjectTrait
  EmailList,
  { primary: string; secondary: string[] }
>(
  (input) => pipe(
    Effect.all({
      primary: Schema.decode(Email)(input.primary),
      secondary: Effect.forEach(
        input.secondary,
        email => Schema.decode(Email)(email)
      )
    }),
    Effect.flatMap(({ primary, secondary }) => {
      const total = 1 + secondary.length;
      const maxEmails = 5;

      if (total > maxEmails) {
        return Effect.fail(
          ValidationException.new(
            'TOO_MANY_EMAILS',
            `Cannot have more than ${maxEmails} emails`
          )
        );
      }

      // Check for duplicates
      const allEmails = [primary, ...secondary];
      const uniqueEmails = new Set(allEmails.map(e => e));

      if (uniqueEmails.size !== allEmails.length) {
        return Effect.fail(
          ValidationException.new(
            'DUPLICATE_EMAILS',
            'Email addresses must be unique'
          )
        );
      }

      return Effect.succeed({ primary, secondary, maxEmails });
    })
  ),
  'EmailList'
);
```

## Entities

### Creating Entities

Entities are domain objects with identity that can change over time.

```typescript
import { Effect, pipe, Option, Schema } from 'effect';
import {
  Entity,
  EntityGenericTrait,
  Identifier,
  NonEmptyString,
  Email,
} from 'yl-ddd-ts';

// Define entity type
type User = Entity<{
  name: NonEmptyString;
  email: Email;
  isActive: boolean;
}>;

// Define input types
type CreateUserInput = {
  name: string;
  email: string;
};

type UpdateUserInput = {
  name?: string;
  email?: string;
  isActive?: boolean;
};

// Create the entity trait
const UserTrait = EntityGenericTrait.createEntityTrait;
User,
  CreateUserInput,
  CreateUserInput >
    ((input) =>
      pipe(
        Effect.all({
          name: Schema.decode(NonEmptyString)(input.name),
          email: Schema.decode(Email)(input.email),
          isActive: Effect.succeed(true),
        }),
      ),
    'User',
    { autoGenId: true }); // Auto-generate UUID if not provided

// Create commands
const activateUser = EntityGenericTrait.asCommand<User, void>((_, props) =>
  Effect.succeed({
    props: { ...props, isActive: true },
  }),
);

const updateEmail = EntityGenericTrait.asCommand<User, string>(
  (newEmail, props) =>
    pipe(
      Schema.decode(Email)(newEmail),
      Effect.map((email) => ({
        props: { ...props, email },
      })),
    ),
);

// Usage
pipe(
  UserTrait.new({ name: 'John Doe', email: 'john@example.com' }),
  Effect.flatMap((user) =>
    pipe(
      user,
      updateEmail('john.doe@example.com'),
      Effect.map((updatedUser) => {
        console.log('Updated user:', updatedUser);
        console.log('Updated at:', Option.getOrNull(updatedUser.updatedAt));
        return updatedUser;
      }),
    ),
  ),
  Effect.runPromise,
);
```

### Entity Lifecycle

```typescript
// Entity lifecycle tracking
const user = await pipe(
  UserTrait.new({ name: 'John', email: 'john@example.com' }),
  Effect.runPromise,
);

console.log('ID:', EntityGenericTrait.getId(user));
console.log('Created at:', EntityGenericTrait.getCreatedAt(user));
console.log('Updated at:', EntityGenericTrait.getUpdatedAt(user)); // Option<Date>

// Mark as updated
const updatedUser = EntityGenericTrait.markUpdated(user);
console.log('Now updated at:', Option.getOrNull(updatedUser.updatedAt));
```

### EntityGenericTrait

The `EntityGenericTrait` extends domain model functionality with identity and mutability support.

#### Available Methods

##### 1. `getId<E extends Entity>(entity): Identifier`

Gets the unique identifier of an entity.

```typescript
const userId = EntityGenericTrait.getId(user); // UUID string
```

##### 2. `getCreatedAt<E extends Entity>(entity): Date`

Gets the creation timestamp.

```typescript
const createdAt = EntityGenericTrait.getCreatedAt(user); // Date object
```

##### 3. `getUpdatedAt<E extends Entity>(entity): Option<Date>`

Gets the optional update timestamp.

```typescript
pipe(
  EntityGenericTrait.getUpdatedAt(user),
  Option.match({
    onNone: () => console.log('Never updated'),
    onSome: (date) => console.log('Last updated:', date),
  }),
);
```

##### 4. `markUpdated<E extends Entity>(entity): E`

Marks an entity as updated with current timestamp.

```typescript
const updatedUser = EntityGenericTrait.markUpdated(user);
// updatedAt is now Some(new Date())
```

##### 5. `isEqual<E extends Entity>(entity1, entity2): boolean`

Compares entities by type and ID (not by properties).

```typescript
const user1 = { _tag: 'User', id: '123', props: { name: 'John' } };
const user2 = { _tag: 'User', id: '123', props: { name: 'Jane' } };
const user3 = { _tag: 'User', id: '456', props: { name: 'John' } };

EntityGenericTrait.isEqual(user1, user2); // true (same ID)
EntityGenericTrait.isEqual(user1, user3); // false (different ID)
```

##### 6. `createEntityTrait<E, N, P>(propsParser, tag, options?): EntityTrait<E, N, P>`

Creates an entity trait with lifecycle management.

```typescript
import { Effect, pipe, Option, Schema } from 'effect';
import { match, P } from 'ts-pattern';

// Entity with state machine using pattern matching
type Order = Entity<{
  orderNumber: NonEmptyString;
  items: OrderItem[];
  status: OrderStatus;
  total: Money;
}>;

type OrderStatus =
  | { type: 'DRAFT' }
  | { type: 'CONFIRMED'; confirmedAt: Date }
  | { type: 'PAID'; confirmedAt: Date; paidAt: Date }
  | { type: 'SHIPPED'; confirmedAt: Date; paidAt: Date; shippedAt: Date }
  | { type: 'CANCELLED'; reason: string; cancelledAt: Date };

const OrderTrait = EntityGenericTrait.createEntityTrait;
Order,
  { orderNumber: string } >
    ((input) =>
      pipe(
        Effect.all({
          orderNumber: Schema.decode(NonEmptyString)(input.orderNumber),
          items: Effect.succeed([]),
          status: Effect.succeed<OrderStatus>({ type: 'DRAFT' }),
          total: MoneyTrait.new({ amount: 0, currencyCode: 'USD' }),
        }),
      ),
    'Order');

// Commands with pattern matching for state transitions
const confirmOrder = EntityGenericTrait.asCommand<Order, void>((_, props) =>
  pipe(props.status, (status) =>
    match(status)
      .with({ type: 'DRAFT' }, () =>
        pipe(props.items.length, (len) =>
          match(len)
            .with(0, () =>
              Effect.fail(
                ValidationException.new(
                  'EMPTY_ORDER',
                  'Cannot confirm empty order',
                ),
              ),
            )
            .otherwise(() =>
              Effect.succeed({
                props: {
                  ...props,
                  status: {
                    type: 'CONFIRMED' as const,
                    confirmedAt: new Date(),
                  },
                },
              }),
            ),
        ),
      )
      .otherwise((s) =>
        Effect.fail(
          ValidationException.new(
            'INVALID_TRANSITION',
            `Cannot confirm order in ${s.type} status`,
          ),
        ),
      ),
  ),
);

const payOrder = EntityGenericTrait.asCommand<Order, { paymentMethod: string }>(
  (input, props) =>
    pipe(props.status, (status) =>
      match(status)
        .with({ type: 'CONFIRMED' }, ({ confirmedAt }) =>
          Effect.succeed({
            props: {
              ...props,
              status: {
                type: 'PAID' as const,
                confirmedAt,
                paidAt: new Date(),
              },
            },
          }),
        )
        .otherwise((s) =>
          Effect.fail(
            ValidationException.new(
              'INVALID_TRANSITION',
              `Cannot pay order in ${s.type} status`,
            ),
          ),
        ),
    ),
);

const shipOrder = EntityGenericTrait.asCommand<
  Order,
  { trackingNumber: string }
>((input, props) =>
  pipe(props.status, (status) =>
    match(status)
      .with({ type: 'PAID' }, ({ confirmedAt, paidAt }) =>
        Effect.succeed({
          props: {
            ...props,
            status: {
              type: 'SHIPPED' as const,
              confirmedAt,
              paidAt,
              shippedAt: new Date(),
            },
          },
        }),
      )
      .otherwise((s) =>
        Effect.fail(
          ValidationException.new(
            'INVALID_TRANSITION',
            `Cannot ship order in ${s.type} status`,
          ),
        ),
      ),
  ),
);
```

##### 7. `asCommand<E, I>(reducerLogic): (input: I) => CommandOnModel<E>`

Creates commands that modify entity state.

```typescript
// Define multiple commands
const updateProfile = EntityGenericTrait.asCommand<
  UserProfile,
  {
    bio?: string;
    avatar?: string;
    theme?: 'light' | 'dark';
  }
>((input, props) =>
  pipe(
    Effect.all({
      bio: input.bio
        ? pipe(
            Schema.decode(NonEmptyString)(input.bio),
            Effect.map(Option.some),
          )
        : Effect.succeed(props.profile.bio),
      avatar: input.avatar
        ? pipe(Schema.decode(URL)(input.avatar), Effect.map(Option.some))
        : Effect.succeed(props.profile.avatar),
    }),
    Effect.map(({ bio, avatar }) => ({
      props: {
        ...props,
        profile: {
          ...props.profile,
          bio,
          avatar,
          preferences: {
            ...props.profile.preferences,
            theme: input.theme || props.profile.preferences.theme,
          },
        },
      },
    })),
  ),
);

const recordLogin = EntityGenericTrait.asCommand<UserProfile, void>(
  (_, props) =>
    Effect.succeed({
      props: {
        ...props,
        lastLoginAt: Option.some(new Date()),
      },
    }),
);

const suspendUser = EntityGenericTrait.asCommand<UserProfile, string>(
  (reason, props) => {
    if (props.status === 'DELETED') {
      return Effect.fail(
        ValidationException.new(
          'INVALID_STATUS',
          'Cannot suspend deleted user',
        ),
      );
    }

    return Effect.succeed({
      props: {
        ...props,
        status: 'SUSPENDED' as UserStatus,
      },
    });
  },
);

// Chain commands
const loginAndUpdateProfile = (
  user: UserProfile,
  profileData: { bio: string; theme: 'light' | 'dark' },
) =>
  pipe(
    user,
    recordLogin(),
    Effect.flatMap((user) => updateProfile(profileData)(user)),
    Effect.tap((user) =>
      Effect.sync(() => console.log('User logged in and updated:', user.id)),
    ),
  );
```

#### Advanced Entity Patterns

##### Entity with Business Rules

```typescript
type BankAccount = Entity<{
  accountNumber: NonEmptyString;
  balance: number;
  currency: Currency;
  isActive: boolean;
  overdraftLimit: number;
  transactions: Transaction[];
}>;

const BankAccountTrait = EntityGenericTrait.createEntityTrait<BankAccount>(
  (input) =>
    pipe(
      // Validate input...
      Effect.succeed(validatedProps),
      // Apply business rules
      Effect.flatMap((props) => {
        if (
          props.balance < 0 &&
          Math.abs(props.balance) > props.overdraftLimit
        ) {
          return Effect.fail(
            ValidationException.new(
              'OVERDRAFT_EXCEEDED',
              'Initial balance exceeds overdraft limit',
            ),
          );
        }
        return Effect.succeed(props);
      }),
    ),
  'BankAccount',
);

// Commands with business logic
const withdraw = EntityGenericTrait.asCommand<
  BankAccount,
  {
    amount: number;
    description: string;
  }
>((input, props, account) => {
  if (!props.isActive) {
    return Effect.fail(
      ValidationException.new('ACCOUNT_INACTIVE', 'Account is not active'),
    );
  }

  const newBalance = props.balance - input.amount;

  if (newBalance < 0 && Math.abs(newBalance) > props.overdraftLimit) {
    return Effect.fail(
      ValidationException.new(
        'INSUFFICIENT_FUNDS',
        `Withdrawal would exceed overdraft limit of ${props.overdraftLimit}`,
      ),
    );
  }

  const transaction: Transaction = {
    id: IdentifierTrait.uuid(),
    type: 'WITHDRAWAL',
    amount: input.amount,
    description: input.description,
    timestamp: new Date(),
    balanceAfter: newBalance,
  };

  return Effect.succeed({
    props: {
      ...props,
      balance: newBalance,
      transactions: [...props.transactions, transaction],
    },
  });
});
```

###### Entity State Machines

```typescript
type OrderState =
  | { status: 'DRAFT'; items: OrderItem[] }
  | { status: 'CONFIRMED'; items: OrderItem[]; confirmedAt: Date }
  | {
      status: 'SHIPPED';
      items: OrderItem[];
      confirmedAt: Date;
      shippedAt: Date;
    }
  | {
      status: 'CANCELLED';
      items: OrderItem[];
      cancelledAt: Date;
      reason: string;
    };

type StatefulOrder = Entity<OrderState>;

// State transition commands
const confirmOrder = EntityGenericTrait.asCommand<StatefulOrder, void>(
  (_, props) => {
    if (props.status !== 'DRAFT') {
      return Effect.fail(
        ValidationException.new(
          'INVALID_TRANSITION',
          `Cannot confirm order in ${props.status} status`,
        ),
      );
    }

    if (props.items.length === 0) {
      return Effect.fail(
        ValidationException.new('EMPTY_ORDER', 'Cannot confirm empty order'),
      );
    }

    return Effect.succeed({
      props: {
        status: 'CONFIRMED' as const,
        items: props.items,
        confirmedAt: new Date(),
      },
    });
  },
);
```

##### Entity with Permission System

```typescript
type UserAccount = Entity<{
  username: Username;
  email: Email;
  role: UserRole;
  permissions: Set<Permission>;
  status: AccountStatus;
}>;

type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'GUEST';
type Permission =
  | 'READ'
  | 'WRITE'
  | 'DELETE'
  | 'MANAGE_USERS'
  | 'MANAGE_SYSTEM';
type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';

// Permission calculation with pattern matching
const calculatePermissions = (role: UserRole): Set<Permission> =>
  match(role)
    .with(
      'ADMIN',
      () =>
        new Set<Permission>([
          'READ',
          'WRITE',
          'DELETE',
          'MANAGE_USERS',
          'MANAGE_SYSTEM',
        ]),
    )
    .with(
      'MANAGER',
      () => new Set<Permission>(['READ', 'WRITE', 'DELETE', 'MANAGE_USERS']),
    )
    .with('USER', () => new Set<Permission>(['READ', 'WRITE']))
    .with('GUEST', () => new Set<Permission>(['READ']))
    .exhaustive();

// Role change validation with pattern matching
const canChangeRole = (
  currentRole: UserRole,
  newRole: UserRole,
  changerRole: UserRole,
): Effect.Effect<void, ValidationException> =>
  pipe({ current: currentRole, new: newRole, changer: changerRole }, (roles) =>
    match(roles)
      .with({ changer: 'ADMIN' }, () => Effect.void) // Admin can change any role
      .with(
        { changer: 'MANAGER', new: P.union('USER', 'GUEST') },
        () => Effect.void, // Manager can only assign USER or GUEST
      )
      .otherwise(({ changer, new: newRole }) =>
        Effect.fail(
          ValidationException.new(
            'INSUFFICIENT_PERMISSIONS',
            `${changer} cannot assign ${newRole} role`,
          ),
        ),
      ),
  );

const changeRole = EntityGenericTrait.asCommand<
  UserAccount,
  {
    newRole: UserRole;
    changedBy: UserRole;
  }
>((input, props) =>
  pipe(props.status, (status) =>
    match(status)
      .with('DELETED', () =>
        Effect.fail(
          ValidationException.new(
            'INVALID_STATUS',
            'Cannot modify deleted account',
          ),
        ),
      )
      .otherwise(() =>
        pipe(
          canChangeRole(props.role, input.newRole, input.changedBy),
          Effect.map(() => ({
            props: {
              ...props,
              role: input.newRole,
              permissions: calculatePermissions(input.newRole),
            },
          })),
        ),
      ),
  ),
);
```

## Aggregate Roots

### Creating Aggregate Roots

Aggregate roots are entities that maintain consistency boundaries and emit domain events.

```typescript
import { Effect, pipe } from 'effect';
import { match, P } from 'ts-pattern';

// Shopping cart aggregate with events
type ShoppingCart = AggregateRoot<{
  customerId: CustomerId;
  items: CartItem[];
  status: CartStatus;
  totalAmount: Money;
}>;

type CartStatus = 'ACTIVE' | 'EXPIRED' | 'CHECKED_OUT' | 'ABANDONED';

type CartItem = {
  productId: Identifier;
  quantity: PositiveNumber;
  price: Money;
  addedAt: Date;
};

const ShoppingCartTrait = AggGenericTrait.createAggregateRootTrait;
ShoppingCart,
  { customerId: string } >
    ((input) =>
      pipe(
        Effect.all({
          customerId: Schema.decode(Identifier)(input.customerId),
          items: Effect.succeed([]),
          status: Effect.succeed<CartStatus>('ACTIVE'),
          totalAmount: MoneyTrait.new({ amount: 0, currencyCode: 'USD' }),
        }),
      ),
    'ShoppingCart');

// Add item with pattern matching
const addToCart = AggGenericTrait.asCommand<
  ShoppingCart,
  {
    productId: string;
    quantity: number;
    price: number;
  }
>((input, props, cart, correlationId) =>
  pipe(props.status, (status) =>
    match(status)
      .with('ACTIVE', () =>
        pipe(
          Effect.Do,
          Effect.bind('productId', () =>
            Schema.decode(Identifier)(input.productId),
          ),
          Effect.bind('quantity', () =>
            Schema.decode(PositiveNumber)(input.quantity),
          ),
          Effect.bind('price', () =>
            MoneyTrait.new({
              amount: input.price,
              currency: props.totalAmount.props.currency,
            }),
          ),
          Effect.bind('existingItem', ({ productId }) =>
            Effect.succeed(
              props.items.find((item) => item.productId === productId),
            ),
          ),
          Effect.flatMap(({ productId, quantity, price, existingItem }) =>
            pipe(existingItem, (existing) =>
              match(existing)
                .with(P.nullish, () =>
                  // New item
                  pipe(
                    Effect.Do,
                    Effect.bind('newItem', () =>
                      Effect.succeed({
                        productId,
                        quantity,
                        price,
                        addedAt: new Date(),
                      }),
                    ),
                    Effect.bind('newTotal', () =>
                      MoneyTrait.new({
                        amount:
                          props.totalAmount.props.amount +
                          quantity * price.props.amount,
                        currencyCode:
                          props.totalAmount.props.currency.props.code,
                      }),
                    ),
                    Effect.map(({ newItem, newTotal }) => ({
                      props: {
                        ...props,
                        items: [...props.items, newItem],
                        totalAmount: newTotal,
                      },
                      domainEvents: [
                        DomainEventTrait.create({
                          name: 'ITEM_ADDED_TO_CART',
                          payload: {
                            cartId: cart.id,
                            productId,
                            quantity,
                            price: price.props.amount,
                          },
                          correlationId,
                          aggregate: cart,
                        }),
                      ],
                    })),
                  ),
                )
                .otherwise((existing) =>
                  // Update existing item
                  pipe(
                    Effect.Do,
                    Effect.bind('updatedItems', () =>
                      Effect.succeed(
                        props.items.map((item) =>
                          item.productId === productId
                            ? { ...item, quantity: item.quantity + quantity }
                            : item,
                        ),
                      ),
                    ),
                    Effect.bind('newTotal', () =>
                      MoneyTrait.new({
                        amount:
                          props.totalAmount.props.amount +
                          quantity * price.props.amount,
                        currencyCode:
                          props.totalAmount.props.currency.props.code,
                      }),
                    ),
                    Effect.map(({ updatedItems, newTotal }) => ({
                      props: {
                        ...props,
                        items: updatedItems,
                        totalAmount: newTotal,
                      },
                      domainEvents: [
                        DomainEventTrait.create({
                          name: 'CART_ITEM_QUANTITY_UPDATED',
                          payload: {
                            cartId: cart.id,
                            productId,
                            newQuantity: existing.quantity + quantity,
                          },
                          correlationId,
                          aggregate: cart,
                        }),
                      ],
                    })),
                  ),
                ),
            ),
          ),
        ),
      )
      .otherwise((s) =>
        Effect.fail(
          ValidationException.new(
            'CART_NOT_ACTIVE',
            `Cannot add items to ${s} cart`,
          ),
        ),
      ),
  ),
);

// Checkout with complex validation
const checkout = AggGenericTrait.asCommand<
  ShoppingCart,
  {
    paymentMethod: PaymentMethod;
    shippingAddress: Address;
  }
>((input, props, cart, correlationId) =>
  pipe({ status: props.status, itemCount: props.items.length }, (state) =>
    match(state)
      .with({ status: P.not('ACTIVE') }, ({ status }) =>
        Effect.fail(
          ValidationException.new(
            'INVALID_STATUS',
            `Cannot checkout ${status} cart`,
          ),
        ),
      )
      .with({ itemCount: 0 }, () =>
        Effect.fail(
          ValidationException.new('EMPTY_CART', 'Cannot checkout empty cart'),
        ),
      )
      .otherwise(() =>
        Effect.succeed({
          props: {
            ...props,
            status: 'CHECKED_OUT' as CartStatus,
          },
          domainEvents: [
            DomainEventTrait.create({
              name: 'CART_CHECKED_OUT',
              payload: {
                cartId: cart.id,
                customerId: props.customerId,
                totalAmount: props.totalAmount.props.amount,
                itemCount: props.items.length,
                paymentMethod: input.paymentMethod,
                shippingAddress: ValueObjectGenericTrait.unpack(
                  input.shippingAddress,
                ),
              },
              correlationId,
              aggregate: cart,
            }),
          ],
        }),
      ),
  ),
);
```

### Working with Domain Events

```typescript
// Clear events after publishing
const clearEvents = <A extends AggregateRoot>(aggregate: A): A =>
  AggGenericTrait.clearEvents(aggregate);

// Add single event
const withEvent = AggGenericTrait.addDomainEvent(event)(aggregate);

// Add multiple events
const withEvents = AggGenericTrait.addDomainEvents(events)(aggregate);

// Get all events
const events = AggGenericTrait.getDomainEvents(aggregate);
```

### AggGenericTrait

The `AggGenericTrait` extends entity functionality with domain event support.

#### Available Methods

##### 1. All EntityGenericTrait methods

Inherits all methods from EntityGenericTrait.

##### 2. `getDomainEvents<A extends AggregateRoot>(aggregate): ReadonlyArray<IDomainEvent>`

Gets all domain events from an aggregate.

```typescript
const events = AggGenericTrait.getDomainEvents(order);
console.log(`Order has ${events.length} pending events`);
```

##### 3. `clearEvents<A extends AggregateRoot>(aggregate): A`

Removes all domain events from an aggregate.

```typescript
const clearedOrder = AggGenericTrait.clearEvents(order);
// clearedOrder.domainEvents is now []
```

##### 4. `addDomainEvent<A extends AggregateRoot>(event): (aggregate: A) => A`

Adds a single domain event.

```typescript
const event = DomainEventTrait.create({
  name: 'ORDER_UPDATED',
  payload: { orderId: order.id },
  correlationId: IdentifierTrait.uuid(),
});

const orderWithEvent = pipe(order, AggGenericTrait.addDomainEvent(event));
```

##### 5. `addDomainEvents<A extends AggregateRoot>(events): (aggregate: A) => A`

Adds multiple domain events.

```typescript
const events = [
  DomainEventTrait.create({
    name: 'ITEM_ADDED',
    payload: { itemId: '123' },
    correlationId,
  }),
  DomainEventTrait.create({
    name: 'PRICE_UPDATED',
    payload: { newTotal: 150 },
    correlationId,
  }),
];

const orderWithEvents = pipe(order, AggGenericTrait.addDomainEvents(events));
```

##### 6. `createAggregateRootTrait<A, N, P>(propsParser, tag, options?): AggregateRootTrait<A, N, P>`

Creates an aggregate root trait.

```typescript
// Complex aggregate example
type ShoppingCart = AggregateRoot<{
  customerId: CustomerId;
  items: CartItem[];
  appliedCoupons: Coupon[];
  totalAmount: Money;
  expiresAt: Date;
  status: CartStatus;
}>;

type CartStatus = 'ACTIVE' | 'EXPIRED' | 'CHECKED_OUT';

const ShoppingCartTrait = AggGenericTrait.createAggregateRootTrait
  ShoppingCart,
  { customerId: string; expiresInHours?: number }
>(
  (input) => pipe(
    Effect.all({
      customerId: Schema.decode(Identifier)(input.customerId),
      items: Effect.succeed([]),
      appliedCoupons: Effect.succeed([]),
      totalAmount: MoneyTrait.new({ amount: 0, currency: 'USD' }),
      expiresAt: Effect.succeed(
        new Date(Date.now() + (input.expiresInHours || 24) * 60 * 60 * 1000)
      ),
      status: Effect.succeed<CartStatus>('ACTIVE')
    })
  ),
  'ShoppingCart'
);
```

##### 7. `asCommand<A, I>(reducerLogic): (input: I) => CommandOnModel<A>`

Creates commands that modify state and emit events.

```typescript
// Commands with domain events
const addToCart = AggGenericTrait.asCommand<
  ShoppingCart,
  {
    productId: string;
    quantity: number;
    price: number;
  }
>((input, props, cart, correlationId) =>
  pipe(
    // Validate input
    Effect.all({
      productId: Schema.decode(Identifier)(input.productId),
      quantity: Schema.decode(PositiveNumber)(input.quantity),
      price: Schema.decode(PositiveNumber)(input.price),
    }),
    // Check business rules
    Effect.flatMap(({ productId, quantity, price }) => {
      if (props.status !== 'ACTIVE') {
        return Effect.fail(
          ValidationException.new('CART_NOT_ACTIVE', 'Cart is not active'),
        );
      }

      if (new Date() > props.expiresAt) {
        return Effect.fail(
          ValidationException.new('CART_EXPIRED', 'Cart has expired'),
        );
      }

      // Check if item already exists
      const existingItem = props.items.find(
        (item) => item.productId === productId,
      );

      const newItems = existingItem
        ? props.items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [
            ...props.items,
            {
              id: IdentifierTrait.uuid(),
              productId,
              quantity,
              price,
              addedAt: new Date(),
            },
          ];

      // Calculate new total
      const itemTotal = quantity * price;
      const newTotalAmount = props.totalAmount.props.amount + itemTotal;

      return pipe(
        MoneyTrait.new({
          amount: newTotalAmount,
          currency: props.totalAmount.props.currency,
        }),
        Effect.map((totalAmount) => ({
          items: newItems,
          totalAmount,
          eventType: existingItem ? 'ITEM_QUANTITY_UPDATED' : 'ITEM_ADDED',
        })),
      );
    }),
    // Return new state with events
    Effect.map(({ items, totalAmount, eventType }) => ({
      props: {
        ...props,
        items,
        totalAmount,
      },
      domainEvents: [
        DomainEventTrait.create({
          name: eventType,
          payload: {
            cartId: cart.id,
            productId: input.productId,
            quantity: input.quantity,
            newTotal: totalAmount.props.amount,
          },
          correlationId,
          aggregate: cart,
        }),
      ],
    })),
  ),
);

const applyCoupon = AggGenericTrait.asCommand<
  ShoppingCart,
  {
    code: string;
    discount: number;
    type: 'PERCENTAGE' | 'FIXED';
  }
>((input, props, cart, correlationId) => {
  // Check if coupon already applied
  if (props.appliedCoupons.some((c) => c.code === input.code)) {
    return Effect.fail(
      ValidationException.new(
        'COUPON_ALREADY_APPLIED',
        'Coupon already applied',
      ),
    );
  }

  // Calculate discount
  const discountAmount =
    input.type === 'PERCENTAGE'
      ? props.totalAmount.props.amount * (input.discount / 100)
      : input.discount;

  const newTotal = Math.max(0, props.totalAmount.props.amount - discountAmount);

  return pipe(
    MoneyTrait.new({
      amount: newTotal,
      currency: props.totalAmount.props.currency,
    }),
    Effect.map((totalAmount) => ({
      props: {
        ...props,
        appliedCoupons: [
          ...props.appliedCoupons,
          {
            code: input.code,
            discount: input.discount,
            type: input.type,
            appliedAt: new Date(),
          },
        ],
        totalAmount,
      },
      domainEvents: [
        DomainEventTrait.create({
          name: 'COUPON_APPLIED',
          payload: {
            cartId: cart.id,
            couponCode: input.code,
            discountAmount,
            newTotal,
          },
          correlationId,
          aggregate: cart,
        }),
      ],
    })),
  );
});

const checkout = AggGenericTrait.asCommand<
  ShoppingCart,
  {
    paymentMethod: string;
    shippingAddress: Address;
  }
>((input, props, cart, correlationId) => {
  if (props.status !== 'ACTIVE') {
    return Effect.fail(
      ValidationException.new('INVALID_STATUS', 'Cart is not active'),
    );
  }

  if (props.items.length === 0) {
    return Effect.fail(
      ValidationException.new('EMPTY_CART', 'Cannot checkout empty cart'),
    );
  }

  return Effect.succeed({
    props: {
      ...props,
      status: 'CHECKED_OUT' as CartStatus,
    },
    domainEvents: [
      DomainEventTrait.create({
        name: 'CART_CHECKED_OUT',
        payload: {
          cartId: cart.id,
          customerId: props.customerId,
          items: props.items,
          totalAmount: props.totalAmount.props.amount,
          paymentMethod: input.paymentMethod,
          shippingAddress: input.shippingAddress,
        },
        correlationId,
        aggregate: cart,
      }),
    ],
  });
});
```

#### Advanced Aggregate Patterns

##### Event Sourcing Pattern

```typescript
// Event-sourced aggregate
type Account = AggregateRoot<{
  balance: number;
  version: number;
}>;

// Rebuild state from events
const rebuildAccount = (
  events: IDomainEvent[],
): Effect.Effect<Account, ValidationException> => {
  const initialState = {
    balance: 0,
    version: 0,
  };

  return pipe(
    events,
    Effect.reduce(initialState, (state, event) => {
      switch (event.name) {
        case 'ACCOUNT_OPENED':
          return Effect.succeed({
            balance: event.payload.initialDeposit,
            version: state.version + 1,
          });

        case 'MONEY_DEPOSITED':
          return Effect.succeed({
            balance: state.balance + event.payload.amount,
            version: state.version + 1,
          });

        case 'MONEY_WITHDRAWN':
          return Effect.succeed({
            balance: state.balance - event.payload.amount,
            version: state.version + 1,
          });

        default:
          return Effect.succeed(state);
      }
    }),
    Effect.map((props) => ({
      _tag: 'Account',
      id: events[0]?.aggregateId || IdentifierTrait.uuid(),
      createdAt: new Date(events[0]?.metadata.timestamp || Date.now()),
      updatedAt: Option.some(new Date()),
      props,
      domainEvents: [],
    })),
  );
};
```

##### Saga Pattern

```typescript
// Process manager / Saga
const processOrderSaga = (order: Order) =>
  pipe(
    // Get all events
    AggGenericTrait.getDomainEvents(order),
    // Process each event
    Effect.forEach((event) => {
      switch (event.name) {
        case 'ORDER_PLACED':
          return pipe(
            Effect.all({
              payment: processPayment(event.payload),
              inventory: reserveInventory(event.payload),
            }),
            Effect.map(() => [
              DomainEventTrait.create({
                name: 'PAYMENT_PROCESSED',
                payload: { orderId: event.payload.orderId },
                correlationId: event.metadata.correlationId,
              }),
              DomainEventTrait.create({
                name: 'INVENTORY_RESERVED',
                payload: { orderId: event.payload.orderId },
                correlationId: event.metadata.correlationId,
              }),
            ]),
          );

        case 'PAYMENT_PROCESSED':
          return shipOrder(event.payload);

        default:
          return Effect.succeed([]);
      }
    }),
    Effect.map((events) => events.flat()),
    Effect.map((newEvents) =>
      pipe(
        order,
        AggGenericTrait.clearEvents,
        AggGenericTrait.addDomainEvents(newEvents),
      ),
    ),
  );
```

## Domain Events

### Creating Domain Events

```typescript
import { DomainEventTrait, IDomainEvent } from 'yl-ddd-ts';

// Create a domain event
const orderPlacedEvent = DomainEventTrait.create({
  name: 'ORDER_PLACED',
  payload: {
    orderId: '123',
    customerEmail: 'customer@example.com',
    totalAmount: 100,
  },
  correlationId: IdentifierTrait.uuid(),
  causationId: 'command-123', // Optional
  userId: 'user-456', // Optional
  aggregate: orderAggregate, // Optional, adds aggregateId and aggregateType
});

// Event structure
console.log(orderPlacedEvent.name); // 'ORDER_PLACED'
console.log(orderPlacedEvent.metadata.timestamp); // number
console.log(orderPlacedEvent.metadata.correlationId); // UUID
console.log(orderPlacedEvent.getPayload()); // { orderId, customerEmail, totalAmount }
```

### Domain Event Publisher

```typescript
import { Effect, pipe, Layer } from 'effect';
import {
  DomainEventPublisherContext,
  DomainEventRepositoryContext,
  MockDomainEventRepositoryLayer,
} from 'yl-ddd-ts';

// Setup layers
const eventLayer = pipe(
  MockDomainEventRepositoryLayer,
  Layer.provide(DomainEvenPublishImplementLayer),
);

// Publish events
const publishEvents = Effect.gen(function* () {
  const publisher = yield* DomainEventPublisherContext;

  // Publish single event
  yield* publisher.publish(orderPlacedEvent);

  // Publish multiple events
  yield* publisher.publishAll([orderPlacedEvent, orderShippedEvent]);
});

// Run with dependencies
pipe(publishEvents, Effect.provide(eventLayer), Effect.runPromise);
```

## Repositories

### Repository Interface

```typescript
import { Effect, Option } from 'effect';
import { RepositoryPort, DataWithPaginationMeta } from 'yl-ddd-ts';

interface UserRepository extends RepositoryPort<User> {
  findByEmail(email: string): Effect.Effect<Option.Option<User>, BaseException>;
}

// Implementation
class UserRepositoryImpl implements UserRepository {
  save(user: User): Effect.Effect<void, BaseException> {
    return pipe(
      Effect.tryPromise({
        try: () => database.save(user),
        catch: (error) =>
          OperationException.new(
            'SAVE_FAILED',
            `Failed to save user: ${error}`,
          ),
      }),
    );
  }

  findOne(
    params: QueryParams,
  ): Effect.Effect<Option.Option<User>, BaseException> {
    return pipe(
      Effect.tryPromise({
        try: () => database.findOne(params),
        catch: (error) =>
          OperationException.new(
            'FIND_FAILED',
            `Failed to find user: ${error}`,
          ),
      }),
      Effect.map(Option.fromNullable),
    );
  }

  findOneOrThrow(params: QueryParams): Effect.Effect<User, BaseException> {
    return pipe(
      this.findOne(params),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              NotFoundException.new('USER_NOT_FOUND', 'User not found'),
            ),
          onSome: Effect.succeed,
        }),
      ),
    );
  }

  findManyPaginated(
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<User[]>, BaseException> {
    return pipe(
      Effect.tryPromise({
        try: async () => {
          const { params = {}, pagination = { skip: 0, limit: 10 } } = options;
          const [users, count] = await Promise.all([
            database.find({ ...params, ...pagination }),
            database.count(params),
          ]);
          return {
            data: users,
            count,
            limit: pagination.limit,
            page: pagination.page || 1,
          };
        },
        catch: (error) =>
          OperationException.new(
            'PAGINATE_FAILED',
            `Failed to paginate: ${error}`,
          ),
      }),
    );
  }

  // Custom method
  findByEmail(
    email: string,
  ): Effect.Effect<Option.Option<User>, BaseException> {
    return this.findOne({ email });
  }
}
```

### Using Repositories

```typescript
// Repository usage with railway style
const findAndUpdateUser = (userId: string, newEmail: string) =>
  pipe(
    repository.findOneByIdOrThrow(userId),
    Effect.flatMap((user) =>
      pipe(
        user,
        updateEmail(newEmail),
        Effect.flatMap((updatedUser) => repository.save(updatedUser)),
        Effect.map(() => user),
      ),
    ),
  );

// Pagination
pipe(
  repository.findManyPaginated({
    params: { isActive: true },
    pagination: { page: 1, limit: 20 },
    orderBy: { createdAt: 'DESC' },
  }),
  Effect.map((result) => {
    console.log(`Found ${result.count} users`);
    console.log(
      `Page ${result.page} of ${Math.ceil(result.count / result.limit!)}`,
    );
    return result.data;
  }),
);
```

## Validation & Exceptions

### Exception Types

```typescript
import {
  ValidationException,
  NotFoundException,
  OperationException,
  BaseException,
} from 'yl-ddd-ts';

// Validation errors
const validationError = ValidationException.new(
  'INVALID_EMAIL',
  'Email format is invalid',
  {
    loc: ['user', 'email'],
    instruction: ['Email must be a valid email address'],
    details: ['Provided: not-an-email'],
  },
);

// Not found errors
const notFoundError = NotFoundException.new(
  'USER_NOT_FOUND',
  'User with given ID does not exist',
  { details: ['ID: 123'] },
);

// Operation errors
const operationError = OperationException.new(
  'DATABASE_CONNECTION_FAILED',
  'Failed to connect to database',
  { details: ['Timeout after 30s'] },
);
```

### Validation with Railway Style

```typescript
// Custom validation
const validateAge = (
  age: number,
): Effect.Effect<number, ValidationException> =>
  age >= 18 && age <= 120
    ? Effect.succeed(age)
    : Effect.fail(
        ValidationException.new(
          'INVALID_AGE',
          'Age must be between 18 and 120',
        ),
      );

// Compose validations
const validateUserInput = (input: UserInput) =>
  pipe(
    Effect.all({
      name: Schema.decode(NonEmptyString)(input.name),
      email: Schema.decode(Email)(input.email),
      age: validateAge(input.age),
    }),
    Effect.mapError((error) =>
      ValidationException.new(
        'USER_VALIDATION_FAILED',
        'User input validation failed',
        { details: [error.toString()] },
      ),
    ),
  );
```

## Complete Examples

### E-commerce Order Aggregate

```typescript
import { Effect, pipe, Option, Schema } from 'effect';
import * as YL from 'yl-ddd-ts';

// Value Objects
type ProductId = YL.Identifier;
type CustomerId = YL.Identifier;

type Money = YL.ValueObject<{
  amount: YL.PositiveNumber;
  currency: string;
}>;

const MoneyTrait = YL.ValueObjectGenericTrait.createValueObjectTrait
  Money,
  { amount: number; currency: string }
>(
  (input) => pipe(
    Effect.all({
      amount: Schema.decode(YL.PositiveNumber)(input.amount),
      currency: pipe(
        input.currency,
        Schema.decode(Schema.String.pipe(Schema.length(3)))
      )
    })
  ),
  'Money'
);

// Entities
type OrderLine = YL.Entity<{
  productId: ProductId;
  productName: YL.NonEmptyString;
  quantity: YL.PositiveNumber;
  unitPrice: Money;
  totalPrice: Money;
}>;

const OrderLineTrait = YL.EntityGenericTrait.createEntityTrait
  OrderLine,
  {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: { amount: number; currency: string };
  }
>(
  (input) => pipe(
    Effect.all({
      productId: Schema.decode(YL.Identifier)(input.productId),
      productName: Schema.decode(YL.NonEmptyString)(input.productName),
      quantity: Schema.decode(YL.PositiveNumber)(input.quantity),
      unitPrice: MoneyTrait.new(input.unitPrice),
    }),
    Effect.flatMap(props =>
      pipe(
        MoneyTrait.new({
          amount: props.quantity * props.unitPrice.props.amount,
          currency: props.unitPrice.props.currency
        }),
        Effect.map(totalPrice => ({ ...props, totalPrice }))
      )
    )
  ),
  'OrderLine'
);

// Aggregate Root
type Order = YL.AggregateRoot<{
  orderNumber: YL.NonEmptyString;
  customerId: CustomerId;
  lines: OrderLine[];
  totalAmount: Money;
  status: OrderStatus;
  placedAt: Option.Option<Date>;
  shippedAt: Option.Option<Date>;
}>;

enum OrderStatus {
  DRAFT = 'DRAFT',
  PLACED = 'PLACED',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

const OrderTrait = YL.AggGenericTrait.createAggregateRootTrait<Order>(
  (input: {
    orderNumber: string;
    customerId: string;
    currency: string;
  }) => pipe(
    Effect.all({
      orderNumber: Schema.decode(YL.NonEmptyString)(input.orderNumber),
      customerId: Schema.decode(YL.Identifier)(input.customerId),
      lines: Effect.succeed([]),
      totalAmount: MoneyTrait.new({ amount: 0, currency: input.currency }),
      status: Effect.succeed(OrderStatus.DRAFT),
      placedAt: Effect.succeed(Option.none()),
      shippedAt: Effect.succeed(Option.none())
    })
  ),
  'Order'
);

// Commands
const addOrderLine = YL.AggGenericTrait.asCommand<Order, {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}>(
  (input, props, order, correlationId) => pipe(
    OrderLineTrait.new({
      ...input,
      unitPrice: {
        amount: input.unitPrice,
        currency: props.totalAmount.props.currency
      }
    }),
    Effect.flatMap(line =>
      MoneyTrait.new({
        amount: props.totalAmount.props.amount + line.props.totalPrice.props.amount,
        currency: props.totalAmount.props.currency
      }),
      Effect.map(newTotal => ({
        props: {
          ...props,
          lines: [...props.lines, line],
          totalAmount: newTotal
        },
        domainEvents: [
          YL.DomainEventTrait.create({
            name: 'ORDER_LINE_ADDED',
            payload: {
              orderId: order.id,
              productId: line.props.productId,
              quantity: line.props.quantity
            },
            correlationId,
            aggregate: order
          })
        ]
      }))
    )
  )
);

const placeOrder = YL.AggGenericTrait.asCommand<Order, void>(
  (_, props, order, correlationId) => {
    if (props.lines.length === 0) {
      return Effect.fail(
        YL.ValidationException.new('EMPTY_ORDER', 'Cannot place empty order')
      );
    }

    if (props.status !== OrderStatus.DRAFT) {
      return Effect.fail(
        YL.ValidationException.new(
          'INVALID_STATUS',
          `Cannot place order in ${props.status} status`
        )
      );
    }

    return Effect.succeed({
      props: {
        ...props,
        status: OrderStatus.PLACED,
        placedAt: Option.some(new Date())
      },
      domainEvents: [
        YL.DomainEventTrait.create({
          name: 'ORDER_PLACED',
          payload: {
            orderId: order.id,
            customerId: props.customerId,
            totalAmount: props.totalAmount.props.amount,
            currency: props.totalAmount.props.currency
          },
          correlationId,
          aggregate: order
        })
      ]
    });
  }
);

// Usage
const createAndPlaceOrder = pipe(
  OrderTrait.new({
    orderNumber: 'ORD-2024-001',
    customerId: YL.IdentifierTrait.uuid(),
    currency: 'USD'
  }),
  Effect.flatMap(order =>
    pipe(
      order,
      addOrderLine({
        productId: YL.IdentifierTrait.uuid(),
        productName: 'Laptop',
        quantity: 1,
        unitPrice: 999.99
      })
    )
  ),
  Effect.flatMap(order =>
    pipe(
      order,
      addOrderLine({
        productId: YL.IdentifierTrait.uuid(),
        productName: 'Mouse',
        quantity: 2,
        unitPrice: 29.99
      })
    )
  ),
  Effect.flatMap(order => placeOrder()(order)),
  Effect.tap(order =>
    Effect.sync(() => {
      console.log('Order placed:', order);
      console.log('Total amount:', order.props.totalAmount);
      console.log('Events:', YL.AggGenericTrait.getDomainEvents(order));
    })
  )
);

// Run the example
Effect.runPromise(createAndPlaceOrder)
  .then(order => console.log('Success:', order.id))
  .catch(error => console.error('Error:', error));
```

### Repository with Domain Events

```typescript
import { Effect, pipe, Layer, Context } from 'effect';
import * as YL from 'yl-ddd-ts';

// Repository implementation
class OrderRepository implements YL.RepositoryPort<Order> {
  constructor(
    private eventPublisher: YL.IDomainEventPublisher,
    private db: DatabaseConnection,
  ) {}

  save(order: Order): Effect.Effect<void, YL.BaseException> {
    return pipe(
      // Save to database
      Effect.tryPromise({
        try: () => this.db.save(order),
        catch: (error) =>
          YL.OperationException.new(
            'SAVE_FAILED',
            `Failed to save order: ${error}`,
          ),
      }),
      // Publish domain events
      Effect.flatMap(() =>
        this.eventPublisher.publishAll(
          YL.AggGenericTrait.getDomainEvents(order),
        ),
      ),
      // Clear events after publishing
      Effect.map(() => YL.AggGenericTrait.clearEvents(order)),
    );
  }

  findOneByIdOrThrow(
    id: YL.Identifier,
  ): Effect.Effect<Order, YL.BaseException> {
    return pipe(
      Effect.tryPromise({
        try: () => this.db.findById(id),
        catch: (error) =>
          YL.OperationException.new(
            'FIND_FAILED',
            `Failed to find order: ${error}`,
          ),
      }),
      Effect.flatMap((data) =>
        data
          ? OrderTrait.parse(data)
          : Effect.fail(
              YL.NotFoundException.new(
                'ORDER_NOT_FOUND',
                `Order ${id} not found`,
              ),
            ),
      ),
    );
  }

  // Implement other methods...
}

// Service layer
const OrderService = {
  placeOrder: (
    orderNumber: string,
    customerId: string,
    items: Array<{ productId: string; quantity: number; price: number }>,
  ) =>
    Effect.gen(function* () {
      const repository = yield* OrderRepositoryContext;

      // Create order
      const order = yield* OrderTrait.new({
        orderNumber,
        customerId,
        currency: 'USD',
      });

      // Add items
      const orderWithItems = yield* items.reduce(
        (acc, item) =>
          Effect.flatMap(acc, (order) =>
            addOrderLine({
              productId: item.productId,
              productName: `Product ${item.productId}`,
              quantity: item.quantity,
              unitPrice: item.price,
            })(order),
          ),
        Effect.succeed(order),
      );

      // Place order
      const placedOrder = yield* placeOrder()(orderWithItems);

      // Save with events
      yield* repository.save(placedOrder);

      return placedOrder.id;
    }),
};

// Usage with dependency injection
const program = pipe(
  OrderService.placeOrder('ORD-001', 'customer-123', [
    { productId: 'prod-1', quantity: 2, price: 50 },
    { productId: 'prod-2', quantity: 1, price: 100 },
  ]),
  Effect.tap((orderId) =>
    Effect.sync(() => console.log('Order created:', orderId)),
  ),
);

// Create layers
const RepositoryLayer = Layer.effect(
  OrderRepositoryContext,
  Effect.gen(function* () {
    const eventPublisher = yield* YL.DomainEventPublisherContext;
    const db = yield* DatabaseContext;
    return new OrderRepository(eventPublisher, db);
  }),
);

const AppLayer = pipe(
  YL.MockDomainEventRepositoryLayer,
  Layer.provide(YL.DomainEvenPublishImplementLayer),
  Layer.provide(DatabaseLayer),
  Layer.provide(RepositoryLayer),
);

// Run with all dependencies
Effect.runPromise(Effect.provide(program, AppLayer));
```

This documentation covers all the main components and patterns in the Effect domain modeling library. The examples demonstrate railway-style programming using `pipe` and Effect's functional approach rather than generator functions.

```markdown
# effect-ddd - Effect Domain Modeling Library

A functional approach to Domain-Driven Design (DDD) in TypeScript using the Effect ecosystem with clean architecture principles.

## 🏗️ Architecture & Organization

This library implements Domain-Driven Design patterns using functional programming principles with clear separation of concerns:
```

src/
├── model/ \# Core domain modeling
│ ├── interfaces/ \# Domain interfaces & contracts
│ ├── implementations/ \# Domain implementations
│ ├── builders/ \# Functional builders (domain, schema)
│ ├── exception/ \# Domain exceptions
│ ├── value-object/ \# Pre-built value objects
│ └── event/ \# Domain event system
├── ports/ \# Ports & adapters
│ ├── database/ \# Database adapters
│ │ └── typeorm/ \# TypeORM repository factory
│ ├── pubsub/ \# Event messaging
│ └── logger/ \# Logging infrastructure
├── application/ \# Application layer (CQRS)
├── logic/ \# Shared utilities & FP helpers
└── typeclasses/ \# Type utilities & constraints

````

## 🚀 Key Features

- **🎯 Functional Domain Modeling**: Railway-oriented programming with Effect
- **🏛️ Clean Architecture**: Clear separation between domain, application, and infrastructure
- **🔧 Functional Builders**: Composable domain object creation with `pipe`
- **🛡️ Type Safety**: Comprehensive validation with Effect Schema + custom parsers
- **📦 Repository Pattern**: TypeORM integration with Effect-based repositories
- **⚡ Domain Events**: Event-driven architecture with built-in publishing
- **🧪 Test-Friendly**: Immutable objects with deterministic behavior

## 📦 Installation

```bash
yarn add yl-ddd-ts
````

## 🎯 Quick Start

### Value Objects with Schema Builder

Define immutable data structures where equality is based on their values.

```typescript
import { Effect, Schema, pipe } from 'effect';
import {
  stringSchema,
  withNonEmpty,
  buildStringSchema,
  createValueObject,
  withSchema,
  withQuery,
  buildValueObject,
  ValueObject,
  ValueObjectTrait,
} from 'yl-ddd-ts';

// 1. Schema definition for Location properties
const LocationSchema = Schema.Struct({
  name: pipe(
    stringSchema(),
    withNonEmpty('Location name is required'),
    buildStringSchema,
  ),
});

// 2. Types for Location Value Object
type LocationProps = Schema.Schema.Type<typeof LocationSchema>;
export type Location = ValueObject<LocationProps>;
export type LocationParam = { name: string };

// 3. Trait Interface for Location
export interface ILocationTrait
  extends ValueObjectTrait<Location, LocationParam, LocationParam> {
  isInternational: () => boolean;
  getCountry: () => string;
}

// 4. Create and build LocationTrait with queries
export const LocationTrait: ILocationTrait = pipe(
  createValueObject<Location, LocationParam>('Location'),
  withSchema(LocationSchema),
  withQuery('isInternational', (props) =>
    ['US', 'USA', 'United States'].every(
      (country) => !props.name.toUpperCase().includes(country.toUpperCase()),
    ),
  ),
  withQuery('getCountry', (props) => {
    const parts = props.name.split(',').map((p) => p.trim());
    return parts[parts.length - 1] || props.name;
  }),
  buildValueObject,
);

// Usage
async function usageExample() {
  const location = await Effect.runPromise(
    LocationTrait.new({ name: 'Hanoi, Vietnam' }),
  );
  console.log(location.getCountry()); // "Vietnam"
  console.log(location.isInternational()); // true
}
usageExample();
```

### Entities with Commands

Define domain objects with a distinct identity and managed mutable state via commands.

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createEntity,
  withSchema,
  withQuery,
  withCommand,
  buildEntity,
  CommonSchemas,
  Entity,
  EntityTrait,
  ValidationException,
} from 'yl-ddd-ts';

// 1. Types for User properties and input
type UserProps = {
  name: string;
  email: string;
  isActive: boolean;
};

type UserInput = {
  name: string;
  email: string;
};

// 2. Schema definition for User
const UserSchema = Schema.Struct({
  name: CommonSchemas.NonEmptyString,
  email: CommonSchemas.Email,
  isActive: Schema.Boolean.pipe(Schema.optional).withDefault(() => false),
});

// 3. User Entity type
export type User = Entity<UserProps>;

// 4. Trait Interface for User
export interface IUserTrait extends EntityTrait<User, UserInput, UserInput> {
  isActive: () => boolean;
  getDisplayName: () => string;
  activate: () => (user: User) => Effect.Effect<User, ValidationException>;
}

// 5. User entity with functional builder
export const UserTrait: IUserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withQuery('isActive', (props) => props.isActive),
  withQuery('getDisplayName', (props) => `${props.name} (${props.email})`),
  withCommand('activate', (_, props) =>
    Effect.succeed({ props: { ...props, isActive: true } }),
  ),
  buildEntity,
);

// Usage
async function usageExample() {
  const user = await Effect.runPromise(
    UserTrait.new({ name: 'John', email: 'john@example.com' }),
  );
  console.log('Initial user active status:', user.isActive()); // false

  const activeUser = await Effect.runPromise(UserTrait.activate()(user));
  console.log('Activated user active status:', activeUser.isActive()); // true
}
usageExample();
```

### Aggregate Roots with Domain Events

Define Entities that serve as consistency boundaries, managing internal state and emitting domain events.

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createAggregateRoot,
  withSchema,
  withAggregateCommand,
  withEventHandler,
  buildAggregateRoot,
  DomainEventTrait,
  AggregateRoot,
  AggregateRootTrait,
  ValidationException,
  IDomainEvent,
  IdentifierTrait,
} from 'yl-ddd-ts';

// Helper types and functions (simplified for README)
type OrderItem = {
  productId: string;
  quantity: number;
  price: number;
  productName: string;
};
const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity * item.price, 0);

// 1. Types for Order properties and input
type OrderProps = {
  customerId: string;
  items: OrderItem[];
  status: 'draft' | 'confirmed' | 'shipped';
  total: number;
};

type OrderInput = {
  customerId: string;
};

// 2. Schema for Order
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

// 3. Aggregate type
export type Order = AggregateRoot<OrderProps>;

// 4. Trait Interface for Order
export interface IOrderTrait
  extends AggregateRootTrait<Order, OrderInput, OrderInput> {
  addItem: (
    item: OrderItem,
  ) => (
    order: Order,
    correlationId: string,
  ) => Effect.Effect<Order, ValidationException>;
}

// 5. OrderTrait definition
export const OrderTrait: IOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withAggregateCommand(
    'addItem',
    (item: OrderItem, props: OrderProps, aggregate, correlationId) =>
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

        return {
          props: { ...props, items: newItems, total: newTotal },
          domainEvents: [
            DomainEventTrait.create({
              name: 'OrderItemAdded',
              payload: { item, newTotal },
              correlationId,
              aggregate,
            }),
          ],
        };
      }),
  ),
  withEventHandler('OrderItemAdded', (event) => {
    console.log(`Item added: ${event.payload.item.productName}`);
  }),
  buildAggregateRoot,
);

// Usage
async function usageExample() {
  const order = await Effect.runPromise(
    OrderTrait.new({ customerId: 'customer-123' }),
  );
  const newItem: OrderItem = {
    productId: 'P001',
    productName: 'Gizmo',
    quantity: 1,
    price: 100,
  };
  const updatedOrder = await Effect.runPromise(
    OrderTrait.addItem(newItem)(order, IdentifierTrait.uuid()),
  );
  console.log('Order items count:', updatedOrder.unpack().items.length); // 1
  console.log(
    'Order has pending events:',
    updatedOrder.getDomainEvents().length > 0,
  ); // true
}
usageExample();
```

### Repository Factory

```typescript
import {
  createRepositoryWithConventions,
  repositoryBuilder,
  withRelations,
  withDomainMapper,
  buildLayer,
} from 'yl-ddd-ts/typeorm';

// Convention-based repository
const userRepository = createRepositoryWithConventions({
  entityClass: UserEntity,
  domainTrait: UserTrait,
  relations: ['profile', 'orders'],
});

// Functional builder approach
const productRepository = pipe(
  repositoryBuilder<Product, ProductEntity>(ProductEntity),
  withRelations(['category', 'reviews']),
  withDomainMapper((entity) => ProductTrait.parse(entity)),
  build,
);

// Layer for dependency injection
const ProductRepositoryLayer = pipe(
  repositoryBuilder<Product, ProductEntity>(ProductEntity),
  withRelations(['category']),
  withDomainMapper((entity) => ProductTrait.parse(entity)),
  buildLayer(ProductRepositoryTag),
);
```

## 🏛️ Domain Builders

### Dual Parsing Strategy

Effect-DDD offers two powerful strategies for defining model structure and validation:

```typescript
import { pipe } from 'effect';
import {
  createEntity,
  withSchema,
  buildEntity,
  createAggregateRoot,
  withPropsParser,
  buildAggregateRoot,
} from 'yl-ddd-ts';

// Option 1: Schema-based (declarative and type-safe with Effect Schema)
const UserTrait = pipe(
  createEntity('User'),
  withSchema(UserSchema), // UserSchema defined using Schema Builder
  buildEntity,
);

// Option 2: Custom parser (flexible for complex, imperative logic)
const OrderTrait = pipe(
  createAggregateRoot('Order'),
  withPropsParser(complexOrderParser), // complexOrderParser is a custom Effect-based function
  buildAggregateRoot,
);
```

### Schema Builder

Create composable validation schemas using a functional builder pattern.

```typescript
import {
  stringSchema,
  numberSchema,
  objectSchema,
  withMinLength,
  withPattern,
  withCrossFieldValidation,
  buildObjectSchema,
  buildStringSchema,
  CommonSchemas,
} from 'yl-ddd-ts';
import { pipe } from 'effect';

const PasswordSchema = pipe(
  stringSchema(),
  withMinLength(8, 'Password must be at least 8 characters'),
  withPattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and number',
  ),
  buildStringSchema,
);

const UserRegistrationSchema = pipe(
  objectSchema({
    email: CommonSchemas.Email,
    password: PasswordSchema,
    confirmPassword: CommonSchemas.NonEmptyString,
    age: CommonSchemas.Age,
  }),
  withCrossFieldValidation(
    (data) => data.password === data.confirmPassword,
    'Passwords must match',
  ),
  buildObjectSchema,
);
```

## 📊 Pre-built Components

### Value Objects

```typescript
import {
  NonEmptyString,
  Email,
  Username,
  PhoneNumber,
  URL,
  PositiveNumber,
  UUID,
} from 'yl-ddd-ts';
import { Schema } from 'effect';

// Ready-to-use branded types with validation
async function usageExample() {
  const email = await Effect.runPromise(
    Schema.decode(Email)('user@example.com'),
  );
  const username = await Effect.runPromise(Schema.decode(Username)('john_doe'));
  const positiveNum = await Effect.runPromise(
    Schema.decode(PositiveNumber)(42),
  );
  console.log(email, username, positiveNum);
}
usageExample();
```

### Common Schemas

```typescript
import { CommonSchemas } from 'yl-ddd-ts';

// Pre-built common validations
CommonSchemas.Email; // Schema for email validation
CommonSchemas.NonEmptyString; // Schema for non-empty string
CommonSchemas.PositiveNumber; // Schema for number > 0
CommonSchemas.Age; // Schema for integer 0-150
CommonSchemas.TimestampFields; // Schema for createdAt, updatedAt fields
```

## 🔄 CQRS & Application Layer

```typescript
import {
  Command,
  Query,
  CommandHandler,
  QueryHandler,
  CommandTrait,
  QueryTrait,
} from 'yl-ddd-ts';
import { Effect, Option, Context } from 'effect';
// Assuming User, CreateUserCommand, UserRepositoryTag are defined elsewhere
declare type User = any;
declare type CreateUserCommand = Command<{ name: string; email: string }>;
declare const UserRepositoryTag: Context.Tag<any, any>; // Placeholder for RepositoryPort<User>

// Command Example
const createUserCommand = CommandTrait.factory({
  props: { name: 'John', email: 'john@example.com' },
  lifecycle: Option.none,
});

// Query Example
const getUserQuery = QueryTrait.factory({
  props: { userId: '123' },
});

// Command Handler Example
const createUserHandler: CommandHandler<CreateUserCommand, User> = (command) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepositoryTag; // Access repository via context
    const user = yield* UserTrait.new(CommandTrait.getProps(command)); // Create user domain model
    yield* userRepo.add(user); // Save user via repository
    return user;
  });

// Query Handler Example
// const getUserHandler: QueryHandler<GetUserQuery, User> = (query) =>
//   Effect.gen(function* () {
//     const userRepo = yield* UserRepositoryTag;
//     const userId = QueryTrait.queryProps('userId')(query);
//     return yield* userRepo.findOneByIdOrThrow(userId);
//   });
```

## 🧪 Testing

```typescript
import { Effect, pipe } from 'effect';
import { MockDomainEventRepositoryLayer } from 'yl-ddd-ts';
// Assuming UserTrait and User are defined elsewhere
declare const UserTrait: any;
declare type User = any;

// Test with mocked dependencies
const testCreateUser = Effect.gen(function* () {
  const user = yield* UserTrait.new({
    name: 'Test User',
    email: 'test@example.com',
  });

  expect(user.props.name).toBe('Test User');
  expect(user.isActive()).toBe(true);
}).pipe(Effect.provide(MockDomainEventRepositoryLayer));

// To run the test (in a test runner context)
// await Effect.runPromise(testCreateUser);
```

## 📚 Documentation

- **📖 [Complete User Guide](https://www.google.com/search?q=./user-guide.md)** - Comprehensive API documentation
- **🏗️ [Domain Builder Guide](https://www.google.com/search?q=./src/model/builders/domain-builder.md)** - Functional domain modeling
- **🔧 [Schema Builder Guide](https://www.google.com/search?q=./src/model/builders/schema-builder.md)** - Composable validation
- **🗃️ [Repository Factory Guide](https://www.google.com/search?q=./src/ports/database/typeorm/repository.factory.md)** - Database integration
- **📋 [Architecture Overview](https://www.google.com/search?q=./docs/architecture/overview.md)** - System design principles

## 🎯 When to Use

**✅ Perfect for:**

- Complex domains with rich business logic
- Event-driven architectures
- Applications requiring strong type safety
- Teams practicing Domain-Driven Design
- Functional programming enthusiasts

**❌ Consider alternatives for:**

- Simple CRUD applications
- Teams new to functional programming
- Projects with extremely tight performance constraints

## 🧮 Philosophy

This library combines Domain-Driven Design with functional programming principles:

- **🚂 Railway-Oriented Programming**: Error handling flows naturally through pipelines
- **🔒 Immutability**: All domain objects are immutable by design
- **🎯 Focus on Essential Complexity**: Minimize accidental complexity
- **🧩 Composability**: Build complex behavior from simple, reusable pieces
- **📐 Type-Driven Development**: Let types guide your design

> _"The goal is to make domain logic explicit, testable, and maintainable through functional composition."_

## 🤝 Contributing

We welcome contributions\! Please see:

- **🐛 [suspicious link removed]** - Report bugs or request features
- **💬 [suspicious link removed]** - Ask questions or share ideas
- **📖 [Contributing Guide](https://www.google.com/search?q=./CONTRIBUTING.md)** - Development guidelines
- **📋 [Code of Conduct](https://www.google.com/search?q=./CODE_OF_CODE.md)** - Community standards

## 📄 License

MIT © [Your Name]

---

**Built with ❤️ using [Effect](https://effect.website) and TypeScript**

```

```

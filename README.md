# effect-ddd - Effect Domain Modeling Library

A functional approach to Domain-Driven Design (DDD) in TypeScript using the Effect ecosystem with clean architecture principles.

## 🏗️ Architecture & Organization

This library implements Domain-Driven Design patterns using functional programming principles with clear separation of concerns:

```
src/
├── model/                     # Core domain modeling
│   ├── interfaces/           # Domain interfaces & contracts
│   ├── implementations/      # Domain implementations
│   ├── builders/            # Functional builders (domain, schema)
│   ├── exception/           # Domain exceptions
│   ├── value-object/        # Pre-built value objects
│   └── event/              # Domain event system
├── ports/                    # Ports & adapters
│   ├── database/            # Database adapters
│   │   └── typeorm/        # TypeORM repository factory
│   ├── pubsub/             # Event messaging
│   └── logger/             # Logging infrastructure
├── application/             # Application layer (CQRS)
├── logic/                   # Shared utilities & FP helpers
└── typeclasses/            # Type utilities & constraints
```

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
```

## 🎯 Quick Start

### Value Objects with Schema Builder

```typescript
import { Effect, Schema, pipe } from 'effect';
import {
  stringSchema,
  withNonEmpty,
  withEmail,
  buildStringSchema,
  createValueObject,
  withSchema,
  buildValueObject,
} from 'yl-ddd-ts';

// Create email schema using schema builder
const EmailSchema = pipe(
  stringSchema(),
  withEmail('Invalid email format'),
  buildStringSchema,
);

// Create value object trait using domain builder
const EmailTrait = pipe(
  createValueObject<{ value: string }, string>('Email'),
  withSchema(Schema.Struct({ value: EmailSchema })),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  buildValueObject,
);

// Usage
const email = yield * EmailTrait.new('user@example.com');
console.log(email.getDomain()); // "example.com"
```

### Entities with Commands

```typescript
import {
  createEntity,
  withSchema,
  withCommand,
  withQuery,
  buildEntity,
  CommonSchemas,
} from 'yl-ddd-ts';

// User entity with functional builder
const UserTrait = pipe(
  createEntity<UserProps, UserInput>('User'),
  withSchema(UserSchema),
  withQuery('isActive', (props) => props.isActive),
  withQuery('getDisplayName', (props) => `${props.name} (${props.email})`),
  withCommand('activate', (_, props) =>
    Effect.succeed({ props: { ...props, isActive: true } }),
  ),
  withCommand('updateEmail', (newEmail: string, props) =>
    pipe(
      CommonSchemas.Email.decode(newEmail),
      Effect.map((email) => ({ props: { ...props, email } })),
    ),
  ),
  buildEntity,
);

// Usage
const user = yield * UserTrait.new({ name: 'John', email: 'john@example.com' });
const activeUser = yield * UserTrait.activate()(user);
```

### Aggregate Roots with Domain Events

```typescript
import {
  createAggregateRoot,
  withAggregateCommand,
  withEventHandler,
  buildAggregateRoot,
  DomainEventTrait,
} from 'yl-ddd-ts';

const OrderTrait = pipe(
  createAggregateRoot<OrderProps>('Order'),
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

Choose between Effect Schema validation or custom parsing logic:

```typescript
// Option 1: Schema-based (declarative)
const UserTrait = pipe(
  createEntity('User'),
  withSchema(UserSchema),
  buildEntity,
);

// Option 2: Custom parser (flexible)
const OrderTrait = pipe(
  createAggregateRoot('Order'),
  withPropsParser(complexOrderParser),
  buildAggregateRoot,
);
```

### Schema Builder

Create composable validation schemas:

```typescript
import {
  stringSchema,
  numberSchema,
  objectSchema,
  withMinLength,
  withPositive,
  withCrossFieldValidation,
  buildObjectSchema,
} from 'yl-ddd-ts';

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

// Ready-to-use branded types with validation
const email = yield * Schema.decode(Email)('user@example.com');
const username = yield * Schema.decode(Username)('john_doe');
const positiveNum = yield * Schema.decode(PositiveNumber)(42);
```

### Common Schemas

```typescript
import { CommonSchemas } from 'yl-ddd-ts';

// Pre-built common validations
CommonSchemas.Email; // Email validation
CommonSchemas.NonEmptyString; // Non-empty string
CommonSchemas.PositiveNumber; // Number > 0
CommonSchemas.Age; // Integer 0-150
CommonSchemas.TimestampFields; // createdAt, updatedAt
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

// Command
const createUserCommand = CommandTrait.factory({
  props: { name: 'John', email: 'john@example.com' },
  lifecycle: Option.none,
});

// Query
const getUserQuery = QueryTrait.factory({
  props: { userId: '123' },
});

// Handlers
const createUserHandler: CommandHandler<CreateUserCommand, User> = (command) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepositoryTag;
    const user = yield* UserTrait.new(CommandTrait.getProps(command));
    yield* userRepo.add(user);
    return user;
  });
```

## 🧪 Testing

```typescript
import { Effect } from 'effect';
import { MockDomainEventRepositoryLayer } from 'yl-ddd-ts';

// Test with mocked dependencies
const testCreateUser = Effect.gen(function* () {
  const user = yield* UserTrait.new({
    name: 'Test User',
    email: 'test@example.com',
  });

  expect(user.props.name).toBe('Test User');
  expect(user.isActive()).toBe(true);
}).pipe(Effect.provide(MockDomainEventRepositoryLayer));

await Effect.runPromise(testCreateUser);
```

## 📚 Documentation

- **📖 [Complete User Guide](./user-guide.md)** - Comprehensive API documentation
- **🏗️ [Domain Builder Guide](./src/model/builders/domain-builder.md)** - Functional domain modeling
- **🔧 [Schema Builder Guide](./src/model/builders/schema-builder.md)** - Composable validation
- **🗃️ [Repository Factory Guide](./src/ports/database/typeorm/repository.factory.md)** - Database integration
- **📋 [Architecture Overview](./docs/architecture/overview.md)** - System design principles

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

We welcome contributions! Please see:

- **🐛 [Issue Tracker](../../issues)** - Report bugs or request features
- **💬 [Discussions](../../discussions)** - Ask questions or share ideas
- **📖 [Contributing Guide](./CONTRIBUTING.md)** - Development guidelines
- **📋 [Code of Conduct](./CODE_OF_CONDUCT.md)** - Community standards

## 📄 License

MIT © [Your Name]

---

**Built with ❤️ using [Effect](https://effect.website) and TypeScript**

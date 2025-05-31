# Repository Factory

## Overview

The Repository Factory provides a functional approach to creating TypeORM-based repositories for domain aggregates. It bridges the gap between your Effect-based domain models and TypeORM entities with automatic mapping, configuration builders, and Effect integration.

## Key Features

- **Functional Composition**: Pure functions with pipe-friendly API
- **Auto-mapping**: Convention-based property mapping between domain and ORM entities
- **Type Safety**: Full TypeScript support with generic constraints
- **Effect Integration**: Native Effect error handling and dependency injection
- **Flexible Configuration**: Multiple configuration strategies from simple to complex
- **Layer Support**: Context layer creation for dependency injection

## Core Types

### Configuration Types

```typescript
interface RepositoryConfig<DM, OrmEntity, QueryParams> {
  readonly entityClass: new () => OrmEntity;
  readonly relations: readonly string[];
  readonly mappers: {
    readonly toDomain: (
      ormEntity: OrmEntity,
    ) => Effect.Effect<DM, BaseException, never>;
    readonly toOrm: (
      domain: DM,
      existing?: OrmEntity,
    ) => Effect.Effect<OrmEntity, BaseException, never>;
    readonly prepareQuery: (params: QueryParams) => FindOptionsWhere<OrmEntity>;
  };
}

interface ConventionConfig<DM, OrmEntity, QueryParams> {
  readonly entityClass: new () => OrmEntity;
  readonly domainTrait: {
    parse: (raw: any) => Effect.Effect<DM, BaseException, never>;
  };
  readonly relations?: readonly string[];
  readonly customMappings?: Partial<
    RepositoryConfig<DM, OrmEntity, QueryParams>['mappers']
  >;
}

interface BuilderState<DM, OrmEntity, QueryParams> {
  readonly entityClass: new () => OrmEntity;
  readonly relations: readonly string[];
  readonly toDomain?: (
    ormEntity: OrmEntity,
  ) => Effect.Effect<DM, BaseException, never>;
  readonly toOrm?: (
    domain: DM,
    existing?: OrmEntity,
  ) => Effect.Effect<OrmEntity, BaseException, never>;
  readonly prepareQuery?: (params: QueryParams) => FindOptionsWhere<OrmEntity>;
}
```

## API Reference

### Core Factory Functions

#### `createRepository<DM, OrmEntity, QueryParams>(config: RepositoryConfig<DM, OrmEntity, QueryParams>)`

Creates a repository with complete configuration.

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
    toOrm: (domain, existing) =>
      Effect.succeed({ ...existing, ...domain.props }),
    prepareQuery: (params) => ({ id: params.id }),
  },
});
```

#### `createRepositoryWithDefaults<DM, OrmEntity, QueryParams>(partialConfig: PartialRepositoryConfig<DM, OrmEntity, QueryParams>)`

Creates a repository with partial configuration, auto-completing missing mappers.

**Parameters:**

- `partialConfig`: Partial configuration with optional mappers

**Returns:** `Effect<RepositoryPort<DM>, BaseException, DataSource>`

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

#### `createRepositoryWithConventions<DM, OrmEntity, QueryParams>(config: ConventionConfig<DM, OrmEntity, QueryParams>)`

Creates a repository using convention-based mapping.

**Parameters:**

- `config`: Configuration with domain trait for automatic mapping

**Returns:** `Effect<RepositoryPort<DM>, BaseException, DataSource>`

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

#### `createRepositoryLayer<DM, OrmEntity, QueryParams>(repositoryTag: Context.Tag, config: RepositoryConfig<DM, OrmEntity, QueryParams>)`

Creates an Effect layer for dependency injection.

**Parameters:**

- `repositoryTag`: Context tag for the repository
- `config`: Complete repository configuration

**Returns:** `Layer<RepositoryPort<DM>, BaseException, DataSource>`

**Example:**

```typescript
const UserRepositoryTag = Context.Tag<RepositoryPort<User>>();

const UserRepositoryLayer = createRepositoryLayer(UserRepositoryTag, {
  entityClass: UserEntity,
  relations: ['profile'],
  mappers: {
    /* ... */
  },
});
```

#### `createRepositoryLayerWithDefaults<DM, OrmEntity, QueryParams>(repositoryTag: Context.Tag, partialConfig: PartialRepositoryConfig<DM, OrmEntity, QueryParams>)`

Creates a layer with partial configuration and auto-completion.

#### `createRepositoryLayerWithConventions<DM, OrmEntity, QueryParams>(repositoryTag: Context.Tag, config: ConventionConfig<DM, OrmEntity, QueryParams>)`

Creates a layer using convention-based configuration.

### Functional Builder Functions

#### `repositoryBuilder<DM, OrmEntity, QueryParams>(entityClass: new () => OrmEntity)`

Initializes a functional builder for repository configuration.

**Parameters:**

- `entityClass`: TypeORM entity class

**Returns:** `BuilderState<DM, OrmEntity, QueryParams>`

#### `withRelations(relations: readonly string[])`

Adds relations to the builder configuration.

**Parameters:**

- `relations`: Array of relation names to include

**Returns:** `(state: BuilderState) => BuilderState`

#### `withDomainMapper(mapper: (ormEntity: OrmEntity) => Effect<DM, BaseException, never>)`

Adds a domain mapper to the builder configuration.

**Parameters:**

- `mapper`: Function to convert ORM entity to domain model

**Returns:** `(state: BuilderState) => BuilderState`

#### `withOrmMapper(mapper: (domain: DM, existing?: OrmEntity) => Effect<OrmEntity, BaseException, never>)`

Adds an ORM mapper to the builder configuration.

**Parameters:**

- `mapper`: Function to convert domain model to ORM entity

**Returns:** `(state: BuilderState) => BuilderState`

#### `withQueryMapper(mapper: (params: QueryParams) => FindOptionsWhere<OrmEntity>)`

Adds a query mapper to the builder configuration.

**Parameters:**

- `mapper`: Function to convert query parameters to TypeORM where conditions

**Returns:** `(state: BuilderState) => BuilderState`

#### `build(state: BuilderState)`

Builds a repository from the current builder state.

**Parameters:**

- `state`: Current builder state

**Returns:** `Effect<RepositoryPort<DM>, BaseException, DataSource>`

#### `buildLayer(repositoryTag: Context.Tag)`

Builds an Effect layer from the current builder state.

**Parameters:**

- `repositoryTag`: Context tag for dependency injection

**Returns:** `(state: BuilderState) => Layer<RepositoryPort<DM>, BaseException, DataSource>`

## Usage Patterns

### 1. Simple Convention-Based Repository

For basic CRUD operations with minimal customization:

```typescript
import { createRepositoryWithConventions } from './repository.factory';

const userRepository = createRepositoryWithConventions({
  entityClass: UserEntity,
  domainTrait: UserTrait,
  relations: ['profile', 'orders'],
});

// Usage in Effect
const getUserById = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* userRepository;
    return yield* repo.findOneByIdOrThrow(id);
  });
```

### 2. Functional Builder Pattern

For step-by-step configuration with pipe composition:

```typescript
import { pipe } from 'effect';
import {
  repositoryBuilder,
  withRelations,
  withDomainMapper,
  withQueryMapper,
  build,
} from './repository.factory';

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
  withQueryMapper((params: ProductQuery) => ({
    category: params.categoryId ? { id: params.categoryId } : undefined,
    status: params.status,
    price: params.minPrice ? MoreThan(params.minPrice) : undefined,
  })),
  build,
);
```

### 3. Layer Creation for Dependency Injection

For Effect Context integration:

```typescript
import { Context } from 'effect';

// Define repository tags
const UserRepositoryTag = Context.Tag<RepositoryPort<User>>();
const ProductRepositoryTag = Context.Tag<RepositoryPort<Product>>();

// Create layers
const UserRepositoryLayer = pipe(
  repositoryBuilder<User, UserEntity>(UserEntity),
  withRelations(['profile']),
  withDomainMapper((entity) => UserTrait.parse(entity)),
  buildLayer(UserRepositoryTag),
);

const ProductRepositoryLayer = createRepositoryLayerWithConventions(
  ProductRepositoryTag,
  {
    entityClass: ProductEntity,
    domainTrait: ProductTrait,
    relations: ['category'],
  },
);

// Combine layers
const RepositoryLayer = Layer.merge(
  UserRepositoryLayer,
  ProductRepositoryLayer,
);

// Use in application
const createUser = (userData: CreateUserParams) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepositoryTag;
    const productRepo = yield* ProductRepositoryTag;

    const user = yield* UserTrait.new(userData);
    yield* userRepo.add(user);

    return user;
  }).pipe(Effect.provide(RepositoryLayer));
```

### 4. Custom Mapping for Complex Scenarios

For domains requiring complex transformations:

```typescript
const orderRepository = createRepositoryWithDefaults({
  entityClass: OrderEntity,
  relations: ['items', 'customer', 'payments'],
  mappers: {
    toDomain: (entity) =>
      Effect.gen(function* () {
        // Complex domain reconstruction
        const customer = yield* CustomerTrait.parse(entity.customer);
        const items = yield* Effect.forEach(entity.items, (item) =>
          OrderItemTrait.parse(item),
        );
        const payments = yield* Effect.forEach(entity.payments, (payment) =>
          PaymentTrait.parse(payment),
        );

        return yield* OrderTrait.parse({
          ...entity,
          customer,
          items,
          payments,
        });
      }),

    toOrm: (domain, existing) =>
      Effect.gen(function* () {
        const props = OrderTrait.unpack(domain);

        return {
          ...existing,
          id: domain.id,
          status: props.status,
          totalAmount: props.total.amount,
          currency: props.total.currency,
          customerId: props.customer.id,
          createdAt: domain.createdAt,
          updatedAt: Option.getOrNull(domain.updatedAt),
        };
      }),

    prepareQuery: (params: OrderQuery) => {
      const where: FindOptionsWhere<OrderEntity> = {};

      if (params.customerId) where.customerId = params.customerId;
      if (params.status) where.status = params.status;
      if (params.dateRange) {
        where.createdAt = Between(params.dateRange.start, params.dateRange.end);
      }

      return where;
    },
  },
});
```

## Auto-Mapping Behavior

### Domain to ORM Mapping

The auto-generated `toOrm` mapper follows these conventions:

1. **Property Extraction**: Extracts `props` from domain objects
2. **Date Conversion**: Converts Date objects to ISO strings
3. **Nested Objects**: Recursively processes nested domain objects
4. **Metadata Copying**: Preserves `id`, `createdAt`, `updatedAt`
5. **Null Handling**: Skips null/undefined values

### ORM to Domain Mapping

The auto-generated `toDomain` mapper follows these conventions:

1. **Property Copying**: Direct property mapping where possible
2. **Date Parsing**: Converts string dates to Date objects
3. **Nested Processing**: Recursively processes nested objects
4. **Type Preservation**: Maintains original data types

### Query Parameter Mapping

The auto-generated `prepareQuery` function:

1. **Direct Mapping**: Maps query parameters directly to TypeORM where conditions
2. **Type Assertion**: Uses type assertion for compatibility
3. **Override Recommended**: Custom implementation often needed for complex queries

## Best Practices

### 1. Configuration Strategy

**For Simple Domains:**

```typescript
// Use convention-based approach
const repository = createRepositoryWithConventions({
  entityClass: SimpleEntity,
  domainTrait: SimpleTrait,
  relations: ['relation1'],
});
```

**For Complex Domains:**

```typescript
// Use functional builder with custom mappers
const repository = pipe(
  repositoryBuilder<Complex, ComplexEntity>(ComplexEntity),
  withRelations(['relation1', 'relation2']),
  withDomainMapper(customDomainMapper),
  withOrmMapper(customOrmMapper),
  withQueryMapper(customQueryMapper),
  build,
);
```

### 2. Error Handling

Always handle mapping errors appropriately:

```typescript
const customDomainMapper = (entity: UserEntity) =>
  UserTrait.parse(entity).pipe(
    Effect.mapError((error) =>
      OperationException.new(
        'USER_MAPPING_FAILED',
        `Failed to map user entity: ${error.message}`,
        { details: [entity.id] },
      ),
    ),
  );
```

### 3. Query Optimization

Specify only necessary relations:

```typescript
// Good: Only load required relations
withRelations(['profile']);

// Avoid: Loading unnecessary data
withRelations(['profile', 'orders', 'orders.items', 'orders.payments']);
```

### 4. Type Safety

Use specific query parameter types:

```typescript
interface UserQuery {
  readonly email?: string;
  readonly status?: UserStatus;
  readonly createdAfter?: Date;
}

const repository = pipe(
  repositoryBuilder<User, UserEntity, UserQuery>(UserEntity),
  withQueryMapper((params: UserQuery) => ({
    email: params.email,
    status: params.status,
    createdAt: params.createdAfter ? MoreThan(params.createdAfter) : undefined,
  })),
  build,
);
```

### 5. Layer Organization

Group related repository layers:

```typescript
// Domain-specific layer bundles
const UserDomainLayer = Layer.merge(
  UserRepositoryLayer,
  UserProfileRepositoryLayer,
  UserPreferencesRepositoryLayer,
);

const ProductDomainLayer = Layer.merge(
  ProductRepositoryLayer,
  CategoryRepositoryLayer,
  InventoryRepositoryLayer,
);

const ApplicationLayer = Layer.mergeAll(
  UserDomainLayer,
  ProductDomainLayer,
  DatabaseLayer,
);
```

## Advanced Patterns

### 1. Repository Composition

Combine multiple repositories for complex operations:

```typescript
const createOrderWithInventoryCheck = (orderData: CreateOrderData) =>
  Effect.gen(function* () {
    const orderRepo = yield* OrderRepositoryTag;
    const inventoryRepo = yield* InventoryRepositoryTag;
    const customerRepo = yield* CustomerRepositoryTag;

    // Verify customer exists
    const customer = yield* customerRepo.findOneByIdOrThrow(
      orderData.customerId,
    );

    // Check inventory for all items
    yield* Effect.forEach(orderData.items, (item) =>
      Effect.gen(function* () {
        const inventory = yield* inventoryRepo.findOne({
          productId: item.productId,
        });
        yield* Effect.when(inventory.quantity < item.quantity, () =>
          Effect.fail(
            ValidationException.new(
              'INSUFFICIENT_INVENTORY',
              'Not enough stock',
            ),
          ),
        );
      }),
    );

    // Create order
    const order = yield* OrderTrait.new(orderData);
    yield* orderRepo.add(order);

    return order;
  });
```

### 2. Repository Middleware

Add cross-cutting concerns with middleware:

```typescript
const withAuditLog = <DM extends AggregateRoot>(
  baseRepository: RepositoryPort<DM>,
): RepositoryPort<DM> => ({
  ...baseRepository,
  save: (aggregate) =>
    Effect.gen(function* () {
      yield* baseRepository.save(aggregate);
      yield* auditLogger.log({
        action: 'SAVE',
        aggregateId: aggregate.id,
        aggregateType: aggregate._tag,
        timestamp: new Date(),
      });
    }),
  add: (aggregate) =>
    Effect.gen(function* () {
      yield* baseRepository.add(aggregate);
      yield* auditLogger.log({
        action: 'CREATE',
        aggregateId: aggregate.id,
        aggregateType: aggregate._tag,
        timestamp: new Date(),
      });
    }),
});
```

### 3. Generic Repository Factory

Create reusable factory functions:

```typescript
const createCRUDRepository = <DM extends AggregateRoot>(
  entityClass: new () => any,
  domainTrait: { parse: (raw: any) => Effect.Effect<DM, BaseException, never> },
  relations: string[] = [],
) =>
  createRepositoryWithConventions({
    entityClass,
    domainTrait,
    relations,
  });

// Usage
const userRepository = createCRUDRepository(UserEntity, UserTrait, ['profile']);
const productRepository = createCRUDRepository(ProductEntity, ProductTrait, [
  'category',
]);
```

## Performance Considerations

### 1. Relation Loading

- Use `relations` sparingly - only load what you need
- Consider implementing custom query methods for complex joins
- Use pagination for large result sets

### 2. Mapping Performance

- Cache parsed domain traits when possible
- Avoid complex transformations in hot paths
- Consider lazy loading for expensive computations

### 3. Query Optimization

- Implement efficient `prepareQuery` functions
- Use database indexes for frequently queried fields
- Profile query performance in development

## Integration with Effect Context

The Repository Factory integrates seamlessly with Effect's dependency injection system:

```typescript
// Application setup
const main = Effect.gen(function* () {
  const userService = yield* UserServiceTag;
  const result = yield* userService.createUser(userData);
  return result;
}).pipe(Effect.provide(ApplicationLayer));

// Run the application
const program = Effect.runPromise(main);
```

This functional approach ensures type safety, composability, and testability while maintaining clean separation between domain logic and infrastructure concerns.

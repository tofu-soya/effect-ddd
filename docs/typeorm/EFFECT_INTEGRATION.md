# Effect Repository Integration with Unit of Work

This guide explains how the Effect-based repositories in `src/ports/database/typeorm/` automatically integrate with the new NestJS Unit of Work pattern.

## Table of Contents

- [How It Works](#how-it-works)
- [Automatic Integration](#automatic-integration)
- [Effect-Based Usage](#effect-based-usage)
- [Mixing Promise and Effect Code](#mixing-promise-and-effect-code)
- [Complete Examples](#complete-examples)

---

## How It Works

### Shared CLS Context

Both the Effect repositories and the new UnitOfWork service use the **same CLS (Continuation Local Storage) namespace** to share the transactional EntityManager:

```
┌─────────────────────────────────────────────────────────┐
│              CLS Namespace (per-request)                │
│        Key: 'ENTITY_MANAGER' → EntityManager            │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              ▼                           ▼
    ┌─────────────────────┐     ┌──────────────────────┐
    │  UnitOfWork Service │     │ Effect Repository    │
    │  (NestJS)           │     │ (Domain)             │
    │                     │     │                      │
    │  • begin()          │     │ getEntityManager():  │
    │    → sets ENTITY_   │     │   reads ENTITY_      │
    │       MANAGER_KEY   │     │   MANAGER_KEY        │
    │  • commit()         │     │   from CLS           │
    │  • rollback()       │     │                      │
    └─────────────────────┘     └──────────────────────┘
```

### Code Evidence

**Effect Repository** (`src/ports/database/typeorm/effect-repository.factory.ts:81-90`):
```typescript
const getEntityManager = (): EntityManager => {
  const namespace = getNamespaceInstance();
  let entityManager = namespace?.get(ENTITY_MANAGER_KEY);

  if (!entityManager) {
    // For non-transactional operations
    entityManager = dataSource.manager;
  }
  return entityManager;
};
```

**UnitOfWork Service** (`src/infra/nestjs/typeorm/unit-of-work.service.ts:65-98`):
```typescript
begin(): Effect.Effect<EntityManager, OperationException> {
  return Effect.tryPromise({
    catch: (error) =>
      OperationException.new(
        'TRANSACTION_BEGIN_FAILED',
        `something went wrong ${error}`,
      ),
    try: async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Set EntityManager in CLS for repositories to use
      const namespace = getNamespaceInstance();
      namespace.set(ENTITY_MANAGER_KEY, queryRunner.manager);

      return queryRunner.manager;
    },
  });
}
```

Both use the same `ENTITY_MANAGER_KEY` constant from `src/infra/nestjs/cls.middleware.ts:12`.

---

## Automatic Integration

### Zero Configuration Required

Effect repositories created with `createTypeormRepository()` automatically participate in transactions:

```typescript
// 1. Define your Effect repository (domain layer)
const userRepository = pipe(
  Effect.gen(function* () {
    const dataSource = yield* DataSourceContext;
    return yield* createTypeormRepository({
      dataSource,
      entityClass: UserEntity,
      relations: ['profile'],
      toDomain: (entity) => UserTrait.parse(entity),
      toOrm: (domain, existing, repo) => Effect.succeed({ ...domain }),
      prepareQuery: (params) => ({ id: params.id }),
    });
  })
);

// 2. Use @Transactional decorator in application layer
@Injectable()
export class CreateUserHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()
  async execute(command: CreateUserCommand): Promise<User> {
    // UnitOfWork.begin() sets EntityManager in CLS

    // Effect repository automatically uses transactional EntityManager
    const program = pipe(
      userRepository,
      Effect.flatMap((repo) => {
        const user = User.create(command);
        return repo.save(user); // Uses transactional EntityManager!
      })
    );

    return Effect.runPromise(program);

    // UnitOfWork.commit() persists everything
  }
}
```

### How Repositories Detect Transactions

1. **Transaction Started**: `@Transactional` decorator calls `unitOfWork.begin()`
2. **EntityManager Injected**: UnitOfWork stores `QueryRunner.manager` in CLS
3. **Repository Reads CLS**: Effect repository calls `getEntityManager()`
4. **Automatic Participation**: Repository uses transactional EntityManager
5. **Commit**: Decorator calls `unitOfWork.commit()` on success

---

## Effect-Based Usage

### Using Effect Wrappers

We provide Effect-based wrappers for full functional composition:

```typescript
import { pipe } from 'effect';
import {
  withUnitOfWork,
  beginUnitOfWork,
  commitUnitOfWork,
  UnitOfWorkContext,
  createUnitOfWorkLayer,
} from 'effect-ddd/nestjs';

// Example 1: Automatic commit/rollback
const createUser = (data: UserData) =>
  pipe(
    Effect.gen(function* () {
      const repo = yield* UserRepositoryContext;
      const user = yield* User.create(data);
      yield* repo.save(user);
      return user;
    }),
    withUnitOfWork({ autoCommit: true })
  );

// Execute the program
const program = pipe(
  createUser({ name: 'John', email: 'john@example.com' }),
  Effect.provide(UserRepositoryLayer),
  Effect.provide(createUnitOfWorkLayer(unitOfWork))
);

await Effect.runPromise(program);
```

### Manual Commit Control

For complex workflows where you need to commit at specific points:

```typescript
const complexWorkflow = (data: ComplexData) =>
  Effect.gen(function* () {
    // Begin unit of work
    yield* beginUnitOfWork;

    try {
      // Step 1: Create user
      const userRepo = yield* UserRepositoryContext;
      const user = yield* User.create(data.user);
      yield* userRepo.save(user);

      // Step 2: Business validation
      const isValid = yield* validateBusinessRule(user);

      if (!isValid) {
        // Rollback on validation failure
        yield* rollbackUnitOfWork;
        return yield* Effect.fail(
          OperationException.new('VALIDATION_FAILED', 'Invalid data')
        );
      }

      // Step 3: Commit at the right moment
      yield* commitUnitOfWork;

      // Step 4: Non-transactional operations (after commit)
      yield* sendWelcomeEmail(user.email);

      return user;
    } catch (error) {
      // Auto-rollback on any error
      return yield* Effect.gen(function* () {
        const uow = yield* UnitOfWorkContext;
        if (uow.isActive()) {
          yield* rollbackUnitOfWork;
        }
        return yield* Effect.fail(error);
      });
    }
  });
```

### Composing Multiple Operations

```typescript
const transferFunds = (from: AccountId, to: AccountId, amount: Money) =>
  pipe(
    Effect.all([
      debitAccount(from, amount),
      creditAccount(to, amount),
      recordTransfer(from, to, amount),
    ]),
    Effect.flatMap(([debit, credit, record]) => {
      // All three operations use the same transaction
      return Effect.succeed({ debit, credit, record });
    }),
    withUnitOfWork({ autoCommit: true })
  );
```

---

## Mixing Promise and Effect Code

### Using Effect Repositories in NestJS Handlers

When you have NestJS handlers (Promise-based) using Effect repositories:

```typescript
@Injectable()
export class UserService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()
  async createUser(data: CreateUserDto): Promise<UserDto> {
    // Define Effect program
    const program = pipe(
      Effect.gen(function* () {
        const dataSource = yield* DataSourceContext;

        // Create repository
        const repo = yield* createTypeormRepository({
          dataSource,
          entityClass: UserEntity,
          // ... config
        });

        // Domain logic
        const user = yield* User.create(data);
        yield* repo.save(user);

        return user;
      }),
      Effect.provide(Layer.succeed(DataSourceContext, this.dataSource))
    );

    // Execute Effect program
    const result = await Effect.runPromise(program);

    return UserMapper.toDto(result);
  }
}
```

### Using executeInUnitOfWork

Bridge Promise-based code with Effect UnitOfWork:

```typescript
const program = pipe(
  Effect.succeed({ name: 'John' }),
  Effect.flatMap((data) =>
    executeInUnitOfWork(async (em) => {
      // Legacy TypeORM code inside Effect workflow
      const repo = em.getRepository(UserEntity);
      const user = repo.create(data);
      return repo.save(user);
    })
  ),
  Effect.provide(createUnitOfWorkLayer(unitOfWork))
);

const user = await Effect.runPromise(program);
```

---

## Complete Examples

### Example 1: CQRS Command Handler with Effect Repository

```typescript
// Domain Layer - Effect Repository
export const UserRepositoryContext = Context.Tag<RepositoryPort<User>>('UserRepository');

const createUserRepository = pipe(
  repositoryBuilder<User, UserEntity>(UserEntity),
  withRelations(['profile', 'roles']),
  withDomainMapper((entity) => UserTrait.parse(entity)),
  build
);

const UserRepositoryLayer = Layer.effect(
  UserRepositoryContext,
  createUserRepository
);

// Application Layer - Command Handler
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly unitOfWork: UnitOfWork,  // Injected by NestJS
    private readonly dataSource: DataSource,  // Injected by NestJS
  ) {}

  @Transactional()
  async execute(command: CreateUserCommand): Promise<string> {
    const program = pipe(
      Effect.gen(function* () {
        // Get repository from context
        const repo = yield* UserRepositoryContext;

        // Domain logic
        const user = yield* User.create({
          name: command.name,
          email: command.email,
        });

        // Validate
        yield* user.validate();

        // Save (uses transactional EntityManager)
        yield* repo.save(user);

        return user.id;
      }),
      Effect.provide(UserRepositoryLayer),
      Effect.provide(Layer.succeed(DataSourceContext, this.dataSource))
    );

    return Effect.runPromise(program);
  }
}
```

### Example 2: Saga Pattern with Multiple Aggregates

```typescript
// Module setup
@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, InventoryEntity, PaymentEntity])],
  providers: [UnitOfWork, OrderSagaHandler],  // UnitOfWork needs DataSource
})
export class OrderModule {}

@Injectable()
export class OrderSagaHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,  // Injected by NestJS
    private readonly dataSource: DataSource,  // Injected by NestJS
  ) {}

  @Transactional({ autoCommit: false })
  async createOrder(command: CreateOrderCommand): Promise<Order> {
    const program = pipe(
      Effect.gen(function* () {
        // Get all repositories
        const orderRepo = yield* OrderRepositoryContext;
        const inventoryRepo = yield* InventoryRepositoryContext;
        const paymentRepo = yield* PaymentRepositoryContext;

        // Step 1: Reserve inventory
        const items = yield* Effect.forEach(
          command.items,
          (item) => inventoryRepo.reserve(item),
          { concurrency: 'unbounded' }
        );

        // Step 2: Process payment
        const payment = yield* Payment.create(command.paymentInfo);
        yield* paymentRepo.charge(payment);

        // Step 3: Create order
        const order = yield* Order.create({
          items,
          payment,
          customer: command.customerId,
        });
        yield* orderRepo.save(order);

        return order;
      }),
      Effect.provide(OrderRepositoryLayer),
      Effect.provide(InventoryRepositoryLayer),
      Effect.provide(PaymentRepositoryLayer),
      Effect.provide(Layer.succeed(DataSourceContext, this.dataSource))
    );

    const order = await Effect.runPromise(program);

    // Commit transaction (returns Effect)
    await Effect.runPromise(this.unitOfWork.commit());

    // Non-transactional operations
    await this.emailService.sendOrderConfirmation(order);

    return order;
  }
}
```

### Example 3: Pure Effect Workflow

For pure Effect-based applications (no NestJS decorators):

```typescript
const createUserWorkflow = (data: UserData) =>
  pipe(
    Effect.gen(function* () {
      // Begin transaction
      yield* beginUnitOfWork;

      try {
        // Get repository
        const repo = yield* UserRepositoryContext;

        // Domain logic
        const user = yield* User.create(data);
        yield* user.validate();
        yield* repo.save(user);

        // Commit
        yield* commitUnitOfWork;

        return user;
      } catch (error) {
        // Rollback
        yield* rollbackUnitOfWork;
        return yield* Effect.fail(error);
      }
    }),
    Effect.provide(UserRepositoryLayer),
    Effect.provide(createUnitOfWorkLayer(unitOfWork)),
    Effect.provide(Layer.succeed(DataSourceContext, dataSource))
  );

// Execute
const user = await Effect.runPromise(createUserWorkflow({ name: 'John' }));
```

### Example 4: Using EffectUnitOfWorkTrait

```typescript
import { EffectUnitOfWorkTrait } from 'effect-ddd/nestjs';

const { withUnitOfWork, executeInUnitOfWork } = EffectUnitOfWorkTrait;

const program = pipe(
  Effect.gen(function* () {
    // Effect-based logic
    const repo = yield* UserRepositoryContext;
    const user = yield* User.create({ name: 'Alice' });
    yield* repo.save(user);

    // Mix with Promise-based legacy code
    const legacyResult = yield* executeInUnitOfWork(async (em) => {
      return em.query('SELECT * FROM legacy_table');
    });

    return { user, legacyResult };
  }),
  withUnitOfWork({ autoCommit: true })
);
```

---

## Key Takeaways

1. **Zero Configuration**: Effect repositories automatically participate in transactions via shared CLS context

2. **Choose Your Style**:
   - Use `@Transactional` decorator for Promise-based handlers
   - Use `withUnitOfWork` for Effect-based workflows
   - Mix both approaches as needed

3. **Same EntityManager**: Both approaches use the same transactional EntityManager from CLS

4. **Composability**: Effect-based wrappers enable full functional composition with `pipe`

5. **Type Safety**: All Effect operations are fully type-safe with proper error handling

6. **No Breaking Changes**: Existing Effect repositories work immediately with new UnitOfWork service

---

## API Reference

See these files for detailed API documentation:
- [Effect Integration](./effect-integration.ts) - Effect wrappers and utilities
- [UnitOfWork Service](./unit-of-work.service.ts) - Core UnitOfWork implementation
- [Effect Repository Factory](../../../ports/database/typeorm/effect-repository.factory.ts) - Effect repository creation
- [Repository Factory](../../../ports/database/typeorm/repository.factory.ts) - Repository builders and conventions

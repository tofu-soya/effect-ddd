# Effect Repository Integration with Unit of Work

This guide explains how to use `createTypeormRepository` with NestJS Dependency Injection and automatic transaction support via CLS (Continuation Local Storage).

## Table of Contents

- [Quick Start](#quick-start)
- [How Transactions Work](#how-transactions-work)
- [Complete Examples](#complete-examples)
- [API Reference](#api-reference)

---

## Quick Start

### 0. Required NestJS Setup (CLS + UnitOfWork)

The transaction system depends on **CLS context per request** and a **UnitOfWork provider**. Without these, `@Transactional()` cannot share the EntityManager with repositories.

**Add CLS middleware in your AppModule** (creates a new CLS context per request):

```typescript
// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClsMiddleware } from 'effect-ddd/nestjs';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
```

**Register UnitOfWork in AppModule (or a shared CoreModule) using a factory**, then import that module wherever you use `@Transactional` (e.g., `UserModule`):

```typescript
// app.module.ts (or CoreModule)
import { Module } from '@nestjs/common';
import { UnitOfWork } from 'effect-ddd/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    {
      provide: UnitOfWork,
      useFactory: (dataSource: DataSource) => new UnitOfWork(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [UnitOfWork], // import this module in feature modules
})
export class CoreModule {}
```

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CoreModule],
})
export class UserModule {}
```

### 1. Create Repository in NestJS Module

The `createTypeormRepository` function takes all dependencies directly via config (DataSource, DomainEventPublisher). The returned repository methods return `Effect<A, E>` with **NO Effect Context requirements**.

**Option A: Using the helper function (recommended)**

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { Effect } from 'effect';
import { createTypeormRepositoryProvider } from 'effect-ddd';
import { UserEntity } from './entities/user.entity';
import { UserTrait } from './domain/user';

@Module({
  providers: [
    createTypeormRepositoryProvider({
      token: 'UserRepository',
      publisherToken: 'DomainEventPublisher',
      entityClass: UserEntity,
      relations: ['profile', 'roles'],
      toDomain: (entity) => UserTrait.parse(entity),
      toOrm: (domain, existing, repo) =>
        Effect.succeed({
          id: domain.id,
          name: domain.name.value,
          email: domain.email.value,
        }),
      prepareQuery: (params) => ({ id: params.id }),
    }),
  ],
})
export class UserModule {}
```

**Option B: Manual useFactory**

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Effect } from 'effect';
import { createTypeormRepository } from 'effect-ddd/typeorm';
import { IDomainEventPublisher } from 'effect-ddd';
import { UserEntity } from './entities/user.entity';
import { UserTrait } from './domain/user';

@Module({
  providers: [
    {
      provide: 'UserRepository',
      useFactory: (dataSource: DataSource, publisher: IDomainEventPublisher) =>
        createTypeormRepository({
          dataSource,
          publisher,
          entityClass: UserEntity,
          relations: ['profile', 'roles'],
          toDomain: (entity) => UserTrait.parse(entity),
          toOrm: (domain, existing, repo) =>
            Effect.succeed({
              id: domain.id,
              name: domain.name.value,
              email: domain.email.value,
            }),
          prepareQuery: (params) => ({ id: params.id }),
        }),
      inject: [DataSource, 'DomainEventPublisher'],
    },
  ],
})
export class UserModule {}
```

### 2. Use Repository in Services

```typescript
// user.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Effect, pipe } from 'effect';
import { RepositoryPort } from 'effect-ddd';
import { User } from './domain/user';

@Injectable()
export class UserService {
  constructor(
    @Inject('UserRepository')
    private readonly userRepo: RepositoryPort<User>,
  ) {}

  async findUser(id: string): Promise<User> {
    // Simple - no Layer required, just run it!
    return Effect.runPromise(this.userRepo.findOneByIdOrThrow(id));
  }

  async createUser(data: CreateUserDto): Promise<void> {
    const effect = pipe(
      UserTrait.create(data),
      Effect.flatMap((user) => this.userRepo.add(user)),
    );
    return Effect.runPromise(effect);
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<void> {
    const effect = pipe(
      this.userRepo.findOneByIdOrThrow(id),
      Effect.flatMap((user) => user.update(data)),
      Effect.flatMap((user) => this.userRepo.save(user)),
    );
    return Effect.runPromise(effect);
  }
}
```

### 3. Add Transaction Support

Use `@Transactional` decorator for automatic transaction management:

```typescript
import { Transactional, UnitOfWork } from 'effect-ddd/nestjs';

@Injectable()
export class UserService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: RepositoryPort<User>,
    @Inject('OrderRepository') private readonly orderRepo: RepositoryPort<Order>,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  @Transactional() // Automatically begins/commits/rollbacks transaction
  async createUserWithOrder(data: CreateUserWithOrderDto): Promise<void> {
    // Both repositories automatically use the transactional EntityManager
    // because they read from CLS (Continuation Local Storage)
    const effect = pipe(
      UserTrait.create(data.user),
      Effect.flatMap((user) => this.userRepo.add(user)),
      Effect.flatMap(() => OrderTrait.create(data.order)),
      Effect.flatMap((order) => this.orderRepo.add(order)),
    );

    return Effect.runPromise(effect);
    // Transaction is automatically committed on success, rolled back on failure
  }
}
```

---

## How Transactions Work

### Shared CLS Context

Both the repositories and the UnitOfWork service use the **same CLS namespace** to share the transactional EntityManager:

```
┌─────────────────────────────────────────────────────────┐
│              CLS Namespace (per-request)                │
│        Key: 'ENTITY_MANAGER' → EntityManager            │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              ▼                           ▼
    ┌─────────────────────┐     ┌──────────────────────┐
    │  UnitOfWork Service │     │ Repository           │
    │  (NestJS)           │     │                      │
    │                     │     │ getEntityManager():  │
    │  • begin()          │     │   reads ENTITY_      │
    │    → sets ENTITY_   │     │   MANAGER_KEY        │
    │       MANAGER_KEY   │     │   from CLS           │
    │  • commit()         │     │                      │
    │  • rollback()       │     │                      │
    └─────────────────────┘     └──────────────────────┘
```

### How It Works

1. **Transaction Started**: `@Transactional` decorator calls `unitOfWork.begin()`
2. **EntityManager Stored**: UnitOfWork stores `QueryRunner.manager` in CLS
3. **Repository Reads CLS**: Repository calls `getEntityManager()` which reads from CLS
4. **Automatic Participation**: Repository uses transactional EntityManager
5. **Commit/Rollback**: Decorator calls `unitOfWork.commit()` on success or `rollback()` on failure

### Code Evidence

**Repository** (`src/ports/database/typeorm/effect-repository.factory.ts`):
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

---

## Complete Examples

### Example 1: CQRS Command Handler

```typescript
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject('UserRepository') private readonly userRepo: RepositoryPort<User>,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  @Transactional()
  async execute(command: CreateUserCommand): Promise<string> {
    const effect = pipe(
      UserTrait.create({
        name: command.name,
        email: command.email,
      }),
      Effect.flatMap((user) => user.validate()),
      Effect.flatMap((user) => this.userRepo.add(user)),
      Effect.map((user) => user.id),
    );

    return Effect.runPromise(effect);
  }
}
```

### Example 2: Multiple Aggregates in One Transaction

```typescript
@Injectable()
export class OrderService {
  constructor(
    @Inject('OrderRepository') private readonly orderRepo: RepositoryPort<Order>,
    @Inject('InventoryRepository') private readonly inventoryRepo: RepositoryPort<Inventory>,
    @Inject('PaymentRepository') private readonly paymentRepo: RepositoryPort<Payment>,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  @Transactional()
  async createOrder(command: CreateOrderCommand): Promise<Order> {
    const effect = pipe(
      // Step 1: Reserve inventory
      Effect.forEach(
        command.items,
        (item) => this.inventoryRepo.reserve(item),
        { concurrency: 'unbounded' },
      ),
      // Step 2: Process payment
      Effect.flatMap((items) =>
        pipe(
          PaymentTrait.create(command.paymentInfo),
          Effect.flatMap((payment) => this.paymentRepo.charge(payment)),
          Effect.map((payment) => ({ items, payment })),
        ),
      ),
      // Step 3: Create order
      Effect.flatMap(({ items, payment }) =>
        pipe(
          OrderTrait.create({ items, payment, customerId: command.customerId }),
          Effect.flatMap((order) => this.orderRepo.add(order)),
        ),
      ),
    );

    return Effect.runPromise(effect);
    // All three operations are in the same transaction
  }
}
```

### Example 3: Manual Transaction Control

For cases where you need more control over transactions:

```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: RepositoryPort<User>,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async createUserWithValidation(data: CreateUserDto): Promise<User> {
    // Begin transaction
    await Effect.runPromise(this.unitOfWork.begin());

    try {
      const effect = pipe(
        UserTrait.create(data),
        Effect.flatMap((user) => this.userRepo.add(user)),
      );

      const user = await Effect.runPromise(effect);

      // Additional validation after save
      if (!await this.validateExternalService(user)) {
        await Effect.runPromise(this.unitOfWork.rollback());
        throw new Error('External validation failed');
      }

      // Commit
      await Effect.runPromise(this.unitOfWork.commit());

      // Post-commit operations (outside transaction)
      await this.sendWelcomeEmail(user.email);

      return user;
    } catch (error) {
      if (this.unitOfWork.isActive()) {
        await Effect.runPromise(this.unitOfWork.rollback());
      }
      throw error;
    }
  }
}
```

---

## API Reference

### createTypeormRepositoryProvider

Helper function to create NestJS provider for repository (recommended).

```typescript
function createTypeormRepositoryProvider<DM, OrmEntity, QueryParams>(options: {
  token: string | symbol;
  publisherToken: string | symbol;
  entityClass: new () => OrmEntity;
  relations: string[];
  toDomain: (entity: OrmEntity) => Effect<DM, E>;
  toOrm: (domain: DM, existing: Option<OrmEntity>, repo: Repository<OrmEntity>) => Effect<OrmEntity, E>;
  prepareQuery: (params: QueryParams) => FindOptionsWhere<OrmEntity>;
}): TypeormRepositoryProvider<DM>
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `token` | `string \| symbol` | NestJS injection token for the repository |
| `publisherToken` | `string \| symbol` | NestJS injection token for DomainEventPublisher |
| `entityClass` | `new () => OrmEntity` | TypeORM entity class |
| `relations` | `string[]` | Relations to eager load |
| `toDomain` | `(entity) => Effect<DM, E>` | Convert ORM entity to domain model |
| `toOrm` | `(domain, existing, repo) => Effect<OrmEntity, E>` | Convert domain model to ORM entity |
| `prepareQuery` | `(params) => FindOptionsWhere` | Convert query params to TypeORM where clause |

### createTypeormRepository

Lower-level function for manual factory setup.

```typescript
function createTypeormRepository<DM, OrmEntity, QueryParams>(
  config: TypeormRepositoryConfig<DM, OrmEntity, QueryParams>
): RepositoryPort<DM>
```

**Config Options:**

| Option | Type | Description |
|--------|------|-------------|
| `dataSource` | `DataSource` | TypeORM DataSource (inject via NestJS DI) |
| `publisher` | `IDomainEventPublisher` | Domain event publisher (inject via NestJS DI) |
| `entityClass` | `new () => OrmEntity` | TypeORM entity class |
| `relations` | `string[]` | Relations to eager load |
| `toDomain` | `(entity) => Effect<DM, E>` | Convert ORM entity to domain model |
| `toOrm` | `(domain, existing, repo) => Effect<OrmEntity, E>` | Convert domain model to ORM entity |
| `prepareQuery` | `(params) => FindOptionsWhere` | Convert query params to TypeORM where clause |

### RepositoryPort Methods

All methods return `Effect<A, BaseException>` (no context requirements):

| Method | Signature | Description |
|--------|-----------|-------------|
| `add` | `(entity: DM) => Effect<void, E>` | Insert new entity |
| `save` | `(entity: DM) => Effect<void, E>` | Update existing entity |
| `saveMultiple` | `(entities: DM[]) => Effect<void, E>` | Save multiple entities |
| `findOne` | `(params) => Effect<Option<DM>, E>` | Find one, return Option |
| `findOneOrThrow` | `(params) => Effect<DM, E>` | Find one or fail |
| `findOneByIdOrThrow` | `(id) => Effect<DM, E>` | Find by ID or fail |
| `findMany` | `(params) => Effect<DM[], E>` | Find multiple |
| `findManyPaginated` | `(options) => Effect<Paginated<DM[]>, E>` | Find with pagination |
| `delete` | `(entity) => Effect<void, E>` | Delete entity |

---

## See Also

- [UnitOfWork Service](../../src/infra/nestjs/typeorm/unit-of-work.service.ts)
- [Transactional Decorator](../../src/infra/nestjs/typeorm/transactional.decorator.ts)
- [CLS Middleware](../../src/infra/nestjs/cls.middleware.ts)

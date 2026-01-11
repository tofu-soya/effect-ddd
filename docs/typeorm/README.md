# TypeORM Infrastructure with Unit of Work Pattern

This module provides TypeORM integration with automatic transaction management using the Unit of Work pattern and CLS (Continuation Local Storage) for request-scoped transactions.

## Features

- **BaseRepository**: Transaction-aware repository that automatically uses the correct EntityManager
- **Unit of Work Pattern**: Explicit control over transactional boundaries
- **@Transactional Decorator**: Automatic transaction management for usecase handlers
- **CLS Integration**: Request-scoped transaction context without explicit parameter passing

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Usecase Handler                       │
│              (@Transactional decorator)                 │
└─────────────────────┬───────────────────────────────────┘
                      │ begins Unit of Work
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  UnitOfWork Service                     │
│  • Creates QueryRunner & EntityManager                  │
│  • Injects into CLS context                            │
│  • Manages commit/rollback                             │
└─────────────────────┬───────────────────────────────────┘
                      │ sets ENTITY_MANAGER_KEY
                      ▼
┌─────────────────────────────────────────────────────────┐
│               CLS Namespace (per-request)               │
│         Stores: EntityManager, UnitOfWorkContext        │
└─────────────────────┬───────────────────────────────────┘
                      │ repositories read from
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 BaseRepository                          │
│  • Reads EntityManager from CLS                        │
│  • Falls back to default DataSource.manager            │
│  • All operations use transactional EntityManager       │
└─────────────────────────────────────────────────────────┘
```

## Setup

### 1. Configure CLS Middleware

Ensure CLS middleware is configured in your NestJS application:

```typescript
// app.module.ts
import { ClsMiddleware } from 'effect-ddd/nestjs';

@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
```

### 2. Register UnitOfWork Service

Register `UnitOfWork` as a provider in your module. **Important**: `UnitOfWork` requires `DataSource` to be injected, so you must have TypeORM configured first.

```typescript
// cv-management.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitOfWork } from 'effect-ddd/nestjs';

@Module({
  imports: [
    // TypeORM must be imported to provide DataSource
    TypeOrmModule.forRoot({
      type: 'postgres',
      // ... your database config
    }),
    // Or if this is a feature module:
    // TypeOrmModule.forFeature([YourEntity1, YourEntity2]),
  ],
  providers: [
    UnitOfWork,  // NestJS will auto-inject DataSource
    // ... other providers
  ],
})
export class CvManagementModule {}
```

**Alternative 1**: If you use a custom `dataSourceFactory` in `TypeOrmModule.forRootAsync()`:

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
    // ... other providers
  ],
})
export class CvManagementModule {}
```

**Alternative 2**: Manual provider with custom factory:

```typescript
import { DataSource } from 'typeorm';

@Module({
  providers: [
    {
      provide: UnitOfWork,
      useFactory: (dataSource: DataSource) => new UnitOfWork(dataSource),
      inject: [DataSource],
    },
    // ... other providers
  ],
})
export class CvManagementModule {}
```

### 3. Create Repository Providers

Create transactional repository providers for your entities:

```typescript
// cv-management.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createTypeOrmRepositoryProvider,
  TypeOrmBaseRepository,
  UnitOfWork,
} from 'effect-ddd/nestjs';
import { CandidateEntity } from './infrastructure/entities/candidate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateEntity]),  // Register entities
  ],
  providers: [
    UnitOfWork,  // Requires DataSource from TypeOrmModule
    // Creates 'CandidateEntityTransRepository' provider
    createTypeOrmRepositoryProvider(CandidateEntity),
    // ... other providers
  ],
})
export class CvManagementModule {}
```

## Usage

### Option 1: Using @Transactional Decorator (Recommended)

The decorator automatically manages the unit of work lifecycle:

```typescript
import { Injectable } from '@nestjs/common';
import { Transactional, UnitOfWork } from 'effect-ddd/nestjs';
import { CandidateRepository } from './repositories/candidate.repository';

@Injectable()
export class CreateCandidateHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly candidateRepo: CandidateRepository,
  ) {}

  @Transactional()
  async execute(command: CreateCandidateCommand): Promise<string> {
    // Unit of work already started automatically

    const candidate = new Candidate(command.name, command.email);
    await this.candidateRepo.save(candidate);

    // Transaction committed automatically on success
    // Or rolled back automatically on error
    return candidate.id;
  }
}
```

### Option 2: Manual Commit with Decorator

Disable auto-commit if you need to commit at a specific point:

```typescript
@Injectable()
export class ComplexUseCaseHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly candidateRepo: CandidateRepository,
    private readonly cvRepo: CvRepository,
  ) {}

  @Transactional({ autoCommit: false })
  async execute(command: ComplexCommand): Promise<void> {
    // Step 1: Create candidate
    const candidate = await this.candidateRepo.save(/*...*/);

    // Step 2: Some business logic that might fail
    // If this fails, transaction will be rolled back
    const validation = await this.validateSomething(candidate);

    // Step 3: Commit at the right moment (Effect-based)
    await Effect.runPromise(this.unitOfWork.commit());

    // Step 4: Non-transactional operations after commit
    await this.sendEmail(candidate.email);
  }
}
```

### Option 3: Programmatic Unit of Work

Use `UnitOfWork.execute()` for functional approach:

```typescript
@Injectable()
export class SomeService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async doWork(): Promise<void> {
    // execute() returns Effect, so wrap with Effect.runPromise
    await Effect.runPromise(
      this.unitOfWork.execute((entityManager) => {
        // All code here runs in a transaction
        // entityManager is the transactional EntityManager

        const repo = entityManager.getRepository(CandidateEntity);
        return Effect.promise(() => repo.save(/*...*/));

        // Auto-committed on success
        // Auto-rolled back on error
      })
    );
  }
}
```

### Option 4: Manual Unit of Work Control

For complete control over the lifecycle:

```typescript
@Injectable()
export class AdvancedService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async complexOperation(): Promise<void> {
    // Begin unit of work (returns Effect)
    await Effect.runPromise(this.unitOfWork.begin());

    try {
      // Do work...
      await this.doSomething();

      // Explicitly commit (returns Effect)
      await Effect.runPromise(this.unitOfWork.commit());
    } catch (error) {
      // Explicitly rollback (returns Effect)
      await Effect.runPromise(this.unitOfWork.rollback());
      throw error;
    }
  }
}
```

## Creating Custom Repositories

### Extending BaseRepository

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TypeOrmBaseRepository } from 'effect-ddd/nestjs';
import { CandidateEntity } from '../entities/candidate.entity';

@Injectable()
export class CandidateRepository extends TypeOrmBaseRepository<CandidateEntity> {
  constructor(dataSource: DataSource) {
    super(dataSource, CandidateEntity);
  }

  // Add custom query methods
  async findByEmail(email: string): Promise<CandidateEntity | null> {
    // getRepository() automatically uses transactional EntityManager if available
    return this.getRepository().findOne({ where: { email } });
  }

  async findDuplicates(
    firstName: string,
    lastName: string,
  ): Promise<CandidateEntity[]> {
    // createQueryBuilder() also uses transactional EntityManager
    return this.createQueryBuilder('candidate')
      .where('candidate.firstName = :firstName', { firstName })
      .andWhere('candidate.lastName = :lastName', { lastName })
      .getMany();
  }
}
```

### Using Injected TransRepository

If you used `createTypeOrmRepositoryProvider`, inject the generated repository:

```typescript
@Injectable()
export class SomeService {
  constructor(
    @Inject('CandidateEntityTransRepository')
    private readonly candidateRepo: TypeOrmBaseRepository<CandidateEntity>,
  ) {}

  async findCandidate(id: string): Promise<CandidateEntity | null> {
    return this.candidateRepo.findOne({ where: { id } });
  }
}
```

## Utilities

### Check if in Transaction

```typescript
import { isInTransaction, getCurrentEntityManager } from 'effect-ddd/nestjs';

@Injectable()
export class SomeService {
  async doWork(): Promise<void> {
    if (isInTransaction()) {
      console.log('Running in transaction');
    }

    const em = getCurrentEntityManager();
    if (em) {
      // Use transactional EntityManager
    }
  }
}
```

### Require Transactional Context

```typescript
import { requireEntityManager } from 'effect-ddd/nestjs';

@Injectable()
export class StrictService {
  async mustRunInTransaction(): Promise<void> {
    // Throws error if not in transactional context
    const em = requireEntityManager();

    // Guaranteed to have EntityManager here
    await em.query('...');
  }
}
```

## Best Practices

### 1. Use @Transactional for Usecase Handlers

```typescript
// ✅ Good: Clear transactional boundary at handler level
@Injectable()
export class CreateOrderHandler {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  @Transactional()
  async execute(command: CreateOrderCommand): Promise<Order> {
    // All repository operations are transactional
  }
}
```

### 2. Keep Transactions Short

```typescript
// ✅ Good: Transaction only around database operations
@Transactional({ autoCommit: false })
async execute(command: Command): Promise<void> {
  // Fast database operations
  await this.repo.save(entity);
  await Effect.runPromise(this.unitOfWork.commit());

  // Slow external API call after commit
  await this.externalApi.notify();
}

// ❌ Bad: Transaction includes slow external operations
@Transactional()
async execute(command: Command): Promise<void> {
  await this.repo.save(entity);
  await this.slowExternalApi.call(); // Transaction still open!
}
```

### 3. One Unit of Work per Request

```typescript
// ✅ Good: Single transaction per usecase
@Transactional()
async execute(command: Command): Promise<void> {
  await this.doStep1();
  await this.doStep2();
  // All steps in same transaction
}

// ❌ Bad: Nested transactions (will throw error)
@Transactional()
async outer(): Promise<void> {
  await this.inner(); // Error: nested transaction!
}

@Transactional()
async inner(): Promise<void> {
  // ...
}
```

### 4. Handle Errors Properly

```typescript
// ✅ Good: Let decorator handle rollback
@Transactional()
async execute(command: Command): Promise<void> {
  if (invalid) {
    throw new ValidationException(); // Auto-rollback
  }
  await this.repo.save(entity);
}

// ❌ Bad: Catching and swallowing errors
@Transactional()
async execute(command: Command): Promise<void> {
  try {
    await this.repo.save(entity);
  } catch (error) {
    console.log(error); // Transaction not rolled back!
    // Should re-throw or handle properly
  }
}
```

## How It Works

### Transaction Flow

1. **Handler Execution Starts**
   - `@Transactional` decorator intercepts method call
   - Calls `unitOfWork.begin()` (returns Effect, internally run with `Effect.runPromise`)

2. **Unit of Work Begins**
   - Creates `QueryRunner` from `DataSource`
   - Starts database transaction
   - Creates transactional `EntityManager`
   - Stores context in CLS namespace

3. **Repository Operations**
   - Repository calls `getEntityManager()`
   - Reads `ENTITY_MANAGER_KEY` from CLS
   - Uses transactional `EntityManager`
   - All operations are part of the same transaction

4. **Commit/Rollback**
   - On success: `unitOfWork.commit()` persists changes (returns Effect)
   - On error: `unitOfWork.rollback()` discards changes (returns Effect)
   - Releases `QueryRunner` and clears CLS context

**Note**: When using UnitOfWork methods directly (outside `@Transactional`), wrap calls with `Effect.runPromise()`:
```typescript
import { Effect } from 'effect';
await Effect.runPromise(this.unitOfWork.commit());
```

### CLS Context Structure

```typescript
CLS Namespace {
  'ENTITY_MANAGER_KEY': EntityManager,  // Used by repositories
  'UNIT_OF_WORK_CONTEXT': {             // Used by UnitOfWork service
    queryRunner: QueryRunner,
    entityManager: EntityManager,
    isActive: boolean
  }
}
```

## Troubleshooting

### "EntityManager not found in context"

**Cause**: Code is running outside a transactional context.

**Solution**: Wrap with `@Transactional` or `unitOfWork.execute()`.

### "Unit of work already active"

**Cause**: Nested `@Transactional` decorators or multiple `begin()` calls.

**Solution**: Only use one transactional boundary per request flow.

### Repository not using transactional EntityManager

**Cause**: Repository not extending `BaseRepository` or CLS middleware not configured.

**Solution**:
1. Ensure CLS middleware is applied globally
2. Extend `TypeOrmBaseRepository`
3. Use `getRepository()` method, not direct TypeORM repository

### Changes not persisted

**Cause**: Transaction not committed (autoCommit: false) or error occurred.

**Solution**:
1. Check if `autoCommit: true` (default)
2. If manual, ensure `unitOfWork.commit()` is called
3. Check for errors that trigger rollback

## Advanced Patterns

### Saga Pattern with Multiple Aggregates

```typescript
@Injectable()
export class OrderSagaHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly orderRepo: OrderRepository,
    private readonly inventoryRepo: InventoryRepository,
    private readonly paymentRepo: PaymentRepository,
  ) {}

  @Transactional({ autoCommit: false })
  async execute(command: CreateOrderCommand): Promise<void> {
    // Step 1: Reserve inventory
    const items = await this.inventoryRepo.reserve(command.items);

    // Step 2: Process payment
    const payment = await this.paymentRepo.charge(command.payment);

    // Step 3: Create order
    const order = await this.orderRepo.create(command, items, payment);

    // Commit all changes atomically (Effect-based)
    await Effect.runPromise(this.unitOfWork.commit());

    // Step 4: Send notifications (outside transaction)
    await this.notificationService.sendConfirmation(order);
  }
}
```

### Integration with Domain Events

```typescript
@Injectable()
export class DomainEventPublisher {
  private events: DomainEvent[] = [];

  collectEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  async publishAll(): Promise<void> {
    // Publish events after transaction commits
    for (const event of this.events) {
      await this.eventBus.publish(event);
    }
    this.events = [];
  }
}

@Injectable()
export class UseCaseHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  @Transactional({ autoCommit: false })
  async execute(command: Command): Promise<void> {
    // Collect domain events
    const aggregate = Aggregate.create(command);
    aggregate.events.forEach(e => this.eventPublisher.collectEvent(e));

    // Save changes
    await this.repo.save(aggregate);
    await Effect.runPromise(this.unitOfWork.commit());

    // Publish events after successful commit
    await this.eventPublisher.publishAll();
  }
}
```

## Related Documentation

For deeper understanding of specific topics:

- **[Concurrency and Isolation Deep Dive](./CONCURRENCY_AND_ISOLATION.md)** - Comprehensive explanation of how CLS provides isolation for concurrent requests, how singleton services safely handle multiple simultaneous requests, and transaction sharing patterns within a request
- **[Effect Integration Guide](./EFFECT_INTEGRATION.md)** - How Effect-based domain repositories integrate with UnitOfWork, functional composition patterns, and complete examples

## API Reference

See individual files for detailed API documentation:
- [UnitOfWork Service](../../src/infra/nestjs/typeorm/unit-of-work.service.ts)
- [Transactional Decorator](../../src/infra/nestjs/typeorm/transactional.decorator.ts)
- [BaseRepository](../../src/infra/nestjs/typeorm/base.repository.ts)
- [Utilities](../../src/infra/nestjs/typeorm/transactional.utils.ts)
- [Effect Integration](../../src/infra/nestjs/typeorm/effect-integration.ts)

import { Context, Effect, Layer, pipe } from 'effect';
import { EntityManager } from 'typeorm';
import { UnitOfWork } from './unit-of-work.service';
import { BaseException, OperationException } from '@model/exception';

/**
 * Effect Context for UnitOfWork
 * Allows injecting UnitOfWork into Effect workflows
 */
export class UnitOfWorkContext extends Context.Tag('UnitOfWork')<
  UnitOfWorkContext,
  UnitOfWork
>() {}

/**
 * Effect Context for EntityManager
 * Provides access to the current transactional EntityManager
 */
export class EntityManagerContext extends Context.Tag('EntityManager')<
  EntityManagerContext,
  EntityManager
>() {}

/**
 * Create a Layer that provides UnitOfWork service
 *
 * Usage:
 * ```typescript
 * const UnitOfWorkLayer = createUnitOfWorkLayer(unitOfWork);
 * const program = pipe(
 *   myEffect,
 *   Effect.provide(UnitOfWorkLayer)
 * );
 * ```
 */
export const createUnitOfWorkLayer = (
  unitOfWork: UnitOfWork,
): Layer.Layer<UnitOfWorkContext> =>
  Layer.succeed(UnitOfWorkContext, unitOfWork);

/**
 * Begin a unit of work and return Effect with EntityManager context
 *
 * Usage:
 * ```typescript
 * const program = pipe(
 *   beginUnitOfWork,
 *   Effect.flatMap(() => {
 *     // Your domain logic here using repositories
 *     return myRepositoryOperation();
 *   }),
 *   Effect.flatMap(() => commitUnitOfWork)
 * );
 * ```
 */
export const beginUnitOfWork: Effect.Effect<
  EntityManager,
  BaseException,
  UnitOfWorkContext
> = Effect.gen(function* () {
  const uow = yield* UnitOfWorkContext;

  const entityManager = yield* uow.begin();
  return entityManager;
});

/**
 * Commit the current unit of work
 *
 * Usage:
 * ```typescript
 * const program = pipe(
 *   beginUnitOfWork,
 *   Effect.flatMap(() => myDomainLogic()),
 *   Effect.flatMap(() => commitUnitOfWork)
 * );
 * ```
 */
export const commitUnitOfWork: Effect.Effect<
  void,
  BaseException,
  UnitOfWorkContext
> = Effect.gen(function* () {
  const uow = yield* UnitOfWorkContext;
  return uow.commit();
});

/**
 * Rollback the current unit of work
 *
 * Usage:
 * ```typescript
 * const program = pipe(
 *   beginUnitOfWork,
 *   Effect.flatMap(() => myDomainLogic()),
 *   Effect.catchAll((error) =>
 *     pipe(
 *       rollbackUnitOfWork,
 *       Effect.flatMap(() => Effect.fail(error))
 *     )
 *   )
 * );
 * ```
 */
export const rollbackUnitOfWork: Effect.Effect<
  void,
  BaseException,
  UnitOfWorkContext
> = Effect.gen(function* () {
  const uow = yield* UnitOfWorkContext;

  yield* uow.rollback();
});

/**
 * Execute Effect within a unit of work with automatic commit/rollback
 *
 * This is the Effect equivalent of the @Transactional decorator.
 *
 * Usage:
 * ```typescript
 * const createUser = (data: UserData) =>
 *   pipe(
 *     Effect.gen(function* () {
 *       const repo = yield* UserRepositoryContext;
 *       const user = User.create(data);
 *       yield* repo.save(user);
 *       return user;
 *     }),
 *     withUnitOfWork({ autoCommit: true })
 *   );
 * ```
 */
export const withUnitOfWork =
  (options: { autoCommit?: boolean } = {}) =>
  <A, E extends BaseException, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | BaseException, R | UnitOfWorkContext> => {
    const { autoCommit = true } = options;

    return Effect.gen(function* () {
      // Begin unit of work
      yield* beginUnitOfWork;

      try {
        // Execute the effect
        const result = yield* effect;

        // Auto-commit if enabled
        if (autoCommit) {
          yield* commitUnitOfWork;
        }

        return result;
      } catch (error) {
        // Rollback on error
        const uow = yield* UnitOfWorkContext;
        if (uow.isActive()) {
          yield* rollbackUnitOfWork;
        }
        throw error;
      }
    });
  };

/**
 * Execute a Promise-based function within a unit of work
 *
 * This bridges Promise-based code with Effect-based UnitOfWork.
 *
 * Usage:
 * ```typescript
 * const program = pipe(
 *   Effect.succeed({ name: 'John' }),
 *   Effect.flatMap((data) =>
 *     executeInUnitOfWork(async (em) => {
 *       const repo = em.getRepository(UserEntity);
 *       return repo.save({ ...data });
 *     })
 *   )
 * );
 * ```
 */
export const executeInUnitOfWork = <T>(
  work: (entityManager: EntityManager) => Effect.Effect<T, BaseException>,
  options: { autoCommit?: boolean } = {},
): Effect.Effect<T, BaseException, UnitOfWorkContext> =>
  Effect.gen(function* () {
    const uow = yield* UnitOfWorkContext;
    const result = yield* uow.execute(work, options);
    return result;
  });

/**
 * Check if currently in an active unit of work
 *
 * Usage:
 * ```typescript
 * const program = pipe(
 *   isUnitOfWorkActive,
 *   Effect.flatMap((isActive) =>
 *     Effect.if(isActive, {
 *       onTrue: () => Effect.log('In transaction'),
 *       onFalse: () => Effect.log('Not in transaction')
 *     })
 *   )
 * );
 * ```
 */
export const isUnitOfWorkActive: Effect.Effect<
  boolean,
  never,
  UnitOfWorkContext
> = Effect.gen(function* () {
  const uow = yield* UnitOfWorkContext;
  return uow.isActive();
});

/**
 * Get the current EntityManager or fail if not in a unit of work
 *
 * Usage:
 * ```typescript
 * const program = pipe(
 *   getEntityManagerOrFail,
 *   Effect.flatMap((em) => {
 *     const repo = em.getRepository(UserEntity);
 *     return Effect.promise(() => repo.find());
 *   })
 * );
 * ```
 */
export const getEntityManagerOrFail: Effect.Effect<
  EntityManager,
  BaseException,
  UnitOfWorkContext
> = Effect.gen(function* () {
  const uow = yield* UnitOfWorkContext;
  const em = uow.getEntityManager();

  if (!em) {
    return yield* Effect.fail(
      OperationException.new(
        'NO_ENTITY_MANAGER',
        'No EntityManager found. Ensure code is running within a unit of work.',
      ),
    );
  }

  return em;
});

/**
 * Trait object with all Effect-based UnitOfWork operations
 */
export const EffectUnitOfWorkTrait = {
  begin: beginUnitOfWork,
  commit: commitUnitOfWork,
  rollback: rollbackUnitOfWork,
  withUnitOfWork,
  executeInUnitOfWork,
  isActive: isUnitOfWorkActive,
  getEntityManager: getEntityManagerOrFail,
  createLayer: createUnitOfWorkLayer,
} as const;

// ===== USAGE EXAMPLES =====

/*
// Example 1: Simple transactional operation
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

// Example 2: Manual commit control
const complexOperation = (data: ComplexData) =>
  Effect.gen(function* () {
    // Begin unit of work
    yield* beginUnitOfWork;

    // Step 1: Create user
    const userRepo = yield* UserRepositoryContext;
    const user = yield* User.create(data.user);
    yield* userRepo.save(user);

    // Step 2: Validate something
    const isValid = yield* validateBusinessRule(user);

    if (!isValid) {
      yield* rollbackUnitOfWork;
      return yield* Effect.fail(
        OperationException.new('VALIDATION_FAILED', 'Business rule validation failed')
      );
    }

    // Step 3: Commit at the right moment
    yield* commitUnitOfWork;

    // Step 4: Non-transactional operations
    yield* sendEmail(user.email);

    return user;
  });

// Example 3: Composing multiple operations
const transferFunds = (from: string, to: string, amount: number) =>
  pipe(
    Effect.all([
      debitAccount(from, amount),
      creditAccount(to, amount),
    ]),
    withUnitOfWork({ autoCommit: true })
  );

// Example 4: Using with repository layers
const program = pipe(
  createUser({ name: 'John', email: 'john@example.com' }),
  Effect.provide(UserRepositoryLayer),
  Effect.provide(createUnitOfWorkLayer(unitOfWork)),
  Effect.runPromise
);

// Example 5: Mixing Promise and Effect
const legacyIntegration = pipe(
  Effect.succeed({ userId: '123' }),
  Effect.flatMap((data) =>
    executeInUnitOfWork(async (em) => {
      // Legacy TypeORM code
      const repo = em.getRepository(UserEntity);
      return repo.save(data);
    })
  ),
  Effect.provide(createUnitOfWorkLayer(unitOfWork))
);
*/

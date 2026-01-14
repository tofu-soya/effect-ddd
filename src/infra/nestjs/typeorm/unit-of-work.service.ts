import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { ENTITY_MANAGER_KEY, getNamespaceInstance } from '../cls.middleware';
import { Effect, pipe } from 'effect';
import { BaseException, OperationException } from '@model/exception';
import { P } from 'ts-pattern';

/**
 * Unit of Work context stored in CLS namespace
 */
export interface UnitOfWorkContext {
  queryRunner: QueryRunner;
  entityManager: EntityManager;
  isActive: boolean;
}

/**
 * Unit of Work service for managing transactional boundaries in usecase handlers.
 * Provides methods to commit, rollback, and access the current unit of work context.
 *
 * Pattern: Unit of Work
 * - Maintains a list of objects affected by a business transaction
 * - Coordinates writing out changes and resolving concurrency issues
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get the current unit of work context from CLS
   */
  private getContext(): UnitOfWorkContext | undefined {
    const namespace = getNamespaceInstance();
    return namespace.get('UNIT_OF_WORK_CONTEXT');
  }

  /**
   * Set unit of work context in CLS
   */
  private setContext(context: UnitOfWorkContext | undefined): void {
    const namespace = getNamespaceInstance();
    namespace.set('UNIT_OF_WORK_CONTEXT', context);
  }

  /**
   * Get the current EntityManager from CLS
   */
  getEntityManager(): EntityManager | undefined {
    const namespace = getNamespaceInstance();
    return namespace.get(ENTITY_MANAGER_KEY);
  }

  /**
   * Check if currently in an active unit of work
   */
  isActive(): boolean {
    const context = this.getContext();
    return context?.isActive ?? false;
  }

  /**
   * Begin a new unit of work and inject it into CLS context.
   * Returns the EntityManager for the unit of work.
   */
  begin(): Effect.Effect<EntityManager, OperationException> {
    return Effect.tryPromise({
      catch: (error) => {
        console.log('error on begin transaction', error);
        return OperationException.new(
          'TRANSACTION_BEGIN_FAILED',
          `something end wrong ${error}`,
        );
      },
      try: async () => {
        if (this.isActive()) {
          throw new Error(
            'Unit of work already active. Nested units of work are not supported.',
          );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        const context: UnitOfWorkContext = {
          queryRunner,
          entityManager: queryRunner.manager,
          isActive: true,
        };

        this.setContext(context);

        // Set EntityManager in CLS for repositories to use
        const namespace = getNamespaceInstance();
        namespace.set(ENTITY_MANAGER_KEY, queryRunner.manager);

        return queryRunner.manager;
      },
    });
  }

  /**
   * Commit the current unit of work.
   * Persists all changes to the database.
   */
  commit(): Effect.Effect<void, BaseException> {
    return Effect.tryPromise({
      catch: (error) => {
        console.log('error when commit ', error);
        return OperationException.new(
          'TRANSACTION_COMMIT_FAILED',
          `transaction commit failed: ${error}`,
        );
      },
      try: async () => {
        const context = this.getContext();

        if (!context) {
          throw new Error('No active unit of work to commit');
        }

        if (!context.isActive) {
          throw new Error('Unit of work is not active');
        }

        try {
          await context.queryRunner.commitTransaction();
          context.isActive = false;
        } finally {
          await context.queryRunner.release();
          this.setContext(undefined);

          // Clear EntityManager from CLS
          const namespace = getNamespaceInstance();
          namespace.set(ENTITY_MANAGER_KEY, undefined);
        }
      },
    }).pipe(
      Effect.tapError((error) => {
        if (this.isActive()) {
          return this.rollback();
        }
        return Effect.fail(error) as Effect.Effect<void, BaseException>;
      }),
    );
  }

  /**
   * Rollback the current unit of work.
   * Discards all changes.
   */
  rollback(): Effect.Effect<void, OperationException> {
    return Effect.tryPromise({
      catch: (error) =>
        OperationException.new(
          'TRANSACTION_ROLLBACK_FAILED',
          `something end wrong ${error}`,
        ),
      try: async () => {
        const context = this.getContext();

        if (!context) {
          throw new Error('No active unit of work to rollback');
        }

        if (!context.isActive) {
          throw new Error('Unit of work is not active');
        }

        try {
          await context.queryRunner.rollbackTransaction();
          context.isActive = false;
        } finally {
          await context.queryRunner.release();
          this.setContext(undefined);

          // Clear EntityManager from CLS
          const namespace = getNamespaceInstance();
          namespace.set(ENTITY_MANAGER_KEY, undefined);
        }
      },
    });
  }

  /**
   * Execute a function within a unit of work.
   * Automatically commits on success and rollbacks on error.
   *
   * @param work Function to execute within the unit of work
   * @param options Configuration options
   */
  execute<T>(
    work: (entityManager: EntityManager) => Effect.Effect<T, BaseException>,
    options: { autoCommit?: boolean } = {},
  ): Effect.Effect<T, BaseException> {
    const { autoCommit = true } = options;
    return pipe(
      Effect.Do,
      Effect.bind('entityManager', () => this.begin()),
      Effect.bind('workResult', ({ entityManager }) => work(entityManager)),
      Effect.tap(() => {
        if (autoCommit) {
          return this.commit();
        }
        return Effect.succeed(null) as Effect.Effect<void, BaseException>;
      }),
      Effect.tapError((error) => {
        if (this.isActive()) {
          return this.rollback();
        }
        return Effect.succeed(null) as Effect.Effect<void, BaseException>;
      }),
      Effect.map(({ workResult }) => workResult),
    );
  }
}

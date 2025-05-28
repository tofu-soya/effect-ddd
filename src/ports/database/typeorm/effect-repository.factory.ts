import { Context, Effect, Layer, Option, pipe } from 'effect';
import {
  Repository,
  FindOptionsWhere,
  FindOptionsOrder,
  DataSource,
  EntityManager,
  ObjectLiteral,
} from 'typeorm';
import { AggregateRoot } from '../../../model/effect/aggregate-root.base';
import { Identifier } from '../../../typeclasses/obj-with-id';
import {
  DataWithPaginationMeta,
  FindManyPaginatedParams,
} from '../../repository.base';
import { DomainEventPublisherContext } from '../../../model/effect/domain-event-publisher.interface';
import {
  ENTITY_MANAGER_KEY,
  getNamespaceInstance,
} from '../../../infra/nestjs/cls.middleware';
import { RepositoryPort } from '@model/effect/repository.base';
import { BaseException, OperationException } from '@model/effect';

/**
 * Base query parameters for TypeORM repositories
 */
export interface BaseTypeormQueryParams {
  id?: string;
  [key: string]: any;
}

/**
 * Configuration for TypeORM repository
 */
export interface TypeormRepositoryConfig<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
> {
  // DataSource for database connection
  dataSource: DataSource;

  // Entity class for TypeORM
  entityClass: new () => OrmEntity;

  // Relations to include in queries
  relations: string[];

  // Convert ORM entity to domain model
  toDomain: (ormEntity: OrmEntity) => Effect.Effect<DM, BaseException, never>;

  // Convert domain model to ORM entity
  toOrm: (
    domain: DM,
    existingEntity?: OrmEntity,
  ) => Effect.Effect<OrmEntity, BaseException, never>;

  // Prepare query parameters for TypeORM
  prepareQuery: (params: QueryParams) => FindOptionsWhere<OrmEntity>;
}
export class DataSourceContext extends Context.Tag('DataSource')<
  DataSourceContext,
  DataSource
>() {}
/**
 * Create a TypeORM repository implementation using Effect
 */
export function createTypeormRepository<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(config: TypeormRepositoryConfig<DM, OrmEntity, QueryParams>) {
  const { dataSource, entityClass, relations, toDomain, toOrm, prepareQuery } =
    config;

  const getEntityManager = (): EntityManager => {
    const namespace = getNamespaceInstance();
    let entityManager = namespace?.get(ENTITY_MANAGER_KEY);

    if (!entityManager) {
      // For non-transactional operations
      entityManager = dataSource.manager;
    }
    return entityManager;
  };

  /**
   * Get the repository for the entity
   */
  const getRepository = (): Repository<OrmEntity> => {
    return getEntityManager().getRepository(entityClass);
  };
  return Effect.gen(function* () {
    // Get the repository
    const repo = getRepository();
    const save = (aggregateRoot: DM) => {
      /**
       * Save an existing aggregate root and publish its domain events
       */
      return Effect.gen(function* () {
        // Find existing entity if it exists
        const existingEntity = yield* Effect.tryPromise({
          try: () =>
            repo.findOne({
              where: { id: aggregateRoot.id } as any,
              relations,
            }),
          catch: () =>
            OperationException.new(
              'ENTITY_DO_NOT_EXIST',
              'entity does not existed',
            ),
        });

        // Convert domain model to ORM entity
        const ormEntity = yield* toOrm(
          aggregateRoot,
          existingEntity || undefined,
        );

        // Save the entity
        yield* Effect.tryPromise({
          try: () => repo.save(ormEntity),
          catch: (error) =>
            OperationException.new(
              'FAILED_TO_STAVE_ENTITY',
              `Failed to save entity: ${error}`,
            ),
        });

        // Get the domain events publisher
        const publisher = yield* DomainEventPublisherContext;

        // Publish domain events
        const events = aggregateRoot.domainEvents;
        if (events.length > 0) {
          yield* publisher.publishAll(events);
        }
      });
    };
    const add = (entity: DM) => {
      /**
       * Add a new aggregate root and publish its domain events
       */
      return Effect.gen(function* () {
        // Convert domain model to ORM entity
        const ormEntity = yield* toOrm(entity);

        // Get the domain events publisher
        const publisher = yield* DomainEventPublisherContext;

        // Save the entity
        yield* Effect.tryPromise({
          try: () => repo.save(ormEntity),
          catch: (error) =>
            OperationException.new(
              'FAILED_ADD_ENTITY',
              `Failed to add entity: ${error}`,
            ),
        });

        // Publish domain events
        const events = entity.domainEvents;
        if (events.length > 0) {
          yield* publisher.publishAll(events);
        }
      });
    };
    const saveMultiple = (entities: DM[]) => {
      /**
       * Save multiple aggregate roots and publish their domain events
       */
      return Effect.if(entities.length === 0, {
        onTrue: () => Effect.succeedNone,
        onFalse: () => {
          return Effect.forEach(entities, (aggregate) => save(aggregate));
        },
      });
    };

    const findOne = (params: QueryParams) => {
      return Effect.tryPromise({
        try: () =>
          repo.findOne({
            where: prepareQuery(params),
            relations,
          }),
        catch: (error) =>
          OperationException.new(
            'FAILED_FIND_ENTITY',
            `Failed to find entity: ${error}`,
          ),
      }).pipe(
        Effect.flatMap((entity) => {
          if (!entity) {
            return Effect.succeed(Option.none());
          } else {
            return toDomain(entity).pipe(Effect.map(Option.some));
          }
        }),
      );
    };

    const findOneOrThrow = (params: QueryParams) =>
      pipe(
        params,
        findOne,
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                OperationException.new(
                  'ENTITY_NOT_FOUND',
                  `Entity not found with params: ${JSON.stringify(params)}`,
                ),
              ),
            onSome: (agg) => Effect.succeed(agg),
          }),
        ),
      );

    const findOneByIdOrThrow = (id: Identifier) =>
      pipe({ id } as unknown as QueryParams, findOneOrThrow);

    const findMany = (
      params: QueryParams,
    ): Effect.Effect<DM[], BaseException, never> => {
      return Effect.gen(function* () {
        // Get the repository
        const repo = getRepository();

        // Find entities
        const entities = yield* Effect.tryPromise({
          try: () =>
            repo.find({
              where: prepareQuery(params),
              relations,
            }),
          catch: (error) =>
            OperationException.new(
              'FIND_MANY_FAILED',
              `Failed to find entities: ${error}`,
            ),
        });

        // Convert to domain models
        return yield* Effect.forEach(entities, (entity) => toDomain(entity), {
          concurrency: 'unbounded',
        });
      });
    };

    const findManyPaginated = (
      options: FindManyPaginatedParams<QueryParams>,
    ): Effect.Effect<DataWithPaginationMeta<DM[]>, BaseException, never> => {
      return Effect.gen(function* () {
        // Get the repository
        const repo = getRepository();

        const params = options.params || ({} as QueryParams);
        const pagination = options.pagination || { skip: 0, limit: 10 };
        const skip =
          pagination.skip ??
          (pagination.page
            ? (pagination.page - 1) * (pagination.limit ?? 10)
            : 0);
        const take = pagination.limit ?? 10;

        // Count total entities
        const total = yield* Effect.tryPromise({
          try: () =>
            repo.count({
              where: prepareQuery(params),
            }),
          catch: (error) =>
            OperationException.new(
              'COUNT_FAILED',
              `Failed to count entities: ${error}`,
            ),
        });

        // Find paginated entities
        const entities = yield* Effect.tryPromise({
          try: () =>
            repo.find({
              where: prepareQuery(params),
              skip,
              take,
              order: options.orderBy as FindOptionsOrder<OrmEntity>,
              relations,
            }),
          catch: (error) =>
            OperationException.new(
              'FIND_PAGINATED_FAILED',
              `Failed to find paginated entities: ${error}`,
            ),
        });

        // Convert to domain models
        const domainEntities = yield* Effect.forEach(
          entities,
          (entity) => toDomain(entity),
          {
            concurrency: 'unbounded',
          },
        );

        // Return with pagination metadata
        return {
          data: domainEntities,
          count: total,
          limit: take,
          page: pagination.page ?? Math.floor(skip / take) + 1,
        };
      });
    };

    const del = (entity: DM): Effect.Effect<void, BaseException, never> => {
      return Effect.tryPromise({
        try: async () => {
          await getRepository().delete(entity.id);
        },
        catch: (error) =>
          OperationException.new(
            'DELETE_FAILED',
            `Failed to delete entity: ${error}`,
          ) as BaseException,
      });
    };
    const repository: RepositoryPort<DM> = {
      save,
      add,
      saveMultiple,
      findOne,
      /**
       * Find one aggregate root by query parameters
       */
      findOneOrThrow,
      /**
       * Find one aggregate root by ID
       */
      findOneByIdOrThrow,

      /**
       * Find many aggregate roots by query parameters
       */
      findMany,

      /**
       * Find many aggregate roots with pagination
       */
      findManyPaginated,

      /**
       * Delete an aggregate root
       */
      delete: del,

      /**
       * Set correlation ID for tracking
       */
      setCorrelationId: (correlationId: string): typeof repository => {
        // Store correlation ID for tracking
        // This is a placeholder - implement as needed
        return repository;
      },
    };
    return repository;
  });
}

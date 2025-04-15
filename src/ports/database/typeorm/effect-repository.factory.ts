import { Context, Effect, Layer } from 'effect';
import { Repository, FindOptionsWhere, FindOptionsOrder, DataSource, EntityManager, ObjectLiteral } from 'typeorm';
import { BaseException } from '../../../logic/exception.base';
import { AggregateRoot } from '../../../model/effect/aggregate-root.base';
import { Identifier } from '../../../typeclasses/obj-with-id';
import { DataWithPaginationMeta, FindManyPaginatedParams, OrderBy, PaginationMeta } from '../../repository.base';
import { DomainEventPublisherContext, IDomainEventPublisher } from '../../../model/effect/domain-event-publisher.interface';
import { RepositoryContext } from '../../repository.base';
import { ENTITY_MANAGER_KEY, getNamespaceInstance } from '../../../infra/nestjs/cls.middleware';

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
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams
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
  toOrm: (domain: DM, existingEntity?: OrmEntity) => Effect.Effect<OrmEntity, BaseException, never>;
  
  // Prepare query parameters for TypeORM
  prepareQuery: (params: QueryParams) => FindOptionsWhere<OrmEntity>;
}

/**
 * Create a TypeORM repository implementation using Effect
 */
export function createTypeormRepository<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams
>(
  config: TypeormRepositoryConfig<DM, OrmEntity, QueryParams>
) {
  const {
    dataSource,
    entityClass,
    relations,
    toDomain,
    toOrm,
    prepareQuery
  } = config;
  
  /**
   * Get the entity manager from the current transaction context or create a new one
   */
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

  /**
   * Implementation of the repository
   */
  const repository = {
    /**
     * Save an existing aggregate root and publish its domain events
     */
    save: (aggregateRoot: DM): Effect.Effect<void, BaseException, IDomainEventPublisher> => {
      return Effect.gen(function*($) {
        // Get the repository
        const repo = getRepository();
        
        // Find existing entity if it exists
        const existingEntity = yield* $(Effect.tryPromise({
          try: () => repo.findOne({
            where: { id: aggregateRoot.id } as any,
            relations
          }),
          catch: (error) => new Error(`Failed to find entity: ${error}`) as BaseException
        }));
        
        // Convert domain model to ORM entity
        const ormEntity = yield* $(toOrm(aggregateRoot, existingEntity || undefined));
        
        // Save the entity
        yield* $(Effect.tryPromise({
          try: () => repo.save(ormEntity),
          catch: (error) => new Error(`Failed to save entity: ${error}`) as BaseException
        }));
        
        // Get the domain events publisher
        const publisher = yield* $(Effect.service(DomainEventPublisherContext));
        
        // Publish domain events
        const events = aggregateRoot.domainEvents;
        if (events.length > 0) {
          yield* $(publisher.publishAll(events));
        }
      });
    },
    
    /**
     * Add a new aggregate root and publish its domain events
     */
    add: (entity: DM): Effect.Effect<void, BaseException, IDomainEventPublisher> => {
      return Effect.gen(function*($) {
        // Get the repository
        const repo = getRepository();
        
        // Convert domain model to ORM entity
        const ormEntity = yield* $(toOrm(entity));
        
        // Save the entity
        yield* $(Effect.tryPromise({
          try: () => repo.save(ormEntity),
          catch: (error) => new Error(`Failed to add entity: ${error}`) as BaseException
        }));
        
        // Get the domain events publisher
        const publisher = yield* $(Effect.service(DomainEventPublisherContext));
        
        // Publish domain events
        const events = entity.domainEvents;
        if (events.length > 0) {
          yield* $(publisher.publishAll(events));
        }
      });
    },
    
    /**
     * Save multiple aggregate roots and publish their domain events
     */
    saveMultiple: (entities: DM[]): Effect.Effect<void, BaseException, IDomainEventPublisher> => {
      return Effect.gen(function*($) {
        if (entities.length === 0) {
          return;
        }
        
        // Get the repository
        const repo = getRepository();
        
        // Convert all domain models to ORM entities
        const ormEntities = yield* $(Effect.forEach(
          entities,
          (entity) => toOrm(entity),
          { concurrency: 'unbounded' }
        ));
        
        // Save all entities
        yield* $(Effect.tryPromise({
          try: () => repo.save(ormEntities),
          catch: (error) => new Error(`Failed to save entities: ${error}`) as BaseException
        }));
        
        // Get the domain events publisher
        const publisher = yield* $(Effect.service(DomainEventPublisherContext));
        
        // Collect all domain events
        const allEvents = entities.flatMap(entity => entity.domainEvents);
        
        // Publish all events
        if (allEvents.length > 0) {
          yield* $(publisher.publishAll(allEvents));
        }
      });
    },
    
    /**
     * Find one aggregate root by query parameters
     */
    findOneOrThrow: (params: QueryParams): Effect.Effect<DM, BaseException, never> => {
      return Effect.gen(function*($) {
        // Get the repository
        const repo = getRepository();
        
        // Find the entity
        const entity = yield* $(Effect.tryPromise({
          try: () => repo.findOne({
            where: prepareQuery(params),
            relations
          }),
          catch: (error) => new Error(`Failed to find entity: ${error}`) as BaseException
        }));
        
        // Throw if not found
        if (!entity) {
          throw new Error(`Entity not found with params: ${JSON.stringify(params)}`) as BaseException;
        }
        
        // Convert to domain model
        return yield* $(toDomain(entity));
      });
    },
    
    /**
     * Find one aggregate root by ID
     */
    findOneByIdOrThrow: (id: Identifier): Effect.Effect<DM, BaseException, never> => {
      return Effect.gen(function*($) {
        // Get the repository
        const repo = getRepository();
        
        // Find the entity
        const entity = yield* $(Effect.tryPromise({
          try: () => repo.findOne({
            where: { id } as any,
            relations
          }),
          catch: (error) => new Error(`Failed to find entity by id: ${error}`) as BaseException
        }));
        
        // Throw if not found
        if (!entity) {
          throw new Error(`Entity with id ${id} not found`) as BaseException;
        }
        
        // Convert to domain model
        return yield* $(toDomain(entity));
      });
    },
    
    /**
     * Find many aggregate roots by query parameters
     */
    findMany: (params: QueryParams): Effect.Effect<DM[], BaseException, never> => {
      return Effect.gen(function*($) {
        // Get the repository
        const repo = getRepository();
        
        // Find entities
        const entities = yield* $(Effect.tryPromise({
          try: () => repo.find({
            where: prepareQuery(params),
            relations
          }),
          catch: (error) => new Error(`Failed to find entities: ${error}`) as BaseException
        }));
        
        // Convert to domain models
        return yield* $(Effect.forEach(
          entities,
          (entity) => toDomain(entity),
          { concurrency: 'unbounded' }
        ));
      });
    },
    
    /**
     * Find many aggregate roots with pagination
     */
    findManyPaginated: (
      options: FindManyPaginatedParams<QueryParams>,
    ): Effect.Effect<DataWithPaginationMeta<DM[]>, BaseException, never> => {
      return Effect.gen(function*($) {
        // Get the repository
        const repo = getRepository();
        
        const params = options.params || {} as QueryParams;
        const pagination = options.pagination || { skip: 0, limit: 10 };
        const skip = pagination.skip ?? (pagination.page ? (pagination.page - 1) * (pagination.limit ?? 10) : 0);
        const take = pagination.limit ?? 10;
        
        // Count total entities
        const total = yield* $(Effect.tryPromise({
          try: () => repo.count({
            where: prepareQuery(params)
          }),
          catch: (error) => new Error(`Failed to count entities: ${error}`) as BaseException
        }));
        
        // Find paginated entities
        const entities = yield* $(Effect.tryPromise({
          try: () => repo.find({
            where: prepareQuery(params),
            skip,
            take,
            order: options.orderBy as FindOptionsOrder<OrmEntity>,
            relations
          }),
          catch: (error) => new Error(`Failed to find paginated entities: ${error}`) as BaseException
        }));
        
        // Convert to domain models
        const domainEntities = yield* $(Effect.forEach(
          entities,
          (entity) => toDomain(entity),
          { concurrency: 'unbounded' }
        ));
        
        // Return with pagination metadata
        return {
          data: domainEntities,
          count: total,
          limit: take,
          page: pagination.page ?? Math.floor(skip / take) + 1
        };
      });
    },
    
    /**
     * Delete an aggregate root
     */
    delete: (entity: DM): Effect.Effect<void, BaseException, never> => {
      return Effect.tryPromise({
        try: async () => {
          await getRepository().delete(entity.id);
        },
        catch: (error) => new Error(`Failed to delete entity: ${error}`) as BaseException
      });
    },
    
    /**
     * Set correlation ID for tracking
     */
    setCorrelationId: (correlationId: string): typeof repository => {
      // Store correlation ID for tracking
      // This is a placeholder - implement as needed
      return repository;
    }
  };
  
  return repository;
}

/**
 * Create a Layer for a TypeORM repository
 */
export function createTypeormRepositoryLayer<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams
>(
  config: TypeormRepositoryConfig<DM, OrmEntity, QueryParams>
): Layer.Layer<RepositoryContext<DM, QueryParams>, never, DomainEventPublisherContext> {
  return Layer.effect(
    RepositoryContext<DM, QueryParams>(),
    Effect.succeed(createTypeormRepository(config))
  );
}

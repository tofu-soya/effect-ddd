import { Effect, Option, pipe } from 'effect';
import {
  Repository,
  FindOptionsWhere,
  FindOptionsOrder,
  DataSource,
  EntityManager,
  ObjectLiteral,
} from 'typeorm';
import { Identifier } from '../../../typeclasses/obj-with-id';
import {
  ENTITY_MANAGER_KEY,
  getNamespaceInstance,
} from '../../../infra/nestjs/cls.middleware';
import { BaseException, OperationException } from '@model/exception';
import {
  AggregateRoot,
  DataWithPaginationMeta,
  FindManyPaginatedParams,
  IDomainEventPublisher,
  RepositoryPort,
} from '@model/interfaces';

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
  // DataSource for database connection (injected by NestJS DI)
  dataSource: DataSource;

  // Domain event publisher (injected by NestJS DI)
  publisher: IDomainEventPublisher;

  // Entity class for TypeORM
  entityClass: new () => OrmEntity;

  // Relations to include in queries
  relations: string[];

  // Convert ORM entity to domain model
  toDomain: (ormEntity: OrmEntity) => Effect.Effect<DM, BaseException, never>;

  // Convert domain model to ORM entity
  toOrm: (
    domain: DM,
    existingEntity: Option.Option<OrmEntity>,
    repository: Repository<OrmEntity>,
  ) => Effect.Effect<OrmEntity, BaseException, never>;

  // Prepare query parameters for TypeORM
  prepareQuery: (params: QueryParams) => FindOptionsWhere<OrmEntity>;
}
/**
 * Create a TypeORM repository implementation.
 *
 * All dependencies (DataSource, DomainEventPublisher) are passed directly via config,
 * so the returned repository methods return Effect<A, E> with NO Context requirements.
 *
 * Usage in NestJS Module:
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: 'UserRepository',
 *       useFactory: (dataSource: DataSource, publisher: IDomainEventPublisher) =>
 *         createTypeormRepository({
 *           dataSource,
 *           publisher,
 *           entityClass: UserEntity,
 *           relations: ['profile'],
 *           toDomain: (entity) => UserTrait.parse(entity),
 *           toOrm: (domain, existing, repo) => Effect.succeed({ ...domain }),
 *           prepareQuery: (params) => ({ id: params.id }),
 *         }),
 *       inject: [DataSource, 'DomainEventPublisher'],
 *     },
 *   ],
 * })
 * ```
 *
 * Usage in Service:
 * ```typescript
 * @Injectable()
 * class UserService {
 *   constructor(@Inject('UserRepository') private repo: RepositoryPort<User>) {}
 *
 *   async getUser(id: string) {
 *     // No need to provide any Layer - just run it!
 *     return Effect.runPromise(this.repo.findOneByIdOrThrow(id));
 *   }
 * }
 * ```
 */
export function createTypeormRepository<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(config: TypeormRepositoryConfig<DM, OrmEntity, QueryParams>): RepositoryPort<DM> {
  const { dataSource, publisher, entityClass, relations, toDomain, toOrm, prepareQuery } =
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

  const getRepository = (): Repository<OrmEntity> => {
    return getEntityManager().getRepository(entityClass);
  };

  const save = (aggregateRoot: DM): Effect.Effect<void, BaseException> => {
    return pipe(
      Effect.tryPromise({
        try: () =>
          getRepository().findOne({
            where: { id: aggregateRoot.id } as any,
            relations,
          }),
        catch: (error) =>
          OperationException.new('ENTITY_DO_NOT_EXIST', `${error}`),
      }),
      Effect.flatMap((existingEntity) =>
        toOrm(aggregateRoot, Option.fromNullable(existingEntity), getRepository()),
      ),
      Effect.flatMap((ormEntity) =>
        Effect.tryPromise({
          try: () => getRepository().save(ormEntity),
          catch: (error) =>
            OperationException.new(
              'FAILED_TO_SAVE_ENTITY',
              `Failed to save entity: ${error}`,
            ),
        }),
      ),
      Effect.flatMap(() => {
        const events = aggregateRoot.domainEvents;
        if (events.length > 0) {
          return publisher.publishAll(events);
        }
        return Effect.succeed(undefined as void);
      }),
    );
  };

  const add = (entity: DM): Effect.Effect<void, BaseException> => {
    return pipe(
      toOrm(entity, Option.none(), getRepository()),
      Effect.flatMap((ormEntity) =>
        Effect.tryPromise({
          try: () => getRepository().save(ormEntity),
          catch: (error) =>
            OperationException.new(
              'FAILED_ADD_ENTITY',
              `Failed to add entity: ${error}`,
            ),
        }),
      ),
      Effect.flatMap(() => {
        const events = entity.domainEvents;
        if (events.length > 0) {
          return publisher.publishAll(events);
        }
        return Effect.succeed(undefined as void);
      }),
    );
  };

  const saveMultiple = (entities: DM[]): Effect.Effect<void, BaseException> => {
    if (entities.length === 0) {
      return Effect.succeed(undefined as void);
    }
    return pipe(
      Effect.forEach(entities, (aggregate) => save(aggregate)),
      Effect.map(() => undefined as void),
    );
  };

  const findOne = (
    params: QueryParams,
  ): Effect.Effect<Option.Option<DM>, BaseException> => {
    return pipe(
      Effect.tryPromise({
        try: () =>
          getRepository().findOne({
            where: prepareQuery(params),
            relations,
          }),
        catch: (error) =>
          OperationException.new(
            'FAILED_FIND_ENTITY',
            `Failed to find entity: ${error}`,
          ),
      }),
      Effect.flatMap((entity) => {
        if (!entity) {
          return Effect.succeed(Option.none());
        }
        return pipe(toDomain(entity), Effect.map(Option.some));
      }),
    );
  };

  const findOneOrThrow = (params: QueryParams): Effect.Effect<DM, BaseException> => {
    return pipe(
      findOne(params),
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
  };

  const findOneByIdOrThrow = (id: Identifier): Effect.Effect<DM, BaseException> => {
    return findOneOrThrow({ id } as unknown as QueryParams);
  };

  const findMany = (params: QueryParams): Effect.Effect<DM[], BaseException> => {
    return pipe(
      Effect.tryPromise({
        try: () =>
          getRepository().find({
            where: prepareQuery(params),
            relations,
          }),
        catch: (error) =>
          OperationException.new(
            'FIND_MANY_FAILED',
            `Failed to find entities: ${error}`,
          ),
      }),
      Effect.flatMap((entities) =>
        Effect.forEach(entities, (entity) => toDomain(entity), {
          concurrency: 'unbounded',
        }),
      ),
    );
  };

  const findManyPaginated = (
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<DM[]>, BaseException> => {
    const params = options.params || ({} as QueryParams);
    const pagination = options.pagination || { skip: 0, limit: 10 };
    const skip =
      pagination.skip ??
      (pagination.page
        ? (pagination.page - 1) * (pagination.limit ?? 10)
        : 0);
    const take = pagination.limit ?? 10;

    return pipe(
      Effect.all({
        total: Effect.tryPromise({
          try: () =>
            getRepository().count({
              where: prepareQuery(params),
            }),
          catch: (error) =>
            OperationException.new(
              'COUNT_FAILED',
              `Failed to count entities: ${error}`,
            ),
        }),
        entities: Effect.tryPromise({
          try: () =>
            getRepository().find({
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
        }),
      }),
      Effect.flatMap(({ total, entities }) =>
        pipe(
          Effect.forEach(entities, (entity) => toDomain(entity), {
            concurrency: 'unbounded',
          }),
          Effect.map((domainEntities) => ({
            data: domainEntities,
            count: total,
            limit: take,
            page: pagination.page ?? Math.floor(skip / take) + 1,
          })),
        ),
      ),
    );
  };

  const del = (entity: DM): Effect.Effect<void, BaseException> => {
    return Effect.tryPromise({
      try: async () => {
        await getRepository().delete(entity.id);
      },
      catch: (error) =>
        OperationException.new(
          'DELETE_FAILED',
          `Failed to delete entity: ${error}`,
        ),
    });
  };

  const repository: RepositoryPort<DM> = {
    save,
    add,
    saveMultiple,
    findOne,
    findOneOrThrow,
    findOneByIdOrThrow,
    findMany,
    findManyPaginated,
    delete: del,
    setCorrelationId: (correlationId: string): typeof repository => {
      // Store correlation ID for tracking (placeholder)
      return repository;
    },
  };

  return repository;
}

/**
 * Configuration for creating a NestJS repository provider (without dataSource and publisher)
 */
export type TypeormRepositoryProviderConfig<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
> = Omit<TypeormRepositoryConfig<DM, OrmEntity, QueryParams>, 'dataSource' | 'publisher'>;

/**
 * NestJS Provider type for TypeORM repository
 */
export interface TypeormRepositoryProvider<DM extends AggregateRoot> {
  provide: string | symbol;
  useFactory: (
    dataSource: DataSource,
    publisher: IDomainEventPublisher,
  ) => RepositoryPort<DM>;
  inject: [typeof DataSource, string | symbol];
}

/**
 * Create a NestJS provider for TypeORM Effect repository.
 *
 * This helper reduces boilerplate when registering repositories in NestJS modules.
 * DataSource and DomainEventPublisher are automatically injected via NestJS DI.
 *
 * Usage:
 * ```typescript
 * @Module({
 *   providers: [
 *     createTypeormRepositoryProvider({
 *       token: 'UserRepository',
 *       publisherToken: 'DomainEventPublisher',
 *       entityClass: UserEntity,
 *       relations: ['profile', 'roles'],
 *       toDomain: (entity) => UserTrait.parse(entity),
 *       toOrm: (domain, existing, repo) => Effect.succeed({ ...domain }),
 *       prepareQuery: (params) => ({ id: params.id }),
 *     }),
 *   ],
 * })
 * export class UserModule {}
 * ```
 */
export function createTypeormRepositoryProvider<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(options: {
  token: string | symbol;
  publisherToken: string | symbol;
} & TypeormRepositoryProviderConfig<DM, OrmEntity, QueryParams>): TypeormRepositoryProvider<DM> {
  const { token, publisherToken, ...config } = options;

  return {
    provide: token,
    useFactory: (dataSource: DataSource, publisher: IDomainEventPublisher) =>
      createTypeormRepository({
        ...config,
        dataSource,
        publisher,
      }),
    inject: [DataSource, publisherToken],
  };
}

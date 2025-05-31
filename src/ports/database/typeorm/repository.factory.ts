// src/model/effect/factories/repository.factory.ts

import { Effect, Context, Layer, pipe } from 'effect';
import { ObjectLiteral, FindOptionsWhere } from 'typeorm';
import { AggregateRoot, RepositoryPort } from '@model/interfaces';
import {
  BaseTypeormQueryParams,
  createTypeormRepository,
  DataSourceContext,
} from '../../../ports/database/typeorm/effect-repository.factory';
import { BaseException, OperationException } from '@model/exception';

// ===== TYPES =====

export interface RepositoryConfig<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
> {
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

export interface PartialRepositoryConfig<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
> {
  readonly entityClass: new () => OrmEntity;
  readonly relations?: readonly string[];
  readonly mappers?: {
    readonly toDomain?: (
      ormEntity: OrmEntity,
    ) => Effect.Effect<DM, BaseException, never>;
    readonly toOrm?: (
      domain: DM,
      existing?: OrmEntity,
    ) => Effect.Effect<OrmEntity, BaseException, never>;
    readonly prepareQuery?: (
      params: QueryParams,
    ) => FindOptionsWhere<OrmEntity>;
  };
}

export interface ConventionConfig<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
> {
  readonly entityClass: new () => OrmEntity;
  readonly domainTrait: {
    parse: (raw: any) => Effect.Effect<DM, BaseException, never>;
  };
  readonly relations?: readonly string[];
  readonly customMappings?: Partial<
    RepositoryConfig<DM, OrmEntity, QueryParams>['mappers']
  >;
}

// ===== AUTO-MAPPING UTILITIES =====

/**
 * Auto-generate toDomain mapper using property mapping
 */
const createAutoToDomainMapper =
  <DM extends AggregateRoot, OrmEntity extends ObjectLiteral>(): ((
    ormEntity: OrmEntity,
  ) => Effect.Effect<DM, BaseException, never>) =>
  (ormEntity: OrmEntity): Effect.Effect<DM, BaseException, never> =>
    Effect.try({
      try: (): DM => convertOrmToDomainProps(ormEntity) as DM,
      catch: (error): BaseException =>
        OperationException.new(
          'DOMAIN_MAPPING_FAILED',
          `Failed to map ORM entity to domain: ${error}`,
        ),
    });

/**
 * Auto-generate toOrm mapper using property mapping
 */
const createAutoToOrmMapper =
  <DM extends AggregateRoot, OrmEntity extends ObjectLiteral>(): ((
    domain: DM,
    existing?: OrmEntity,
  ) => Effect.Effect<OrmEntity, BaseException, never>) =>
  (
    domain: DM,
    existing?: OrmEntity,
  ): Effect.Effect<OrmEntity, BaseException, never> =>
    Effect.try({
      try: (): OrmEntity =>
        convertDomainToOrmProps(domain, existing) as OrmEntity,
      catch: (error): BaseException =>
        OperationException.new(
          'ORM_MAPPING_FAILED',
          `Failed to map domain to ORM entity: ${error}`,
        ),
    });

/**
 * Auto-generate prepareQuery function
 */
const createAutoPrepareQuery =
  <OrmEntity extends ObjectLiteral, QueryParams>(): ((
    params: QueryParams,
  ) => FindOptionsWhere<OrmEntity>) =>
  (params: QueryParams): FindOptionsWhere<OrmEntity> =>
    params as FindOptionsWhere<OrmEntity>;

/**
 * Convert ORM entity properties to domain properties
 */
const convertOrmToDomainProps = (ormEntity: any): any => {
  const result: any = {};

  for (const [key, value] of Object.entries(ormEntity)) {
    if (value !== null && value !== undefined) {
      if (key === 'createdAt' || key === 'updatedAt') {
        result[key] = new Date(value as string);
      } else if (typeof value === 'object' && value.constructor === Object) {
        result[key] = convertOrmToDomainProps(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
};

/**
 * Convert domain properties to ORM entity properties
 */
const convertDomainToOrmProps = (domain: any, existing?: any): any => {
  const result = existing ? { ...existing } : {};
  const props = domain.props || domain;

  for (const [key, value] of Object.entries(props)) {
    if (value !== null && value !== undefined) {
      if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (typeof value === 'object' && value.constructor === Object) {
        result[key] = convertDomainToOrmProps(value);
      } else {
        result[key] = value;
      }
    }
  }

  if (domain.id) result.id = domain.id;
  if (domain.createdAt) result.createdAt = domain.createdAt;
  if (domain.updatedAt) result.updatedAt = domain.updatedAt;

  return result;
};

// ===== CONFIG BUILDERS =====

/**
 * Complete a partial repository configuration with defaults
 */
const completeRepositoryConfig = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
>(
  partial: PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
): RepositoryConfig<DM, OrmEntity, QueryParams> => ({
  entityClass: partial.entityClass,
  relations: partial.relations || [],
  mappers: {
    toDomain:
      partial.mappers?.toDomain || createAutoToDomainMapper<DM, OrmEntity>(),
    toOrm: partial.mappers?.toOrm || createAutoToOrmMapper<DM, OrmEntity>(),
    prepareQuery:
      partial.mappers?.prepareQuery ||
      createAutoPrepareQuery<OrmEntity, QueryParams>(),
  },
});

/**
 * Create configuration from convention-based setup
 */
const createConventionConfig = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
>(
  config: ConventionConfig<DM, OrmEntity, QueryParams>,
): RepositoryConfig<DM, OrmEntity, QueryParams> => ({
  entityClass: config.entityClass,
  relations: config.relations || [],
  mappers: {
    toDomain: (ormEntity: OrmEntity): Effect.Effect<DM, BaseException, never> =>
      config.domainTrait.parse(ormEntity),
    toOrm: createAutoToOrmMapper<DM, OrmEntity>(),
    prepareQuery: createAutoPrepareQuery<OrmEntity, QueryParams>(),
    ...config.customMappings,
  },
});

// ===== REPOSITORY FACTORIES =====

/**
 * Create a repository with complete configuration
 */
export const createRepository = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  config: RepositoryConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSourceContext> =>
  Effect.gen(function* () {
    const dataSource = yield* DataSourceContext;

    return yield* createTypeormRepository({
      dataSource,
      entityClass: config.entityClass,
      relations: [...config.relations],
      toDomain: config.mappers.toDomain,
      toOrm: config.mappers.toOrm,
      prepareQuery: config.mappers.prepareQuery,
    });
  });

/**
 * Create a repository with partial configuration (auto-complete with defaults)
 */
export const createRepositoryWithDefaults = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  partialConfig: PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSourceContext> =>
  pipe(partialConfig, completeRepositoryConfig, createRepository);

/**
 * Create repository with convention-based mapping
 */
export const createRepositoryWithConventions = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  config: ConventionConfig<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSourceContext> =>
  pipe(config, createConventionConfig, createRepository);

// ===== LAYER FACTORIES =====

/**
 * Create repository context layer
 */
export const createRepositoryLayer = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
  config: RepositoryConfig<DM, OrmEntity, QueryParams>,
): Layer.Layer<
  Context.Tag.Identifier<typeof repositoryTag>,
  BaseException,
  DataSourceContext
> => Layer.effect(repositoryTag, createRepository(config));

/**
 * Create repository layer with partial configuration
 */
export const createRepositoryLayerWithDefaults = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
  partialConfig: PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
): Layer.Layer<
  Context.Tag.Identifier<typeof repositoryTag>,
  BaseException,
  DataSourceContext
> =>
  pipe(partialConfig, completeRepositoryConfig, (config) =>
    createRepositoryLayer(repositoryTag, config),
  );

/**
 * Create repository layer with conventions
 */
export const createRepositoryLayerWithConventions = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
  config: ConventionConfig<DM, OrmEntity, QueryParams>,
): Layer.Layer<
  Context.Tag.Identifier<typeof repositoryTag>,
  BaseException,
  DataSourceContext
> =>
  pipe(config, createConventionConfig, (completeConfig) =>
    createRepositoryLayer(repositoryTag, completeConfig),
  );

// ===== FUNCTIONAL BUILDER =====

/**
 * Functional builder configuration state
 */
export interface BuilderState<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
> {
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

/**
 * Initialize builder state
 */
export const initBuilder = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
>(
  entityClass: new () => OrmEntity,
): BuilderState<DM, OrmEntity, QueryParams> => ({
  entityClass,
  relations: [],
});

/**
 * Add relations to builder state
 */
export const withRelations =
  <
    DM extends AggregateRoot,
    OrmEntity extends ObjectLiteral,
    QueryParams = any,
  >(
    relations: readonly string[],
  ) =>
  (
    state: BuilderState<DM, OrmEntity, QueryParams>,
  ): BuilderState<DM, OrmEntity, QueryParams> => ({
    ...state,
    relations,
  });

/**
 * Add domain mapper to builder state
 */
export const withDomainMapper =
  <
    DM extends AggregateRoot,
    OrmEntity extends ObjectLiteral,
    QueryParams = any,
  >(
    mapper: (ormEntity: OrmEntity) => Effect.Effect<DM, BaseException, never>,
  ) =>
  (
    state: BuilderState<DM, OrmEntity, QueryParams>,
  ): BuilderState<DM, OrmEntity, QueryParams> => ({
    ...state,
    toDomain: mapper,
  });

/**
 * Add ORM mapper to builder state
 */
export const withOrmMapper =
  <
    DM extends AggregateRoot,
    OrmEntity extends ObjectLiteral,
    QueryParams = any,
  >(
    mapper: (
      domain: DM,
      existing?: OrmEntity,
    ) => Effect.Effect<OrmEntity, BaseException, never>,
  ) =>
  (
    state: BuilderState<DM, OrmEntity, QueryParams>,
  ): BuilderState<DM, OrmEntity, QueryParams> => ({
    ...state,
    toOrm: mapper,
  });

/**
 * Add query mapper to builder state
 */
export const withQueryMapper =
  <
    DM extends AggregateRoot,
    OrmEntity extends ObjectLiteral,
    QueryParams = any,
  >(
    mapper: (params: QueryParams) => FindOptionsWhere<OrmEntity>,
  ) =>
  (
    state: BuilderState<DM, OrmEntity, QueryParams>,
  ): BuilderState<DM, OrmEntity, QueryParams> => ({
    ...state,
    prepareQuery: mapper,
  });

/**
 * Build repository from builder state
 */
export const build = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
>(
  state: BuilderState<DM, OrmEntity, QueryParams>,
): Effect.Effect<RepositoryPort<DM>, BaseException, DataSourceContext> =>
  pipe(
    {
      entityClass: state.entityClass,
      relations: state.relations,
      mappers: {
        toDomain: state.toDomain,
        toOrm: state.toOrm,
        prepareQuery: state.prepareQuery,
      },
    } as PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
    createRepositoryWithDefaults,
  );

/**
 * Build repository layer from builder state
 */
export const buildLayer =
  <
    DM extends AggregateRoot,
    OrmEntity extends ObjectLiteral,
    QueryParams extends BaseTypeormQueryParams = BaseTypeormQueryParams,
  >(
    repositoryTag: Context.Tag<any, RepositoryPort<DM>>,
  ) =>
  (
    state: BuilderState<DM, OrmEntity, QueryParams>,
  ): Layer.Layer<
    Context.Tag.Identifier<typeof repositoryTag>,
    BaseException,
    DataSourceContext
  > =>
    pipe(
      {
        entityClass: state.entityClass,
        relations: state.relations,
        mappers: {
          toDomain: state.toDomain,
          toOrm: state.toOrm,
          prepareQuery: state.prepareQuery,
        },
      } as PartialRepositoryConfig<DM, OrmEntity, QueryParams>,
      (config) => createRepositoryLayerWithDefaults(repositoryTag, config),
    );

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Create a repository builder pipeline
 */
export const repositoryBuilder = <
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams = any,
>(
  entityClass: new () => OrmEntity,
): BuilderState<DM, OrmEntity, QueryParams> =>
  initBuilder<DM, OrmEntity, QueryParams>(entityClass);

/**
 * Trait for repository factory functions
 */
export const RepositoryFactoryTrait = {
  create: createRepository,
  createWithDefaults: createRepositoryWithDefaults,
  createWithConventions: createRepositoryWithConventions,
  createLayer: createRepositoryLayer,
  createLayerWithDefaults: createRepositoryLayerWithDefaults,
  createLayerWithConventions: createRepositoryLayerWithConventions,
  builder: repositoryBuilder,
} as const;

// ===== USAGE EXAMPLES =====

/*
// 1. Simple usage with auto-mapping
const userRepository = createRepositoryWithConventions({
  entityClass: UserEntity,
  domainTrait: UserTrait,
  relations: ['profile', 'orders'],
});

// 2. Functional builder usage with pipe
const productRepository = pipe(
  repositoryBuilder<Product, ProductEntity, { categoryId?: string }>(ProductEntity),
  withRelations(['category', 'reviews']),
  withDomainMapper((entity) => ProductTrait.parse(entity)),
  withQueryMapper((params) => ({
    category: { id: params.categoryId },
  })),
  build
);

// 3. Layer creation with functional composition
const ProductRepositoryLayer = pipe(
  repositoryBuilder<Product, ProductEntity>(ProductEntity),
  withRelations(['category']),
  withDomainMapper((entity) => ProductTrait.parse(entity)),
  buildLayer(ProductRepositoryTag)
);

// 4. Using the trait interface
const orderRepository = RepositoryFactoryTrait.createWithConventions({
  entityClass: OrderEntity,
  domainTrait: OrderTrait,
  relations: ['items', 'customer'],
});

// 5. Complex configuration with partial config
const customerRepository = RepositoryFactoryTrait.createWithDefaults({
  entityClass: CustomerEntity,
  relations: ['orders', 'profile'],
  mappers: {
    toDomain: (entity) => CustomerTrait.parse(entity),
    prepareQuery: (params: { email?: string; status?: string }) => ({
      email: params.email,
      status: params.status,
    }),
  },
});
*/

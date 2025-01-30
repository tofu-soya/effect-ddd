import {
  Repository,
  FindOptionsWhere,
  FindOptionsOrder,
  DataSource,
  EntityManager,
  ObjectLiteral,
} from 'typeorm';
import {
  FindManyPaginatedParams,
  RepositoryPort,
  DataWithPaginationMeta,
} from '@ports/repository.base';
import { Arr, pipe, TE, Option } from '@logic/fp';
import { BaseException, BaseExceptionTrait } from '@logic/exception.base';
import { AggregateRoot } from '@model/aggregate-root.base';
import { Identifier } from 'src/typeclasses/obj-with-id';
import { BaseAggregateQueryParams } from './base-repository-with-mapper';
import {
  ENTITY_MANAGER_KEY,
  getNamespaceInstance,
} from 'src/infra/nestjs/cls.middleware';

export abstract class TypeormRepositoryBase<
  DM extends AggregateRoot,
  OrmEntity extends ObjectLiteral,
  QueryParams extends BaseAggregateQueryParams = BaseAggregateQueryParams,
> implements RepositoryPort<DM>
{
  protected abstract relations: string[];
  protected tableName: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly entity: new () => OrmEntity,
  ) {}

  public getEntityManager(): EntityManager {
    const namespace = getNamespaceInstance();
    let entityManager = namespace.get(ENTITY_MANAGER_KEY);

    if (!entityManager) {
      //For no transactional
      entityManager = this.dataSource.manager;
    }
    return entityManager;
  }

  public getEntityRepository<T extends ObjectLiteral>(
    entity: new () => T,
  ): Repository<T> {
    return this.getEntityManager().getRepository(entity);
  }

  public getRepository(): Repository<OrmEntity> {
    let entityManager: EntityManager = this.getEntityManager();

    if (!entityManager) {
      //For no transactional
      entityManager = this.dataSource.manager;
    }
    return entityManager.getRepository(this.entity);
  }
  // Abstract methods for conversion
  protected abstract toDomain(
    ormEntity: OrmEntity,
  ): TE.TaskEither<BaseException, DM>;
  protected abstract toEntity(
    domain: DM,
    initial: Option.Option<OrmEntity>,
  ): TE.TaskEither<BaseException, OrmEntity>;
  protected abstract prepareQuery(
    params: QueryParams,
  ): FindOptionsWhere<OrmEntity>;

  save(entity: DM): TE.TaskEither<BaseException, void> {
    return pipe(
      this.toEntity(entity, Option.none),
      TE.chain((ormEntity) =>
        TE.tryCatch(
          async () => {
            await this.getRepository().save([ormEntity]);
          },
          (error) => {
            return BaseExceptionTrait.construct(
              'SAVE_AGGREGATE_FIELD',
              `Failed to save aggregate: ${error}`,
            );
          },
        ),
      ),
    );
  }

  add(entity: DM): TE.TaskEither<BaseException, void> {
    return pipe(
      this.toEntity(entity, Option.none),
      TE.chain((ormEntity) =>
        TE.tryCatch(
          async () => {
            await this.getRepository().save(ormEntity);
          },
          (error) =>
            BaseExceptionTrait.construct(
              'SAVE_AGGREGATE_FIELD',
              `Failed to save aggregate: ${error}`,
            ),
        ),
      ),
    );
  }

  saveMultiple(entities: DM[]): TE.TaskEither<BaseException, void> {
    if (entities.length === 0) {
      return TE.right(undefined);
    }

    return pipe(
      entities,
      Arr.traverse(TE.ApplicativeSeq)((entity) =>
        pipe(this.toEntity(entity, Option.none)),
      ),
      TE.chain((ormEntities) =>
        TE.tryCatch(
          async () => {
            await this.getRepository().save(ormEntities);
          },
          (error) =>
            BaseExceptionTrait.construct(
              'ENTITY_SAVE_FAILED',
              `Failed to save aggregate in batch: ${error}`,
            ),
        ),
      ),
    );
  }

  findOne(
    params: Partial<QueryParams> = {},
  ): TE.TaskEither<BaseException, Option.Option<DM>> {
    return pipe(
      TE.tryCatch(
        async () => {
          const entity = await this.getRepository().findOne({
            where: this.prepareQuery(params as QueryParams),
            relations: this.relations,
          });
          return entity;
        },
        (error) =>
          BaseExceptionTrait.construct(
            'FIND_ONE_FAILED',
            `Failed to find entity: ${error}`,
          ),
      ),
      TE.chain((entity) =>
        entity
          ? pipe(this.toDomain(entity), TE.map(Option.some))
          : TE.right(Option.none),
      ),
    );
  }

  findOneOrThrow(
    params: Partial<QueryParams> = {},
  ): TE.TaskEither<BaseException, DM> {
    return pipe(
      this.findOne(params),
      TE.chain((optionEntity) =>
        pipe(
          optionEntity,
          Option.fold(
            () =>
              TE.left(
                BaseExceptionTrait.construct(
                  'FIND_ONE_FAILED_NOT_FOUND',
                  `Failed to find aggregate`,
                ),
              ),
            TE.right,
          ),
        ),
      ),
    );
  }

  findOneByIdOrThrow(id: Identifier): TE.TaskEither<BaseException, DM> {
    return pipe(
      TE.tryCatch(
        async () => {
          const entity = await this.getRepository().findOne({
            where: { id } as unknown as FindOptionsWhere<OrmEntity>,
            relations: this.relations,
          });
          if (!entity) {
            throw new Error(`Entity with id ${id} not found`);
          }
          return entity;
        },
        (error) =>
          BaseExceptionTrait.construct(
            'FIND_ONE_BY_ID_FAILED',
            `Failed to find entity by id: ${error}`,
          ),
      ),
      TE.chain((entity) => pipe(this.toDomain(entity))),
    );
  }

  findMany(
    params: Partial<QueryParams> = {},
  ): TE.TaskEither<BaseException, DM[]> {
    return pipe(
      TE.tryCatch(
        async () => {
          const entities = await this.getRepository().find({
            where: this.prepareQuery(params as QueryParams),
            relations: this.relations,
          });
          return entities;
        },
        (error) =>
          BaseExceptionTrait.construct(
            'FIND_MANY_FAILED',
            `Failed to find entities: ${error}`,
          ),
      ),
      TE.chain((entities) =>
        pipe(
          entities,
          Arr.traverse(TE.ApplicativeSeq)((entity) =>
            pipe(this.toDomain(entity)),
          ),
        ),
      ),
    );
  }

  findManyPaginated({
    params = {} as any,
    pagination,
    orderBy,
  }: FindManyPaginatedParams<QueryParams>): TE.TaskEither<
    BaseException,
    DataWithPaginationMeta<DM[]>
  > {
    const skip =
      pagination?.skip ??
      (pagination?.page
        ? (pagination.page - 1) * (pagination?.limit ?? 10)
        : 0);
    const take = pagination?.limit ?? 10;

    return pipe(
      TE.Do,
      TE.bind('total', () =>
        TE.tryCatch(
          async () =>
            this.getRepository().count({
              where: this.prepareQuery(params as QueryParams),
            }),
          (error) =>
            BaseExceptionTrait.construct(
              'COUNT_ENTITY_FAILED',
              `Failed to count entities: ${error}`,
            ),
        ),
      ),
      TE.bind('entities', () =>
        TE.tryCatch(
          async () =>
            this.getRepository().find({
              where: this.prepareQuery(params as QueryParams),
              skip,
              take,
              order: orderBy as FindOptionsOrder<OrmEntity>,
              relations: this.relations,
            }),
          (error) =>
            BaseExceptionTrait.construct(
              'PAGINATED_ENTITY_FAILED',
              `Failed to find paginated entities: ${error}`,
            ),
        ),
      ),
      TE.chain(({ total, entities }) =>
        pipe(
          entities,
          Arr.traverse(TE.ApplicativeSeq)((entity) =>
            pipe(this.toDomain(entity)),
          ),
          TE.map((domainEntities) => ({
            data: domainEntities,
            count: total,
            limit: take,
            page: pagination?.page ?? Math.floor(skip / take) + 1,
          })),
        ),
      ),
    );
  }

  delete(entity: DM): TE.TaskEither<BaseException, void> {
    return TE.tryCatch(
      async () => {
        await this.getRepository().delete(entity.id);
      },
      (error) =>
        BaseExceptionTrait.construct(
          'DELETE_ENTITY_FAILED',
          `Failed to delete entity: ${error}`,
        ),
    );
  }
}

import { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';
import { ObjectId } from 'typeorm/driver/mongodb/typings';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpdateResult } from 'typeorm/query-builder/result/UpdateResult';
import { FindOneOptions } from 'typeorm/find-options/FindOneOptions';
import { DeepPartial } from 'typeorm/common/DeepPartial';
import { SaveOptions } from 'typeorm/repository/SaveOptions';
import { QueryRunner } from 'typeorm/query-runner/QueryRunner';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { RemoveOptions } from 'typeorm/repository/RemoveOptions';
import { InsertResult } from 'typeorm/query-builder/result/InsertResult';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { DeleteResult } from 'typeorm/query-builder/result/DeleteResult';
import { FindManyOptions } from 'typeorm/find-options/FindManyOptions';
import { PickKeysByType } from 'typeorm/common/PickKeysByType';
import { ENTITY_MANAGER_KEY, getNamespaceInstance } from '../cls.middleware';

class BaseRepository<T extends ObjectLiteral> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly entity: new () => T,
  ) {}

  public getEntityManager(): EntityManager {
    const namespace = getNamespaceInstance();
    return namespace.get(ENTITY_MANAGER_KEY);
  }

  public getRepository(): Repository<T> {
    let entityManager: EntityManager = this.getEntityManager();

    if (!entityManager) {
      //For no transactional
      entityManager = this.dataSource.manager;
    }
    return entityManager.getRepository(this.entity);
  }

  createQueryBuilder(
    alias?: string,
    queryRunner?: QueryRunner,
  ): SelectQueryBuilder<T> {
    return this.getRepository().createQueryBuilder(alias, queryRunner);
  }

  /**
   * Executes a raw SQL query and returns a raw database results.
   * Raw query execution is supported only by relational databases (MongoDB is not supported).
   */
  query(query: string, parameters?: any[]): Promise<any> {
    return this.getRepository().query(query, parameters);
  }

  create(): T;
  create(entityLikeArray: DeepPartial<T>[]): T[];
  create(entityLike: DeepPartial<T>): T;
  create(entityLike?: DeepPartial<T> | DeepPartial<T>[]): T | T[] {
    if (Array.isArray(entityLike)) {
      return this.getRepository().create(entityLike);
    } else if (entityLike) {
      return this.getRepository().create(entityLike);
    } else {
      return this.getRepository().create();
    }
  }

  save<A extends DeepPartial<T>>(
    entities: A[],
    options: SaveOptions & { reload: false },
  ): Promise<T[]>;
  save<A extends DeepPartial<T>>(
    entities: A[],
    options?: SaveOptions,
  ): Promise<(A & T)[]>;
  save<A extends DeepPartial<T>>(
    entity: A,
    options: SaveOptions & { reload: false },
  ): Promise<T>;
  save<A extends DeepPartial<T>>(
    entity: A,
    options?: SaveOptions,
  ): Promise<A & T>;
  save(entityOrEntities: any, options?: SaveOptions): Promise<any> {
    return this.getRepository().save(entityOrEntities, options);
  }

  remove(entities: T[], options?: RemoveOptions): Promise<T[]>;
  remove(entity: T, options?: RemoveOptions): Promise<T>;
  remove(entityOrEntities: T | T[], options?: RemoveOptions): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      return this.getRepository().remove(entityOrEntities, options);
    } else {
      return this.getRepository().remove(entityOrEntities, options);
    }
  }

  /**
   * Inserts a given entity into the database.
   * Unlike save method executes a primitive operation without cascades, relations and other operations included.
   * Executes fast and efficient INSERT query.
   * Does not check if entity exist in the database, so query will fail if duplicate entity is being inserted.
   */
  insert(
    entity: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[],
  ): Promise<InsertResult> {
    return this.getRepository().insert(entity);
  }

  /**
   * Updates entity partially. Entity can be found by a given conditions.
   * Unlike save method executes a primitive operation without cascades, relations and other operations included.
   * Executes fast and efficient UPDATE query.
   * Does not check if entity exist in the database.
   */
  update(
    criteria:
      | string
      | string[]
      | number
      | number[]
      | Date
      | Date[]
      | ObjectId
      | ObjectId[]
      | FindOptionsWhere<T>,
    partialEntity: QueryDeepPartialEntity<T>,
  ): Promise<UpdateResult> {
    return this.getRepository().update(criteria, partialEntity);
  }

  /**
   * Inserts a given entity into the database, unless a unique constraint conflicts then updates the entity
   * Unlike save method executes a primitive operation without cascades, relations and other operations included.
   * Executes fast and efficient INSERT ... ON CONFLICT DO UPDATE/ON DUPLICATE KEY UPDATE query.
   */
  upsert(
    entityOrEntities: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[],
    conflictPathsOrOptions: string[] | UpsertOptions<T>,
  ): Promise<InsertResult> {
    return this.getRepository().upsert(
      entityOrEntities,
      conflictPathsOrOptions,
    );
  }

  /**
   * Deletes entities by a given criteria.
   * Unlike save method executes a primitive operation without cascades, relations and other operations included.
   * Executes fast and efficient DELETE query.
   * Does not check if entity exist in the database.
   */
  delete(
    criteria:
      | string
      | string[]
      | number
      | number[]
      | Date
      | Date[]
      | ObjectId
      | ObjectId[]
      | FindOptionsWhere<T>,
  ): Promise<DeleteResult> {
    return this.getRepository().delete(criteria);
  }

  /**
   * Checks whether any entity exists that matches the given options.
   *
   * @deprecated use `exists` method instead, for example:
   *
   * .exists()
   */
  exist(options?: FindManyOptions<T>): Promise<boolean> {
    return this.getRepository().exist(options);
  }

  /**
   * Checks whether any entity exists that matches the given options.
   */
  exists(options?: FindManyOptions<T>): Promise<boolean> {
    return this.getRepository().exists(options);
  }

  /**
   * Checks whether any entity exists that matches the given conditions.
   */
  existsBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<boolean> {
    return this.getRepository().existsBy(where);
  }

  /**
   * Counts entities that match given options.
   * Useful for pagination.
   */
  count(options?: FindManyOptions<T>): Promise<number> {
    return this.getRepository().count(options);
  }

  /**
   * Counts entities that match given conditions.
   * Useful for pagination.
   */
  countBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<number> {
    return this.getRepository().countBy(where);
  }

  /**
   * Return the SUM of a column
   */
  sum(
    columnName: PickKeysByType<T, number>,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number | null> {
    return this.getRepository().sum(columnName, where);
  }

  /**
   * Return the AVG of a column
   */
  average(
    columnName: PickKeysByType<T, number>,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number | null> {
    return this.getRepository().average(columnName, where);
  }

  /**
   * Return the MIN of a column
   */
  minimum(
    columnName: PickKeysByType<T, number>,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number | null> {
    return this.getRepository().minimum(columnName, where);
  }
  /**
   * Return the MAX of a column
   */
  maximum(
    columnName: PickKeysByType<T, number>,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number | null> {
    return this.getRepository().maximum(columnName, where);
  }

  /**
   * Finds entities that match given find options.
   */
  find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.getRepository().find(options);
  }

  /**
   * Finds entities that match given find options.
   */
  findBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T[]> {
    return this.getRepository().findBy(where);
  }

  /**
   * Finds entities that match given find options.
   * Also counts all entities that match given conditions,
   * but ignores pagination settings (from and take options).
   */
  findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.getRepository().findAndCount(options);
  }

  /**
   * Finds entities that match given WHERE conditions.
   * Also counts all entities that match given conditions,
   * but ignores pagination settings (from and take options).
   */
  findAndCountBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<[T[], number]> {
    return this.getRepository().findAndCountBy(where);
  }

  /**
   * Finds entities with ids.
   * Optionally find options or conditions can be applied.
   *
   * @deprecated use `findBy` method instead in conjunction with `In` operator, for example:
   *
   * .findBy({
   *     id: In([1, 2, 3])
   * })
   */
  findByIds(ids: any[]): Promise<T[]> {
    return this.getRepository().findByIds(ids);
  }

  /**
   * Finds first entity by a given find options.
   * If entity was not found in the database - returns null.
   */
  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.getRepository().findOne(options);
  }

  /**
   * Finds first entity that matches given where condition.
   * If entity was not found in the database - returns null.
   */
  findOneBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T | null> {
    return this.getRepository().findOneBy(where);
  }
}

export default BaseRepository;

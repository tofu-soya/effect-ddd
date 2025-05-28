/*  Most of repositories will probably need generic 
    save/find/delete operations, so it's easier
    to have some shared interfaces.
    More specific interfaces should be defined
    in a respective module/use case.
*/

import { Effect } from 'effect';
import { AggregateRoot, BaseException } from '@model/effect';
import { Identifier } from 'src/typeclasses/obj-with-id';

export interface Save<A extends AggregateRoot> {
  save(aggregateRoot: A): Effect.Effect<void, BaseException, any>;
}

export interface Add<A extends AggregateRoot> {
  add(entity: A): Effect.Effect<void, BaseException, any>;
}

export interface SaveMultiple<A extends AggregateRoot> {
  saveMultiple(entities: A[]): Effect.Effect<void, BaseException, any>;
}

export interface FindOne<A extends AggregateRoot, QueryParams = any> {
  findOneOrThrow(params: QueryParams): Effect.Effect<A, BaseException, any>;
}

export interface FindOneById<A extends AggregateRoot> {
  findOneByIdOrThrow(id: Identifier): Effect.Effect<A, BaseException, any>;
}

export interface FindMany<A extends AggregateRoot, QueryParams = any> {
  findMany(params: QueryParams): Effect.Effect<A[], BaseException, any>;
}

export interface OrderBy {
  [key: number]: 'ASC' | 'DESC';
}

export interface PaginationMeta {
  skip?: number;
  limit?: number;
  page?: number;
}

export interface FindManyPaginatedParams<QueryParams = any> {
  params?: QueryParams;
  pagination?: PaginationMeta;
  orderBy?: OrderBy;
}

export interface DataWithPaginationMeta<T> {
  data: T;
  count: number;
  limit?: number;
  page?: number;
}

export interface FindManyPaginated<A extends AggregateRoot, QueryParams = any> {
  findManyPaginated(
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<A[]>, BaseException, any>;
}

export interface DeleteOne<A extends AggregateRoot> {
  delete?(entity: A): Effect.Effect<void, BaseException, any>;
}

export interface RepositoryPort<A extends AggregateRoot, QueryParams = any>
  extends Save<A>,
    FindOne<A, QueryParams>,
    FindOneById<A>,
    FindMany<A, QueryParams>,
    Add<A>,
    FindManyPaginated<A, QueryParams>,
    DeleteOne<A>,
    SaveMultiple<A> {
  setCorrelationId?(correlationId: string): this;
}

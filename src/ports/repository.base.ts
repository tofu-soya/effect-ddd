/*  Most of repositories will probably need generic 
    save/find/delete operations, so it's easier
    to have some shared interfaces.
    More specific interfaces should be defined
    in a respective module/use case.
*/

import { TE } from '@logic/fp';
import { AggregateRoot, BaseException } from '@model/effect';
import { Identifier } from 'src/typeclasses/obj-with-id';

export interface Save<A extends AggregateRoot> {
  save(aggregateRoot: A): TE.TaskEither<BaseException, void>;
}

export interface Add<A extends AggregateRoot> {
  add(entity: A): TE.TaskEither<BaseException, void>;
}

export interface SaveMultiple<A extends AggregateRoot> {
  saveMultiple(entities: A[]): TE.TaskEither<BaseException, void>;
}

export interface FindOne<A extends AggregateRoot, QueryParams = any> {
  findOneOrThrow(params: QueryParams): TE.TaskEither<BaseException, A>;
}

export interface FindOneById<A extends AggregateRoot> {
  findOneByIdOrThrow(id: Identifier): TE.TaskEither<BaseException, A>;
}

export interface FindMany<A extends AggregateRoot, QueryParams = any> {
  findMany(params: QueryParams): TE.TaskEither<BaseException, A[]>;
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
  ): TE.TaskEither<BaseException, DataWithPaginationMeta<A[]>>;
}

export interface DeleteOne<A extends AggregateRoot> {
  delete?(entity: A): TE.TaskEither<BaseException, unknown>;
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

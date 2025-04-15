/*  Most of repositories will probably need generic 
    save/find/delete operations, so it's easier
    to have some shared interfaces.
    More specific interfaces should be defined
    in a respective module/use case.
*/

import { BaseException } from '@logic/exception.base';
import { Context, Effect } from 'effect';
import { AggregateRoot } from '@model/aggregate-root.base';
import { Identifier } from 'src/typeclasses/obj-with-id';
import { IDomainEventPublisher } from '../model/effect/domain-event-publisher.interface';

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

/**
 * Repository interface using Effect for error handling and dependency management
 */
export interface RepositoryPort<A extends AggregateRoot, QueryParams = any> {
  /**
   * Save an existing aggregate root
   */
  save(aggregateRoot: A): Effect.Effect<void, BaseException, IDomainEventPublisher>;
  
  /**
   * Add a new aggregate root
   */
  add(entity: A): Effect.Effect<void, BaseException, IDomainEventPublisher>;
  
  /**
   * Save multiple aggregate roots
   */
  saveMultiple(entities: A[]): Effect.Effect<void, BaseException, IDomainEventPublisher>;
  
  /**
   * Find one aggregate root by query parameters
   */
  findOneOrThrow(params: QueryParams): Effect.Effect<A, BaseException, never>;
  
  /**
   * Find one aggregate root by ID
   */
  findOneByIdOrThrow(id: Identifier): Effect.Effect<A, BaseException, never>;
  
  /**
   * Find many aggregate roots by query parameters
   */
  findMany(params: QueryParams): Effect.Effect<A[], BaseException, never>;
  
  /**
   * Find many aggregate roots with pagination
   */
  findManyPaginated(
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<A[]>, BaseException, never>;
  
  /**
   * Delete an aggregate root
   */
  delete(entity: A): Effect.Effect<void, BaseException, never>;
  
  /**
   * Set correlation ID for tracking
   */
  setCorrelationId?(correlationId: string): this;
}

/**
 * Repository Context Tag
 */
export class RepositoryContext<A extends AggregateRoot, Q = any> extends Context.Tag(
  'Repository',
)<RepositoryContext<A, Q>, RepositoryPort<A, Q>>() {}

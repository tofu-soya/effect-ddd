import { Effect, Layer } from 'effect';
import { AggregateRoot } from '../model/effect/aggregate-root.base';
import { BaseException } from '../logic/exception.base';
import { DataWithPaginationMeta, FindManyPaginatedParams, OrderBy, RepositoryContext, RepositoryPort } from './repository.base';
import { Identifier } from '../typeclasses/obj-with-id';
import { IDomainEvent } from '../model/effect/domain-event.interface';
import { DomainEventPublisherContext, IDomainEventPublisher } from '../model/effect/domain-event-publisher.interface';

/**
 * Mock implementation of the repository port
 */
export class MockRepository<A extends AggregateRoot, QueryParams = any> implements RepositoryPort<A, QueryParams> {
  private items: Map<string, A> = new Map();
  private correlationId?: string;

  constructor(initialItems: A[] = []) {
    initialItems.forEach(item => {
      this.items.set(item.id.toString(), item);
    });
  }

  /**
   * Save an existing aggregate root and publish its domain events
   */
  save(aggregateRoot: A): Effect.Effect<void, BaseException, IDomainEventPublisher> {
    return Effect.gen(function*($) {
      // Store the entity
      const self = yield* $(Effect.succeed(() => {
        const id = aggregateRoot.id.toString();
        if (!this.items.has(id)) {
          throw new Error(`Entity with id ${id} not found`);
        }
        this.items.set(id, aggregateRoot);
        return this;
      }));

      // Get the domain events publisher
      const publisher = yield* $(Effect.service(DomainEventPublisherContext));
      
      // Publish domain events
      const events = aggregateRoot.domainEvents;
      if (events.length > 0) {
        yield* $(publisher.publishAll(events));
      }
    });
  }

  /**
   * Add a new aggregate root and publish its domain events
   */
  add(entity: A): Effect.Effect<void, BaseException, IDomainEventPublisher> {
    return Effect.gen(function*($) {
      // Store the entity
      const self = yield* $(Effect.succeed(() => {
        const id = entity.id.toString();
        if (this.items.has(id)) {
          throw new Error(`Entity with id ${id} already exists`);
        }
        this.items.set(id, entity);
        return this;
      }));

      // Get the domain events publisher
      const publisher = yield* $(Effect.service(DomainEventPublisherContext));
      
      // Publish domain events
      const events = entity.domainEvents;
      if (events.length > 0) {
        yield* $(publisher.publishAll(events));
      }
    });
  }

  /**
   * Save multiple aggregate roots and publish their domain events
   */
  saveMultiple(entities: A[]): Effect.Effect<void, BaseException, IDomainEventPublisher> {
    return Effect.gen(function*($) {
      // Store all entities
      yield* $(Effect.succeed(() => {
        entities.forEach(entity => {
          const id = entity.id.toString();
          this.items.set(id, entity);
        });
      }));

      // Get the domain events publisher
      const publisher = yield* $(Effect.service(DomainEventPublisherContext));
      
      // Collect all domain events
      const allEvents: IDomainEvent[] = [];
      entities.forEach(entity => {
        allEvents.push(...entity.domainEvents);
      });
      
      // Publish all events
      if (allEvents.length > 0) {
        yield* $(publisher.publishAll(allEvents));
      }
    });
  }

  /**
   * Find one aggregate root by query parameters
   */
  findOneOrThrow(params: QueryParams): Effect.Effect<A, BaseException, never> {
    return Effect.try({
      try: () => {
        // In a real implementation, this would filter based on params
        // For mock, just return the first item that matches some condition
        for (const item of this.items.values()) {
          return item;
        }
        throw new Error('Entity not found');
      },
      catch: (error) => new Error(`Failed to find entity: ${error.message}`) as BaseException
    });
  }

  /**
   * Find one aggregate root by ID
   */
  findOneByIdOrThrow(id: Identifier): Effect.Effect<A, BaseException, never> {
    return Effect.try({
      try: () => {
        const item = this.items.get(id.toString());
        if (!item) {
          throw new Error(`Entity with id ${id} not found`);
        }
        return item;
      },
      catch: (error) => new Error(`Failed to find entity by id: ${error.message}`) as BaseException
    });
  }

  /**
   * Find many aggregate roots by query parameters
   */
  findMany(params: QueryParams): Effect.Effect<A[], BaseException, never> {
    return Effect.try({
      try: () => {
        // In a real implementation, this would filter based on params
        // For mock, just return all items
        return Array.from(this.items.values());
      },
      catch: (error) => new Error(`Failed to find entities: ${error.message}`) as BaseException
    });
  }

  /**
   * Find many aggregate roots with pagination
   */
  findManyPaginated(
    options: FindManyPaginatedParams<QueryParams>,
  ): Effect.Effect<DataWithPaginationMeta<A[]>, BaseException, never> {
    return Effect.try({
      try: () => {
        const allItems = Array.from(this.items.values());
        const pagination = options.pagination || { skip: 0, limit: 10 };
        const skip = pagination.skip || 0;
        const limit = pagination.limit || 10;
        
        const paginatedItems = allItems.slice(skip, skip + limit);
        
        return {
          data: paginatedItems,
          count: allItems.length,
          limit,
          page: pagination.page
        };
      },
      catch: (error) => new Error(`Failed to find paginated entities: ${error.message}`) as BaseException
    });
  }

  /**
   * Delete an aggregate root
   */
  delete(entity: A): Effect.Effect<void, BaseException, never> {
    return Effect.try({
      try: () => {
        const id = entity.id.toString();
        if (!this.items.has(id)) {
          throw new Error(`Entity with id ${id} not found`);
        }
        this.items.delete(id);
      },
      catch: (error) => new Error(`Failed to delete entity: ${error.message}`) as BaseException
    });
  }

  /**
   * Set correlation ID for tracking
   */
  setCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }
}

/**
 * Create a Layer for the mock repository
 */
export const createMockRepositoryLayer = <A extends AggregateRoot, Q = any>(
  initialItems: A[] = []
): Layer.Layer<RepositoryContext<A, Q>, never, never> => {
  return Layer.succeed(
    RepositoryContext<A, Q>(),
    new MockRepository<A, Q>(initialItems)
  );
};

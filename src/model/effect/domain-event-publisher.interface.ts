import { Context, Effect } from 'effect';
import { BaseException } from '../../logic/exception.base';
import { IDomainEvent, IDomainEventRepository } from './domain-event.interface';

/**
 * Interface for domain event publisher
 */
export interface DomainEventPublisher {
  /**
   * Publish a domain event
   */
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, never>;
  
  /**
   * Publish multiple domain events
   */
  publishAll(events: ReadonlyArray<IDomainEvent>): Effect.Effect<void, BaseException, never>;
}

/**
 * DomainEventPublisher service implementation
 */
export class DomainEventPublisherImpl implements DomainEventPublisher {
  /**
   * Publish a domain event by persisting it
   */
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, IDomainEventRepository> {
    return Effect.flatMap(
      Effect.service(DomainEventRepository),
      (repository) => repository.save(event)
    );
  }
  
  /**
   * Publish multiple domain events by persisting them
   */
  publishAll(events: ReadonlyArray<IDomainEvent>): Effect.Effect<void, BaseException, IDomainEventRepository> {
    return Effect.forEach(
      events,
      (event) => this.publish(event),
      { concurrency: 'unbounded' }
    );
  }
}

/**
 * DomainEventPublisher Context
 */
export const DomainEventPublisher = Context.Tag<DomainEventPublisher>("DomainEventPublisher");

/**
 * DomainEventRepository Context
 */
export const DomainEventRepository = Context.Tag<IDomainEventRepository>("DomainEventRepository");

/**
 * Layer for providing DomainEventPublisher implementation
 */
export const DomainEventPublisherLive = Effect.layer.succeed(
  DomainEventPublisher,
  new DomainEventPublisherImpl()
);

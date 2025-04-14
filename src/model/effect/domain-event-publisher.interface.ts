import { Context, Effect } from 'effect';
import { BaseException } from '../../logic/exception.base';
import { IDomainEvent, IDomainEventRepository } from './domain-event.interface';

/**
 * DomainEventRepository Context
 */
export const DomainEventRepository = Context.Tag<IDomainEventRepository>("DomainEventRepository");

/**
 * DomainEventPublisher service interface
 */
export interface DomainEventPublisher {
  /**
   * Publish a domain event
   */
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, IDomainEventRepository>;
  
  /**
   * Publish multiple domain events
   */
  publishAll(events: ReadonlyArray<IDomainEvent>): Effect.Effect<void, BaseException, IDomainEventRepository>;
}

/**
 * DomainEventPublisher Context
 */
export const DomainEventPublisher = Context.Tag<DomainEventPublisher>("DomainEventPublisher");

/**
 * DomainEventPublisher implementation
 */
export const DomainEventPublisherLive = DomainEventPublisher.implement({
  publish: (event) => 
    Effect.flatMap(
      Effect.service(DomainEventRepository),
      (repository) => repository.save(event)
    ),
  
  publishAll: (events) => 
    Effect.flatMap(
      Effect.service(DomainEventRepository),
      (repository) => 
        Effect.forEach(
          events,
          (event) => repository.save(event),
          { concurrency: 'unbounded' }
        )
    )
});

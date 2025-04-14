import { Effect } from 'effect';
import { BaseException } from '../../logic/exception.base';
import { IDomainEvent, IDomainEventRepository } from './domain-event.interface';

/**
 * Interface for domain event publisher
 */
export interface IDomainEventPublisher {
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
 * Implementation of domain event publisher
 */
export class DomainEventPublisher implements IDomainEventPublisher {
  constructor(private readonly eventRepository: IDomainEventRepository) {}
  
  /**
   * Publish a domain event by persisting it
   */
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, never> {
    return this.eventRepository.save(event);
  }
  
  /**
   * Publish multiple domain events by persisting them
   */
  publishAll(events: ReadonlyArray<IDomainEvent>): Effect.Effect<void, BaseException, never> {
    return Effect.forEach(
      events,
      (event) => this.publish(event),
      { concurrency: 'unbounded' }
    );
  }
}

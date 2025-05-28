import { Context, Effect, Layer } from 'effect';
import { IDomainEvent, IDomainEventRepository } from './domain-event.interface';
import { BaseException } from './exception';

/**
 * DomainEventRepository Context
 */
export class DomainEventRepositoryContext extends Context.Tag(
  'DomainEventRepository',
)<DomainEventRepositoryContext, IDomainEventRepository>() { }

/**
 * DomainEventPublisher service interface
 */
export interface IDomainEventPublisher {
  /**
   * Publish a domain event
   */
  publish(
    event: IDomainEvent,
  ): Effect.Effect<void, BaseException, IDomainEventRepository>;

  /**
   * Publish multiple domain events
   */
  publishAll(
    events: ReadonlyArray<IDomainEvent>,
  ): Effect.Effect<void, BaseException, IDomainEventRepository>;
}

/**
 * DomainEventPublisher Context
 */
export class DomainEventPublisherContext extends Context.Tag(
  'DomainEventPublisher',
)<DomainEventPublisherContext, IDomainEventPublisher>() { }

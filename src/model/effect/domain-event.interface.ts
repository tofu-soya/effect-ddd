import { Identifier } from '../../typeclasses/obj-with-id';
import { Effect } from 'effect';
import { BaseException } from '../../logic/exception.base';

/**
 * Interface for domain events
 */
export interface IDomainEventTrait {
  create<P, A extends AggregateRoot>(params: {
    name: string;
    payload: P;
    correlationId: string;
    causationId?: string;
    userId?: string;
    aggregate?: A;
  }): IDomainEvent<P>;
}

export interface IDomainEvent<P = any> {
  readonly name: string;
  readonly metadata: {
    readonly timestamp: number;
    readonly correlationId: string;
    readonly causationId?: string;
    readonly userId?: string;
  };
  readonly payload: P;
  readonly aggregateId?: Identifier;
  readonly aggregateType?: string;

  getPayload(): P;
}

/**
 * Repository for persisting domain events
 */
export interface IDomainEventRepository {
  /**
   * Save a domain event
   */
  save(event: IDomainEvent): Effect.Effect<void, BaseException, never>;

  /**
   * Get unhandled domain events
   */
  getUnhandledEvents(): Effect.Effect<IDomainEvent[], BaseException, never>;

  /**
   * Mark a domain event as handled
   */
  markAsHandled(eventId: string): Effect.Effect<void, BaseException, never>;
}

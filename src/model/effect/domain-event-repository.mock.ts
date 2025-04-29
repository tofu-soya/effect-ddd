import { Effect, Layer } from 'effect';
import { BaseException, BaseExceptionTrait } from '../../logic/exception.base';
import { IDomainEvent, IDomainEventRepository } from './domain-event.interface';
import { DomainEventRepositoryContext } from './domain-event-publisher.interface';

/**
 * Mock implementation of the DomainEventRepository
 */
export class MockDomainEventRepository implements IDomainEventRepository {
  private events: Map<string, IDomainEvent> = new Map();
  private handledEvents: Set<string> = new Set();

  /**
   * Save a domain event
   */
  save(event: IDomainEvent): Effect.Effect<void, BaseException, never> {
    return Effect.try({
      try: () => {
        const eventId = `${event.name}-${event.metadata.timestamp}`;
        this.events.set(eventId, event);
      },
      catch: (error) =>
        BaseExceptionTrait.construct(
          'SAVE_EVENT_FAILED',
          `Failed to save event: ${error}`,
        ),
    });
  }

  /**
   * Get unhandled domain events
   */
  getUnhandledEvents(): Effect.Effect<IDomainEvent[], BaseException, never> {
    return Effect.try({
      try: () => {
        const unhandledEvents: IDomainEvent[] = [];
        this.events.forEach((event, eventId) => {
          if (!this.handledEvents.has(eventId)) {
            unhandledEvents.push(event);
          }
        });
        return unhandledEvents;
      },
      catch: (error) =>
        BaseExceptionTrait.construct(
          'GET_UNHANDLED_EVENT_FAILED',
          `Failed to get unhandled events: ${error}`,
        ) as BaseException,
    });
  }

  /**
   * Mark a domain event as handled
   */
  markAsHandled(eventId: string): Effect.Effect<void, BaseException, never> {
    return Effect.try({
      try: () => {
        if (!this.events.has(eventId)) {
          throw new Error(`Event with id ${eventId} not found`);
        }
        this.handledEvents.add(eventId);
      },
      catch: (error) =>
        BaseExceptionTrait.construct(
          'MARK_EVENT_AS_HANDLED_FAILED',
          `Failed to mark event as handled: ${error}`,
        ),
    });
  }
}

/**
 * Create a Layer for the mock domain event repository
 */
export const MockDomainEventRepositoryLayer = Layer.succeed(
  DomainEventRepositoryContext,
  new MockDomainEventRepository(),
);

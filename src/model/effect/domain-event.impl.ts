import { Identifier } from 'src/typeclasses';
import { IDomainEventTrait, IDomainEvent } from './domain-event.interface';

/**
 * DomainEventPublisher implementation
 */
export const DomainEventTrait: IDomainEventTrait = {
  create<P, A extends AggregateRoot>(params: {
    name: string;
    payload: P;
    correlationId: string;
    causationId?: string;
    userId?: string;
    aggregate?: A;
  }): IDomainEvent<P> {
    return {
      name: params.name,
      metadata: {
        timestamp: Date.now(),
        correlationId: params.correlationId,
        causationId: params.causationId,
        userId: params.userId,
      },
      payload: params.payload,
      aggregateId: params.aggregate?.id,
      aggregateType: params.aggregate?.constructor.name,
      getPayload: () => params.payload,
    };
  },
};

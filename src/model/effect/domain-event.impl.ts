import { IDomainEventTrait, IDomainEvent } from './domain-event.interface';
import { AggGenericTrait, AggregateRoot } from './aggregate-root.base';

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
      aggregateId: params.aggregate && AggGenericTrait.getId(params.aggregate),
      aggregateType:
        params.aggregate && AggGenericTrait.getTag(params.aggregate),
      getPayload: () => params.payload,
    };
  },
};

import { Effect, Layer } from 'effect';
import {
  DomainEventPublisherContext,
  DomainEventRepositoryContext,
} from './domain-event-publisher.interface';

/**
 * DomainEventPublisher implementation
 */
export const DomainEventFactoryImplement = {
  create<P>(params: {
    name: string;
    payload: P;
    correlationId: string;
    causationId?: string;
    userId?: string;
    aggregateId?: Identifier;
    aggregateType?: string;
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
      aggregateId: params.aggregateId,
      aggregateType: params.aggregateType,
      getPayload: () => params.payload,
    };
  },
};

export const DomainEvenPublishImplementLayer = Layer.effect(
  DomainEventPublisherContext,
  Effect.gen(function* () {
    const repository = yield* DomainEventRepositoryContext;
    return {
      publish: (event) => {
        return repository.save(event);
      },
      publishAll: (events) => {
        return Effect.forEach(events, (event) => repository.save(event), {
          concurrency: 'unbounded',
        });
      },
    };
  }),
);

import { Effect, Layer } from 'effect';
import {
  IDomainEventTrait,
  IDomainEvent,
  DomainEventPublisherContext,
  DomainEventRepositoryContext,
} from '../interfaces/domain-event.interface';

import { AggregateRoot } from '@model/interfaces/aggregate-root.interface';
import { AggGenericTrait } from './aggregate-root.impl';

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

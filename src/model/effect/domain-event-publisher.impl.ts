import { Effect, Layer } from 'effect';
import {
  DomainEventPublisherContext,
  DomainEventRepositoryContext,
} from './domain-event-publisher.interface';

/**
 * DomainEventPublisher implementation
 */
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

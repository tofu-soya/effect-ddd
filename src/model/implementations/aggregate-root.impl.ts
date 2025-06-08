import { IDomainEvent } from '../interfaces/domain-event.interface';
import {
  AggregatePropsParser,
  AggregateRoot,
  AggregateRootTrait,
  IAggGenericTrait,
} from '../interfaces/aggregate-root.interface';
import { CommandOnModel } from '../interfaces/entity.interface';
import { GetProps, IdentifierTrait } from 'src/typeclasses';
import { Effect, Option, pipe } from 'effect';
import { CoreException } from '../interfaces/validation.interface';
import { EntityGenericTrait } from './entity.impl';

/**
 * Implementation of the generic aggregate root trait
 */
export const AggGenericTrait: IAggGenericTrait = {
  // Inherit all methods from EntityGenericTrait
  ...EntityGenericTrait,
  // Aggregate specific methods
  getDomainEvents: (aggregate) => aggregate.domainEvents,

  clearEvents: (aggregate) => ({
    ...aggregate,
    domainEvents: [],
  }),

  addDomainEvent: (event) => (aggregate) => ({
    ...aggregate,
    domainEvents: [...(aggregate.domainEvents || []), event],
  }),

  addDomainEvents: (events) => (aggregate) => ({
    ...aggregate,
    domainEvents: [...(aggregate.domainEvents || []), ...events],
  }),
  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A, P>,
    tag: string,
    options?: { autoGenId: boolean },
  ) => {
    const entityTrait = EntityGenericTrait.createEntityTrait<A, N, P>(
      propsParser,
      tag,
      options,
    );
    return {
      parse: (i) =>
        pipe(
          i,
          entityTrait.parse,
          Effect.map(AggGenericTrait.addDomainEvents([])),
        ),
      new: (i) =>
        pipe(
          i,
          entityTrait.new,
          Effect.map(AggGenericTrait.addDomainEvents([])),
        ),
    } as AggregateRootTrait<A, N, P>;
  },
  asCommand: <A extends AggregateRoot, I>(
    reducerLogic: (
      input: I,
      props: GetProps<A>,
      aggregate: A,
      correlationId: string,
    ) => Effect.Effect<
      { props: GetProps<A>; domainEvents: IDomainEvent[] },
      CoreException,
      never
    >,
  ) => {
    return (input: I): CommandOnModel<A> => {
      return (aggregate: A, correlationId?: string) => {
        const _correlationId = correlationId || IdentifierTrait.uuid();
        return pipe(
          reducerLogic(
            input,
            AggGenericTrait.unpack(aggregate),
            aggregate,
            _correlationId,
          ),
          Effect.map(({ props, domainEvents }) => {
            // Apply all domain events to the aggregate
            const withEvents = domainEvents.reduce<A>(
              (agg, event) => AggGenericTrait.addDomainEvent<A>(event)(agg),
              aggregate,
            );

            return {
              ...withEvents,
              props: props as A['props'],
              updatedAt: Option.some(new Date()),
            };
          }),
        );
      };
    };
  },
};

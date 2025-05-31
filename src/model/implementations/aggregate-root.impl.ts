import { IDomainEvent } from '../interfaces/domain-event.interface';
import {
  AggregatePropsParser,
  AggregateRoot,
  AggregateRootTrait,
} from '../interfaces/aggregate-root.interface';
import {
  CommandOnModel,
  IEntityGenericTrait,
} from '../interfaces/entity.interface';
import { GetProps, IdentifierTrait } from 'src/typeclasses';
import { Effect, Option, pipe } from 'effect';
import { CoreException } from '../interfaces/validation.interface';
import { EntityGenericTrait } from './entity.impl';

/**
 * Generic aggregate root trait interface
 */
export interface IAggGenericTrait
  extends Omit<IEntityGenericTrait, 'asCommand'> {
  getDomainEvents: <A extends AggregateRoot>(
    aggregate: A,
  ) => ReadonlyArray<IDomainEvent>;
  clearEvents: <A extends AggregateRoot>(aggregate: A) => A;
  addDomainEvent: <A extends AggregateRoot>(
    event: IDomainEvent,
  ) => (aggregate: A) => A;
  addDomainEvents: <A extends AggregateRoot>(
    events: ReadonlyArray<IDomainEvent>,
  ) => (aggregate: A) => A;
  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A, P>,
    tag: string,
    options?: { autoGenId: boolean },
  ) => AggregateRootTrait<A, N, P>;
  asCommand: <A extends AggregateRoot, I>(
    reducerLogic: (
      input: I,
      props: GetProps<A>,
      aggregate: A,
      correlationId: string,
    ) => Effect.Effect<
      { props: GetProps<A>; domainEvents: IDomainEvent[] },
      CoreException,
      any
    >,
  ) => (input: I) => CommandOnModel<A>;
}

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
    domainEvents: [...aggregate.domainEvents, event],
  }),

  addDomainEvents: (events) => (aggregate) => ({
    ...aggregate,
    domainEvents: [...aggregate.domainEvents, ...events],
  }),
  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A, P>,
    tag: string,
    options?: { autoGenId: boolean },
  ) => {
    return EntityGenericTrait.createEntityTrait<A, N, P>(
      propsParser,
      tag,
      options,
    );
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
      any
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

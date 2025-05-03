import { ReadonlyRecord } from 'effect/Record';
import { Effect, Option, pipe } from 'effect';
import { ParseResult } from './validation';
import {
  CommandOnModel,
  Entity,
  EntityTrait,
  IEntityGenericTrait,
} from './entity.base';
import { DomainEvent } from '../event/domain-event.base';
import { EntityGenericTrait } from './entity.impl';
import { IDomainEvent } from './domain-event.interface';
import { GetProps } from 'src/typeclasses';
import { BaseException } from '@logic/exception.base';

/**
 * AggregateRoot type that extends Entity
 */
export type AggregateRoot<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<
    string,
    unknown
  >,
> = Entity<Props> & {
  readonly domainEvents: ReadonlyArray<IDomainEvent>;
};

/**
 * Input type for aggregate root creation
 */
export type WithAggregateMetaInput<OriginInput> = OriginInput & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Option.Option<Date>;
  domainEvents?: ReadonlyArray<IDomainEvent>;
};

/**
 * Parser for aggregate root properties
 */
export type AggregatePropsParser<
  A extends AggregateRoot = AggregateRoot,
  I = unknown,
> = (raw: I) => ParseResult<A['props']>;

/**
 * Interface for aggregate root trait
 */
export interface AggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown,
> extends EntityTrait<A, NewParams, ParseParams> {}

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
    ) => Effect.Effect<
      { props: GetProps<A>; domainEvents: IDomainEvent[] },
      BaseException,
      never
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
    ) => Effect.Effect<
      { props: GetProps<A>; domainEvents: IDomainEvent[] },
      BaseException,
      never
    >,
  ) => {
    return (input: I): CommandOnModel<A> => {
      return (aggregate: A) => {
        return pipe(
          reducerLogic(input, AggGenericTrait.unpack(aggregate), aggregate),
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

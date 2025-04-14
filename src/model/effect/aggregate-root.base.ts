import { ReadonlyRecord } from 'effect/Record';
import { Option } from 'effect';
import { ParseResult } from './validation';
import { Entity, EntityTrait, IEntityGenericTrait } from './entity.base';
import { DomainEvent } from '../event/domain-event.base';
import { EntityGenericTrait } from './entity.impl';

/**
 * AggregateRoot type that extends Entity
 */
export type AggregateRoot<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<
    string,
    unknown
  >,
> = Entity<Props> & {
  readonly domainEvents: ReadonlyArray<DomainEvent>;
};

/**
 * Input type for aggregate root creation
 */
export type WithAggregateMetaInput<OriginInput> = OriginInput & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Option.Option<Date>;
  domainEvents?: ReadonlyArray<DomainEvent>;
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
export interface IAggGenericTrait extends IEntityGenericTrait {
  getDomainEvents: <A extends AggregateRoot>(
    aggregate: A,
  ) => ReadonlyArray<DomainEvent>;
  clearEvents: <A extends AggregateRoot>(aggregate: A) => A;
  addDomainEvent: <A extends AggregateRoot>(
    event: DomainEvent,
  ) => (aggregate: A) => A;
  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A, P>,
    tag: string,
    options?: { autoGenId: boolean },
  ) => AggregateRootTrait<A, N, P>;
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
};

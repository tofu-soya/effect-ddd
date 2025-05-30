import { ReadonlyRecord } from 'effect/Record';
import { Effect, Option } from 'effect';
import {
  CommandOnModel,
  Entity,
  IEntityGenericTrait,
} from './entity.interface';
import { IDomainEvent } from './domain-event.interface';
import { ParseResult } from './validation.interface';
import { CoreException, EntityTrait } from '@model/effect';
import { GetProps } from 'src/typeclasses';

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
      correlationId: string,
    ) => Effect.Effect<
      { props: GetProps<A>; domainEvents: IDomainEvent[] },
      CoreException,
      any
    >,
  ) => (input: I) => CommandOnModel<A>;
}

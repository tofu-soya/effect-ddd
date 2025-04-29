import { Effect, pipe } from 'effect';
import { RRecord } from '@logic/fp';
import {
  EntityGenericTrait,
  EntityTrait,
  IEntityGenericTrait,
  getEntityGenericTraitForType,
} from './entity.base';
import { Entity, EntityLiken, WithEntityMetaInput } from './entity.base.type';
import { BaseDMTraitFactoryConfig, getBaseDMTrait } from './domain-model.base';
import { IDomainEvent } from './effect/domain-event.interface';
import { BaseException } from '@logic/exception.base';
import { GetProps } from 'src/typeclasses';

export type AggregateRoot<
  T extends RRecord.ReadonlyRecord<string, any> = RRecord.ReadonlyRecord<
    string,
    any
  >,
> = Entity<T> & {
  domainEvents: IDomainEvent[];
};

export interface AggregateTrait<
  E extends AggregateRoot,
  NewParams = any,
  ParseParams = AggregateLiken<E>,
> extends EntityTrait<E, NewParams, ParseParams> {}

export type AggregateLiken<A, OV = unknown> = EntityLiken<A, OV>;

interface IAggGenericTrait extends IEntityGenericTrait {
  getDomainEvents: <A extends AggregateRoot>(aggregate: A) => IDomainEvent[];
  clearEvents: <A extends AggregateRoot>(aggregate: A) => A;
  addDomainEvent: <A extends AggregateRoot>(
    event: IDomainEvent,
  ) => (aggregate: A) => A;
}

export const AggGenericTrait: IAggGenericTrait = {
  ...EntityGenericTrait,
  getDomainEvents: <A extends AggregateRoot>(aggregate: A) =>
    aggregate.domainEvents,
  clearEvents: <A extends AggregateRoot>(aggregate: A) => ({
    ...aggregate,
    domainEvents: [],
  }),
  addDomainEvent:
    <A extends AggregateRoot>(event: IDomainEvent) =>
    (aggregate: A) => ({
      ...aggregate,
      domainEvents: [...aggregate.domainEvents, event],
    }),
};

export const getAggGenericTraitForType = <E extends AggregateRoot>() =>
  getEntityGenericTraitForType<E>();

export const getBaseAGTrait = <
  A extends AggregateRoot,
  NewParams = AggregateLiken<A>,
  ParsingParams = WithEntityMetaInput<NewParams>,
>(
  config: BaseDMTraitFactoryConfig<A, NewParams, ParsingParams>,
): AggregateTrait<A, NewParams, ParsingParams> =>
  getBaseDMTrait<A, NewParams, ParsingParams>(AggGenericTrait.factory)(config);

/**
 * Command on model type for aggregate operations
 */
export type CommandOnModel<A extends AggregateRoot> = (
  aggregate: A,
) => Effect.Effect<A, BaseException, never>;

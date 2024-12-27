import { RRecord } from '@logic/fp';
import {
  EntityGenericTrait,
  EntityTrait,
  IEntityGenericTrait,
  getEntityGenericTraitForType,
} from './entity.base';
import { Entity, EntityLiken, WithEntityMetaInput } from './entity.base.type';
import { BaseDMTraitFactoryConfig, getBaseDMTrait } from './domain-model.base';

export type AggregateRoot<
  T extends RRecord.ReadonlyRecord<string, any> = RRecord.ReadonlyRecord<
    string,
    any
  >,
> = Entity<T>;

export interface AggregateTrait<
  E extends AggregateRoot,
  NewParams = any,
  ParseParams = AggregateLiken<E>,
> extends EntityTrait<E, NewParams, ParseParams> {}

export type AggregateLiken<A, OV = unknown> = EntityLiken<A, OV>;

interface IAggGenericTrait extends IEntityGenericTrait {}

export const AggGenericTrait: IAggGenericTrait = {
  ...EntityGenericTrait,
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

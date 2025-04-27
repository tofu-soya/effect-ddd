import { ReadonlyRecord } from 'effect/Record';
import { DomainModel, DomainModelTrait } from './domain-model.base';

export interface ValueObject<
  T extends Record<string, any> = ReadonlyRecord<string, any>,
> extends DomainModel<Readonly<T>> {}

export interface ValueObjectTrait<
  VO extends ValueObject,
  NewParam = unknown,
  ParseParam = unknown,
> extends DomainModelTrait<VO, NewParam, ParseParam> {}

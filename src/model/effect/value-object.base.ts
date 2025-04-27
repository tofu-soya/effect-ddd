import { ReadonlyRecord } from 'effect/Record';
import { DomainModel, DomainModelTrait } from './domain-model.base';
import { GetProps } from 'src/typeclasses';
import { ParseResult } from './validation';

export interface ValueObject<
  T extends Record<string, any> = ReadonlyRecord<string, any>,
> extends DomainModel<Readonly<T>> {}

export interface ValueObjectTrait<
  VO extends ValueObject,
  NewParam = unknown,
  ParseParam = unknown,
> extends DomainModelTrait<VO, NewParam, ParseParam> {}

/**
 * Generic trait for value objects
 */
export interface IValueObjectGenericTrait {
  /**
   * Get the tag of a value object
   */
  getTag: (valueObject: ValueObject) => string;

  /**
   * Unpack the props of a value object
   */
  unpack: <VO extends ValueObject>(valueObject: VO) => GetProps<VO>;

  /**
   * Check if two value objects are equal
   */
  isEqual: <VO extends ValueObject>(vo1: VO, vo2: VO) => boolean;

  /**
   * Create a value object trait
   */
  createValueObjectTrait: <VO extends ValueObject, N = unknown, P = unknown>(
    propsParser: (raw: P) => ParseResult<VO['props']>,
    tag: string,
  ) => ValueObjectTrait<VO, N, P>;
}

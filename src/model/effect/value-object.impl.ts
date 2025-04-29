import { Effect, pipe } from 'effect';
import {
  ValueObject,
  ValueObjectTrait,
  IValueObjectGenericTrait,
} from './value-object.base';
import { GetProps } from 'src/typeclasses';
import { ParseResult } from './validation';

/**
 * Implementation of the generic value object trait
 */
export const ValueObjectGenericTrait: IValueObjectGenericTrait = {
  getTag: (valueObject) => valueObject._tag,

  unpack: <VO extends ValueObject>(valueObject: VO): GetProps<VO> =>
    valueObject.props as GetProps<VO>,

  isEqual: <VO extends ValueObject>(vo1: VO, vo2: VO): boolean =>
    vo1._tag === vo2._tag && 
    JSON.stringify(vo1.props) === JSON.stringify(vo2.props),

  createValueObjectTrait: <VO extends ValueObject, N = unknown, P = unknown>(
    propsParser: (raw: P) => ParseResult<VO['props']>,
    tag: string,
  ): ValueObjectTrait<VO, N, P> => {
    const parse = (input: P): ParseResult<VO> => {
      return pipe(
        Effect.succeed(input),
        Effect.flatMap((data) => {
          return pipe(
            propsParser(data),
            Effect.map(
              (props) =>
                ({
                  _tag: tag,
                  props,
                }) as VO,
            ),
          );
        }),
      );
    };

    return {
      parse,
      new: (params: N) => parse(params as unknown as P),
    };
  },
};

/**
 * Helper function to create a value object trait
 */
export const createValueObjectTrait = <VO extends ValueObject, N = unknown, P = unknown>(
  propsParser: (raw: P) => ParseResult<VO['props']>,
  tag: string,
): ValueObjectTrait<VO, N, P> => {
  return ValueObjectGenericTrait.createValueObjectTrait(propsParser, tag);
};

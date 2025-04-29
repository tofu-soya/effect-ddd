import { Brand } from '@type_util/index';
import { ValidationTrait } from '../invariant-validation';
import { P, match } from 'ts-pattern';
import { Either, pipe } from '@logic/fp';
import { BaseException, BaseExceptionTrait } from '@logic/exception.base';
import validator from 'validator';
import { PrimitiveVOTrait } from '@model/value-object.base';

export type PositiveNumber = Brand<number, 'PositiveNumber'>;

interface IPositiveNumberTrait extends PrimitiveVOTrait<PositiveNumber> {}

const isPositiveNumber = (v: number): v is PositiveNumber => v > 0;

export const parsePositiveNumber = (v: unknown) => {
  const error = BaseExceptionTrait.construct(
    'Must be positive number',
    'MUST_BE_POSITIVE_NUMBER',
  );
  return match(v)
    .with(P.number, (vn: number) =>
      pipe(
        vn,
        Either.fromPredicate(isPositiveNumber, () => error),
      ),
    )
    .with(P.string, (vstr: string) =>
      pipe(
        vstr,
        Either.fromPredicate(
          (v) => validator.isInt(v) && isPositiveNumber(parseInt(v)),
          () => error,
        ),
        Either.map((v) => parseInt(v) as PositiveNumber),
      ),
    )
    .otherwise(() =>
      ValidationTrait.left<PositiveNumber, BaseException>(error),
    );
};

export const PositiveNumberTrait: IPositiveNumberTrait = {
  parse: parsePositiveNumber,
  new: parsePositiveNumber,
};

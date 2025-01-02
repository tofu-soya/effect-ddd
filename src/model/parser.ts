import { Option, Either, S, Arr as A, Record, Apply, RRecord } from '@logic/fp';
import {
  Parser,
  ParsingInput,
  StructValidationErr,
  Validation,
  ValidationErr,
  ValidationErrByKey,
  ValidationTrait,
  ValueOfValidation,
  getErrorFromErrByKey,
  toValidationErr,
} from './invariant-validation';
import { apply, pipe } from 'fp-ts/lib/function';
import { Ord } from 'fp-ts/lib/Ord';
import { Semigroup } from 'fp-ts/lib/Semigroup';
import { randomUUID } from 'crypto';
import { P, match } from 'ts-pattern';
import { isObject } from 'util';
import { Magma } from 'fp-ts/lib/Magma';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';
import { ifElse } from 'ramda';
import { Ord as OrdString } from 'fp-ts/lib/string';

const isRecordOfException = (input: any) =>
  isObject(input) && !input.tag && !input._tag;

export const optionizeParser =
  <T, I, E extends ValidationErr>(parser: Parser<T, I, E>) =>
  (optionV: Option.Option<I>) => {
    return pipe(
      optionV,
      Option.map((v) => parser(v)),
      Option.sequence(Either.Applicative),
    );
  };

const StrIntOrder: Ord<string> = {
  equals: S.Eq.equals,
  compare: (first, second) => {
    const fI = parseInt(first);
    const fS = parseInt(second);
    return fI < fS ? -1 : fI > fS ? 1 : 0;
  },
};

export const structSummarizerParsing = <T>(struct: ParsingInput<T>) => {
  const mapLeftItemToLeftWithKeyItem = Record.mapWithIndex(
    // { a: Left<e> } --> { a: Left<[a, e]> }
    (k: string, a: Validation<any>) =>
      pipe(a, toValidationErr(Option.some(k))) as Either.Either<
        ValidationErrByKey,
        ValueOfValidation<typeof a>
      >,
  );
  const structValidate = (
    a: ReadonlyRecord<string, Either.Either<unknown, ValidationErrByKey>>,
  ) => {
    return ifElse(
      (
        a: RRecord.ReadonlyRecord<
          string,
          Either.Either<any, ValidationErrByKey>
        >,
      ) => RRecord.size(a) === 0,
      () => Either.right({}) as Either.Either<any, ValidationErrByKey>,
      (a) => {
        const mutualKey = randomUUID();
        const result = Apply.sequenceS(Either.Applicative)(a);
        return pipe(
          result,
          Either.map(
            Record.reduce(OrdString)(
              [Option.some(mutualKey), {}] as ValidationErrByKey,
              (a, v) => {
                /* [[some(key_a), error], [none, error], [some(key_c), error], [some(mutual_key), concat_err]]
                 *  => [[some(key_a), error], [none, error], [none, error], [some(mutual_key), { ...concat_err, key_c: error }]]
                 *  => [[some(key_a), error], [none, error], [some(mutual_key), { ...concat_err, key_c: error, unknown: [error]}]]
                 *  => [[some(key_a), error], [some(mutual_key), { ...concat_err, key_c: error, unknown: [error, error]}]]
                 *  => result: [some(mutual_key), { ...concat_err, key_c: error, unknown: [error, error], key_a: error }]
                 * */

                const getStructErr = (err: ValidationErrByKey) =>
                  /* --- pair to record repr ---
                   * [none, error] => { unknown: error }
                   * [some(key), error] => { key: error }
                   * [some(mutual_key), error_not_obj] => { abnormal: [error_not_obj] }
                   * [some(mutual_key), error_obj] => error_obj (for continue to join with other normal { key: error })
                   * */

                  {
                    return pipe(
                      err[0],
                      Option.matchW(
                        () => ({ unknown: [err[1]] }),
                        (keyA: string) =>
                          match([keyA, err[1]])
                            .with(
                              [mutualKey, P.when(isRecordOfException)],
                              () => err[1] as StructValidationErr,
                            )
                            .with(
                              [mutualKey, P.not(P.when(isRecordOfException))],
                              () => ({
                                abnormal: [err[1]],
                              }),
                            )
                            .otherwise(() => ({ [keyA]: err[1] })),
                      ),
                    );
                  };
                const m: Magma<unknown> = {
                  // for join errors with the same key in struct error
                  concat: (a, b) => {
                    const isJoinOfArray = Array.isArray(a) && Array.isArray(b);
                    return isJoinOfArray ? [...a, ...b] : b;
                  },
                };
                return [
                  Option.some(mutualKey),
                  pipe(
                    Record.union,
                    apply(m),
                    apply(getStructErr(a)),
                    apply(getStructErr(v)),
                  ) as StructValidationErr,
                ] as ValidationErrByKey;
              },
            ),
          ),
        );
      },
    )(a);
  };
  return pipe(struct, mapLeftItemToLeftWithKeyItem, (structuredResult) =>
    pipe(
      structuredResult,
      (a) => {
        return Record.size(a) === 0
          ? (Either.right(a) as Either.Either<
              ValidationErrByKey,
              { [x: string]: any }
            >)
          : Apply.sequenceS(Either.Applicative)(a);
      },
      Either.fold(
        () =>
          pipe(
            structuredResult,
            Record.filter((s) => Either.isLeft(s)),
            Record.map((s) =>
              pipe(
                s,
                Either.alt(() =>
                  Either.right((s as Either.Left<ValidationErrByKey>).left),
                ),
              ),
            ),
            // (result) => {
            //   console.log('recordWithKeyValidation ', result);
            //   return result;
            // },
            structValidate,
            // (result) => {
            //   console.log('structValidate', result);
            //   return result;
            // },
            Either.chain(Either.left),
            Either.mapLeft(getErrorFromErrByKey),
            // (result) => {
            //   console.log('getErrorFromErrByKey', result);
            //   return result;
            // },
            ValidationTrait.fromEitherWithCasting<T>,
            // (result) => {
            //   console.log('fromEitherWithCasting', result);
            //   return result;
            // },
          ),
        (result) => ValidationTrait.right(result as T),
      ),
    ),
  );
};

export const arrayParser =
  <T, I>(itemParser: Parser<T, I>) =>
  (a: I[]) => {
    return pipe(
      a,
      A.reduceWithIndex({}, (i, acc, cur) => ({
        ...acc,
        [i]: itemParser(cur),
      })),
      structSummarizerParsing<Record<number, T>>,
      Either.map(
        Record.reduce(StrIntOrder)([], (acc: T[], cur) => [...acc, cur]),
      ),
    );
  };

export const identityParser = <A>(value: unknown) => Either.of(value as A);

import * as TaskEither from 'fp-ts/TaskEither';
import * as Either from 'fp-ts/Either';
export * as rd from 'ramda';
import { pipe, identity } from 'fp-ts/lib/function';
import { Effect, Option } from 'effect';
import { BaseException } from '@model/exception';

export const absordTE = <T extends TaskEither.TaskEither<any, any>>(te: T) =>
  pipe(
    te,
    TaskEither.map(() => {}),
  );

export const unsafeUnwrapEither = <E, R>(t: Either.Either<E, R>) => {
  return pipe(
    t,
    Either.match((error) => {
      throw error;
    }, identity),
  );
};

export const tapPrintEither =
  <T>(formater: (result: T) => string = (result) => `${result}`) =>
  (printer: (content: string) => void = console.log) =>
  (result: T) => {
    printer(formater(result));
    return Either.right(result);
  };

export const checkIfNotEmpty =
  <OV, E extends BaseException>(exception: E) =>
  (oV: Option.Option<OV>): Effect.Effect<OV, E> =>
    Option.match({
      onSome: Effect.succeed,
      onNone: () => Effect.fail(exception) as Effect.Effect<OV, E>,
    })(oV);

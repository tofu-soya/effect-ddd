import { BaseException, BaseExceptionTrait } from '@logic/exception.base';
import { Arr, Either, NEA, Option, Record, pipe } from '@logic/fp';
import { Errors as IOErrors, Validation as IOValidation } from 'io-ts';
import { P, match } from 'ts-pattern';

type NormalValidationErr = BaseException | NEA.NonEmptyArray<BaseException>;
export type StructValidationErr = Record<string, NormalValidationErr>;

export type ValidationErr = NormalValidationErr | StructValidationErr;

export type ValidationErrByKey = [Option.Option<string>, ValidationErr];

export const getErrorFromErrByKey = (vEBK: ValidationErrByKey) => vEBK[1];

export type ParsingInput<T> = {
  [K in keyof T]: Validation<T[K]>;
};

export type Validation<
  A,
  Err extends ValidationErr = ValidationErr,
> = Either.Either<Err, A>;

export const ValidationErrTrait = {
  fromIOErrors: (ioErrors: IOErrors) =>
    pipe(
      ioErrors,
      Arr.map((error) =>
        BaseExceptionTrait.construct(
          error.message || 'unknown error',
          `IO_ERROR_${error.value}`,
        ),
      ),
    ),
  match:
    <A, B, C>(
      onSingle: (err: BaseException) => A,
      onArray: (errs: NEA.NonEmptyArray<BaseException>) => B,
      onErrDict: (errDict: StructValidationErr) => C,
    ) =>
    (validationErr: ValidationErr) =>
      match(validationErr)
        .with(P.when(BaseExceptionTrait.isInstance), (be) => onSingle(be))
        .with(P.when(Array.isArray), (bes: NEA.NonEmptyArray<BaseException>) =>
          onArray(bes),
        )
        .otherwise((br) => onErrDict(br)),
  print:
    (atomPrint: (be: BaseException) => string = BaseExceptionTrait.print) =>
    (validationErr: ValidationErr): string =>
      ValidationErrTrait.match(
        atomPrint,
        (errs) => JSON.stringify(errs.map(atomPrint)),
        (errDict) =>
          JSON.stringify(
            Record.map(ValidationErrTrait.print(atomPrint))(errDict),
          ),
      )(validationErr),
  sumUp: (code: string) => (err: ValidationErr) =>
    BaseExceptionTrait.construct(ValidationErrTrait.print()(err), code),
};

export const checkCondition =
  <A>(params: { predicate: (a: A) => boolean; exception: ValidationErr }) =>
  (va: Validation<A>) =>
    pipe(
      va,
      Either.flatMap(
        Either.fromPredicate(params.predicate, () => params.exception),
      ),
    );
export const ValidationTrait = {
  left: <A, E extends ValidationErr = ValidationErr>(error: E) =>
    Either.left(error) as Validation<A, E>,
  right: <A, E extends ValidationErr = ValidationErr>(a: A) =>
    Either.right(a) as Validation<A, E>,
  fromIOValidation: <A>(ioValidation: IOValidation<A>) =>
    pipe(
      ioValidation,
      Either.match(
        (e) =>
          ValidationTrait.left<A>(
            ValidationErrTrait.fromIOErrors(e) as ValidationErr,
          ),
        (v) => ValidationTrait.right<A, ValidationErr>(v),
      ),
    ),
  fromEither: <A>(either: Either.Either<ValidationErr, A>) =>
    either as Validation<A>,

  fromEitherWithCasting: <A>(either: Either.Either<ValidationErr, any>) =>
    either as Validation<A>,

  fromPredicate:
    <T, I = T, E extends ValidationErr = ValidationErr>(
      predicate: (v: I) => boolean,
      onFalse: () => E,
    ) =>
    (value: I) =>
      predicate(value)
        ? ValidationTrait.right<T, E>(value as unknown as T)
        : ValidationTrait.left<T, E>(onFalse()),
  checkCondition,
};

export type ValueOfValidation<B> = B extends Validation<infer A> ? A : any;
export type ValidationWithKey<A> = Either.Either<ValidationErrByKey, A>;

export const toValidationErr = (key: Option.Option<string>) =>
  Either.mapLeft((e: ValidationErr) => [key, e] as ValidationErrByKey);

export const mapErrorWithKey =
  (key: string) =>
  <E, T>(e: Either.Either<E, T>) =>
    pipe(
      e,
      Either.mapLeft((e) => ({ [key]: e }) as StructValidationErr),
    );

export type Parser<A, I = any, E extends ValidationErr = ValidationErr> = (
  value: I,
) => Either.Either<E, A>;

export const ParserTrait = {
  fromPredicate: <T, I = unknown>(config: {
    exceptionMsg: string;
    exceptionCode: string;
    predicate: (v: I) => boolean;
  }) =>
    ValidationTrait.fromPredicate<T, I>(config.predicate, () =>
      BaseExceptionTrait.construct(config.exceptionMsg, config.exceptionCode),
    ),
};

export type StructValidation<A> = Either.Either<
  Record<string, NEA.NonEmptyArray<BaseException>>,
  A
>;

type Prim = string | number | boolean | Date;

type PrimLiken<T extends Prim> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends Date
        ? Date
        : unknown;

export type Liken<T> = T extends {
  likenType: infer U;
}
  ? U
  : T extends Prim
    ? PrimLiken<T>
    : T extends Record<string | number | symbol, unknown> | Array<unknown>
      ? {
          [K in keyof T]: Liken<T[K]>;
        }
      : T extends Option.Option<infer U>
        ? Option.Option<Liken<U>>
        : unknown;

export type CustomLiken<T, L> = T & {
  likenType: L;
};

import * as Optics from '@fp-ts/optic';
import * as Eq from 'fp-ts/Eq';
import * as S from 'fp-ts/string';
import * as Record from 'fp-ts/Record';
import * as Apply from 'fp-ts/Apply';
import * as O from 'fp-ts/Option';
import * as Reader from 'fp-ts/Reader';
import * as TaskEither from 'fp-ts/TaskEither';
import * as Task from 'fp-ts/Task';
import * as Either from 'fp-ts/Either';
import * as IO from 'fp-ts/IO';
import * as State from 'fp-ts/State';
import * as IOEither from 'fp-ts/IOEither';
import * as Arr from 'fp-ts/Array';
import * as ReadOnlyArr from 'fp-ts/ReadonlyArray';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as NUM from 'fp-ts/number';
import * as RRecord from 'fp-ts/ReadonlyRecord';
import * as io from 'io-ts';
import * as IoTypes from 'io-ts-types';
export * as rd from 'ramda';
import { pipe, flow, identity } from 'fp-ts/lib/function';
import { ValidationErr } from '@model/invariant-validation';
import { TE } from './fp';

type SumException = ValidationErr;
export type BaseTE<
  T,
  EX extends SumException = SumException,
> = TaskEither.TaskEither<EX, T>;

export type BaseEither<
  T,
  EX extends SumException = SumException,
> = Either.Either<EX, T>;

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

export const unsafeUnwrapTE = <E, R>(te: TE.TaskEither<E, R>) => {
  return pipe(
    te,
    TE.match((e) => {
      throw e;
    }, identity),
  )();
};

export {
  Optics,
  Eq,
  pipe,
  flow,
  O as Option,
  S,
  NUM,
  Reader,
  TaskEither as TE,
  IO,
  IOEither,
  io,
  Task,
  Arr,
  Either,
  NEA,
  State,
  RRecord,
  Record,
  IoTypes,
  Apply,
  ReadOnlyArr,
};

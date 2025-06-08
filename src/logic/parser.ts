// DEPRECATE

// import { Either, NEA, pipe, Option } from './fp';
// import { isArray } from 'util';
// import { apply } from 'fp-ts/lib/function';
// import { BaseException, BaseExceptionTrait } from '@model/exception';
// import { ValidationError } from '@nestjs/common';
//
// export interface BasicAssertParam {
//   message: string;
//   exception: Option.Option<BaseException>;
//   loc: string[];
//   code: Option.Option<string>;
//   isWithKey: boolean;
//   key: string;
// }
//
// export function constructException(
//   aMessage: string,
//   exception: Option.Option<BaseException> = Option.none,
//   loc: string[] = [],
//   code: Option.Option<string> = Option.none,
// ) {
//   return NEA.of(
//     pipe(
//       Option.getOrElse<BaseException>,
//       apply(() =>
//         BaseExceptionTrait.construct(
//           aMessage,
//           pipe(
//             code,
//             Option.getOrElse(() => 'NOT_WORK'),
//           ),
//           loc.join(','),
//         ),
//       ),
//       apply(exception),
//     ),
//   );
// }
// export function assertArgumentNotEmpty({
//   aString,
//   message,
//   exception,
//   loc,
//   code,
// }: { aString: string } & BasicAssertParam): BaseException {
//   const isEmpty = (v: string) => v == undefined || v.length === 0;
//
//   return pipe(
//     aString,
//     Either.fromPredicate(isEmpty, () =>
//       constructException(message, exception, loc, code),
//     ),
//   );
// }
//
// export function assertArgumentNotNull({
//   aValue,
//   message,
//   exception,
//   loc,
//   code,
// }: { aValue: any } & BasicAssertParam): Validation<string> {
//   const isNull = (v: any) => v == undefined;
//   return pipe(
//     aValue,
//     Either.fromPredicate(isNull, () =>
//       constructException(message, exception, loc, code),
//     ),
//   );
// }
//
// export function assertStateTrue({
//   aBoolean,
//   message: aMessage,
//   exception,
//   loc,
//   code,
// }: { aBoolean: boolean } & BasicAssertParam): Validation<boolean> {
//   return pipe(
//     aBoolean,
//     Either.fromPredicate(
//       (v) => v,
//       () => constructException(aMessage, exception, loc, code),
//     ),
//   );
// }
//
// export function assertStateFalse({
//   aBoolean,
//   message: aMessage,
//   exception,
//   loc,
//   code,
// }: { aBoolean: boolean } & BasicAssertParam): Validation<boolean> {
//   return pipe(
//     aBoolean,
//     Either.fromPredicate(
//       (v) => !v,
//       () => constructException(aMessage, exception, loc, code),
//     ),
//   );
// }
//
// export function assertLargerThanOrEqual({
//   aNumber,
//   threshold,
//   allowEqual = true,
//   message: aMessage,
//   exception,
//   loc,
//   code,
// }: {
//   aNumber: number;
//   threshold: number;
//   allowEqual?: boolean;
// } & BasicAssertParam): Validation<number> {
//   const isNot = (v: number) =>
//     (!allowEqual && v <= threshold) || (allowEqual && v < threshold);
//   return pipe(
//     aNumber,
//     Either.fromPredicate(
//       (v: number) => !isNot(v),
//       () => constructException(aMessage, exception, loc, code),
//     ),
//   );
// }
//
// export const shouldBeArray =
//   <A>({ code, message }: { code: string; message: string }) =>
//   (v: unknown): Validation<A[], BaseException> =>
//     pipe(
//       v,
//       Either.fromPredicate(isArray, () =>
//         BaseExceptionTrait.construct(message, code),
//       ),
//       Either.map((a) => a as A[]),
//     );

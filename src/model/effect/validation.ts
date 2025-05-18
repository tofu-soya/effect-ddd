import { Effect, ParseResult } from 'effect';
import { ValidationException } from './validation.exception';

export type ParseResult<R, C = unknown> = Effect.Effect<
  R,
  ParseResult.ParseError | ValidationException,
  C
>;

export type Parser<A, I = any, C = any> = (value: I) => ParseResult<A, C>;

import { Effect, ParseResult } from 'effect';
import { BaseException, ValidationException } from './exception';

export type ParseResult<R, C = unknown> = Effect.Effect<
  R,
  ParseResult.ParseError | ValidationException,
  C
>;

export type Parser<A, I = any, C = any> = (value: I) => ParseResult<A, C>;

export type CoreException = ParseResult.ParseError | BaseException;

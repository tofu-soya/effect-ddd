import { Effect, ParseResult } from 'effect';

export type ParseResult<R, C = unknown> = Effect.Effect<
  R,
  ParseResult.ParseError,
  C
>;

export type Parser<A, I = any, C = unknown> = (value: I) => ParseResult<A, C>;

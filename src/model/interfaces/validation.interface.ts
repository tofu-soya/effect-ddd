import { Effect, ParseResult as EffectParseResult } from 'effect';
import { BaseException, ValidationException } from '../exception';

/**
 * Result type for parsing operations
 */
export type ParseResult<R, C = unknown> = Effect.Effect<
  R,
  EffectParseResult.ParseError | ValidationException,
  C
>;

/**
 * Parser function type for transforming input to domain objects
 */
export type Parser<A, I = any, C = any> = (value: I) => ParseResult<A, C>;

/**
 * Union type of all possible core exceptions
 */
export type CoreException = EffectParseResult.ParseError | BaseException;

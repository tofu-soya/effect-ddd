import { ParseError } from 'effect/ParseResult';
import { CommonException } from './base';
import { NotFoundException } from './not-found';
import { OperationException } from './operation';
import { ValidationException } from './validation';

export * from './base';
export * from './validation';
export * from './not-found';
export * from './operation';

export type BaseException =
  | CommonException
  | OperationException
  | ValidationException
  | NotFoundException
  | ParseError;

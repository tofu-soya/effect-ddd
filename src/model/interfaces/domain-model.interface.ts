import { ReadonlyRecord } from 'effect/Record';
import * as Option from 'effect/Option';
import { ParseResult, Parser } from './validation.interface';
import { GetProps } from 'src/typeclasses';
import { Effect } from 'effect';
import { BaseException } from '../exception';

export interface DomainModel<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<
    string,
    unknown
  >,
> {
  readonly _tag: string;
  readonly props: Props;
  readonly createdAt: Date;
}

export type PropsParser<T extends DomainModel = DomainModel, I = unknown> = (
  raw: I,
) => ParseResult<T['props']>;

export interface IGenericDomainModelTrait {
  getTag: (dV: DomainModel) => string;
  unpack: <T extends DomainModel>(dV: T) => GetProps<T>;
  parsingProps: PropsParser;
  createDomainModelTrait: <
    I extends { createdAt: Date } = { createdAt: Date },
    N = unknown,
    DM extends DomainModel = DomainModel,
  >(
    propsParsing: PropsParser<DM>,
    tag: string,
  ) => DomainModelTrait<DM, N, I>;
  asQuery: <DM extends DomainModel, R>(
    queryLogic: (
      props: GetProps<DM>,
      dm: DM,
    ) => Effect.Effect<R, BaseException, never>,
  ) => QueryOnModel<DM, R>;
  asQueryOpt: <DM extends DomainModel, R>(
    queryLogic: (props: GetProps<DM>, dm: DM) => Option.Option<R>,
  ) => (dm: DM) => Option.Option<R>;
}

export interface DomainModelTrait<
  D extends DomainModel,
  NewParams = any,
  ParserParam = any,
> {
  parse: Parser<D, ParserParam>;
  new: Parser<D, NewParams>;
}

/**
 * Query function type that extracts data from a domain model
 */
export type QueryOnModel<DM extends DomainModel, R> = (
  dm: DM,
) => Effect.Effect<R, BaseException, never>;

/**
 * AsQuery function type
 */
export interface AsQuery {
  <DM extends DomainModel, R>(
    queryLogic: (
      props: GetProps<DM>,
      dm: DM,
    ) => Effect.Effect<R, BaseException, never>,
  ): QueryOnModel<DM, R>;
}

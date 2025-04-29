import { ReadonlyRecord } from 'effect/Record';
import { ParseResult, Parser } from './validation';
import { GetProps } from 'src/typeclasses';
import { Effect } from 'effect';
import { BaseException } from '@logic/exception.base';

export type DomainModel<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<
    string,
    unknown
  >,
> = {
  readonly _tag: string;
  readonly props: Props;
  readonly createdAt: Date;
};

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
}

export interface DomainModelTrait<
  D extends DomainModel,
  NewParams = any,
  ParserParam = any,
> {
  parse: Parser<D, ParserParam>;
  new: Parser<D, NewParams>;
}

export type CommandResult<DM extends DomainModel> = Effect.Effect<
  DM,
  BaseException
>;

export type CommandOnModel<DM extends DomainModel> = (
  dm: DM,
) => CommandResult<DM>;

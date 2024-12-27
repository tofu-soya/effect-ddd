import { Option, pipe } from '@logic/fp';
import { FirstArgumentType } from '@type_util/function';
import { Parser, ParsingInput, Validation } from './invariant-validation';
import { structSummarizerParsing } from './parser';
import {
  DomainModel,
  IGenericDomainModelTrait,
} from './domain-model.base.type';
import { GetProps, KeyProps, queryOnProps } from 'src/typeclasses/has-props';

export type QueryOnModel<D extends DomainModel, R> = (d: D) => R;

export type QueryOptOnModel<D extends DomainModel, R> = QueryOnModel<
  D,
  Option.Option<R>
>;

const simpleQuery =
  <T extends DomainModel, R>(key: KeyProps<T>): QueryOnModel<T, R> =>
  (entity: T) =>
    pipe(entity, queryOnProps<T>(key)) as R;

const simpleQueryOpt =
  <T extends DomainModel, R>(key: KeyProps<T>): QueryOptOnModel<T, R> =>
  (entity: T) =>
    pipe(entity, queryOnProps<T>(key)) as Option.Option<R>;

const getTag = <T extends DomainModel>(m: T) => m._tag;

const unpack = <T extends DomainModel>(m: T): GetProps<T> => m.props;

export const structParsingProps = <ET extends DomainModel>(
  raw: ParsingInput<GetProps<ET>>,
) => structSummarizerParsing<ET['props']>(raw);

export const GenericDomainModelTrait: IGenericDomainModelTrait = {
  simpleQuery: <T extends DomainModel, R>(
    a: FirstArgumentType<typeof simpleQuery<T, R>>,
  ) => simpleQuery<T, R>(a),
  simpleQueryOpt: <T extends DomainModel, R>(
    a: FirstArgumentType<typeof simpleQueryOpt<T, R>>,
  ) => simpleQueryOpt<T, R>(a),
  getTag: getTag,
  unpack: unpack,
  structParsingProps,
};

export interface NewFunc<D, NewParams> {
  (params: NewParams): Validation<D>;
}
export interface DomainModelTrait<
  D extends DomainModel,
  NewParams = any,
  ParserParam = any,
> {
  parse: Parser<D, ParserParam>;
  new: NewFunc<D, NewParams>;
}

export type StdPropsParser<DM extends DomainModel, I = unknown> = Parser<
  GetProps<DM>,
  I
>;

export type IsEqual<T extends DomainModel = DomainModel> = (
  a: T,
  b: T,
) => boolean;

export type DomainParser<I, T extends DomainModel> = (
  props: I,
) => Validation<T>;

export interface ParserFactory<
  DM extends DomainModel,
  I = unknown,
  OP = unknown,
> {
  <T extends DM>(
    parser: Parser<GetProps<T>>,
  ): (tag: string, options?: OP) => DomainParser<I, DM>;
}

export interface BaseDMTraitFactoryConfig<
  DM extends DomainModel,
  I,
  ParserOP = unknown,
> {
  parseProps: (v: I) => Validation<GetProps<DM>>;
  tag: string;
  parserOpt?: ParserOP;
}

export const getBaseDMTrait =
  <DM extends DomainModel, NewParams = unknown, ParsingParams = unknown>(
    factory: ParserFactory<DM, ParsingParams>,
  ) =>
  (config: BaseDMTraitFactoryConfig<DM, NewParams, ParsingParams>) => {
    const { parseProps, tag, parserOpt } = config;
    const parse = factory(parseProps)(tag, parserOpt);
    return {
      parse: parse,
      new: parse as unknown as NewFunc<DM, NewParams>,
    };
  };

import {
  Parser,
  ParsingInput,
  Validation,
  ValidationErr,
  ValidationErrTrait,
} from './invariant-validation';
import { structSummarizerParsing } from './parser';
import { v4 as uuidv4 } from 'uuid';
import {
  Arr,
  Either,
  Eq,
  IoTypes,
  Optics,
  Option,
  RRecord,
  S,
  io,
} from '@logic/fp';
import { apply, pipe } from 'fp-ts/lib/function';
import { DomainEvent } from './event';
import { BehaviorMonadTrait } from './domain-model-behavior.monad';
import { BaseException, BaseExceptionTrait } from '@logic/exception.base';
import { shouldBeArray } from '@logic/parser';
import {
  GenericDomainModelTrait,
  DomainModelTrait,
  IsEqual,
  BaseDMTraitFactoryConfig,
  getBaseDMTrait,
} from './domain-model.base';
import { FirstArgumentType } from '@type_util/function';
import { Identifier, parseId } from 'src/typeclasses/obj-with-id';
import { decodeWithValidationErr } from './io-related-auxiliry-func';
import {
  Entity,
  EntityCommonProps,
  EntityInvariantParser,
  EntityLiken,
  SimpleAdder,
  SimpleRemover,
  SimpleSeter,
  WithEntityMetaInput,
} from './entity.base.type';
import {
  getCreatedAt,
  getUpdatedAt,
  updatedAtLen,
} from 'src/typeclasses/withtime';
import { SimpleQueryOpt } from './domain-model.base.type';
import { CommandOnModel, CommandOnModelTrait } from './entity.command-on-model';
import { Writable } from '@type_util/index';
import { GetProps, KeyProps } from 'src/typeclasses/has-props';

const construct: IEntityGenericTrait['factory'] =
  <T extends Entity>(parser: Parser<T['props']>) =>
  (tag: string, options: { autoGenId: boolean } = { autoGenId: true }) =>
  (props: WithEntityMetaInput<FirstArgumentType<typeof parser>>) => {
    const MetaLikeParser = io.type({
      id: options.autoGenId ? io.union([io.undefined, io.string]) : io.string,
      createdAt: IoTypes.fromNullable(
        IoTypes.option(IoTypes.date),
        Option.none,
      ),
      updatedAt: IoTypes.fromNullable(
        IoTypes.option(IoTypes.date),
        Option.none,
      ),
    });

    const parserMetaLike = (v: unknown) =>
      pipe(
        v,
        decodeWithValidationErr.typeFirst(MetaLikeParser)({
          code: 'FAIL_STRUCTURE',
        }),
        Either.flatMap((metaLike) => {
          return structSummarizerParsing<Omit<EntityCommonProps, '_tag'>>({
            id: parseId(
              options.autoGenId && !metaLike.id ? uuidv4() : metaLike.id || '',
            ),
            createdAt: Either.right(metaLike.createdAt),
            updatedAt: Either.right(metaLike.updatedAt),
          });
        }),
      );
    return pipe(
      Either.Do,
      Either.bind('meta', () => parserMetaLike(props)),
      Either.bind('props', () => parser(props)),
      Either.map(
        ({ props, meta }) =>
          ({
            id: meta.id,
            _tag: tag,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
            props,
          }) as T,
      ),
    );
  };

const idLens = <T extends Entity>() => Optics.id<T>().at('id');

const id = <T extends Entity>(state: T) =>
  pipe(state, Optics.get(idLens<T>())) as Identifier;

const setId =
  <T extends Entity>(id: Identifier) =>
  (state: T) => {
    return pipe(state, Optics.replace(idLens<T>())(id));
  };

const entityPropsLen = <A extends Entity>() =>
  Optics.id<A>().at('props') as Optics.Lens<A, A['props']>;

const createdAt = <T extends Entity>(state: T) => getCreatedAt(state);

const updatedAt = <T extends Entity>(state: T) => getUpdatedAt(state);

const markUpdate = <T extends Entity>(state: T) =>
  pipe(state, Optics.replace(updatedAtLen<T>())(Option.some(new Date())));

export const identityInvariantParser =
  <V>() =>
  (v: V) =>
    Either.of(v);

const setter =
  <T extends Entity, V extends T['props'][keyof T['props']]>(
    attributeName: keyof T['props'],
  ) =>
  ({
    validator,
    events,
  }: {
    validator: EntityInvariantParser<T, true, V>;
    events: DomainEvent[];
  }) =>
  (newV: unknown) =>
  (entity: T) => {
    return pipe(
      newV,
      validator(entity),
      Either.map((v) =>
        pipe(
          Optics.replace(
            entityPropsLen<T>().at(attributeName) as Optics.PolySetter<
              T,
              T,
              T['props'][keyof T['props']]
            >,
          ),
          apply(v),
          apply(entity),
          (updatedEntity: T) => BehaviorMonadTrait.of(updatedEntity, events),
        ),
      ),
      Either.mapLeft(ValidationErrTrait.sumUp('AGG_SETTER_EXCEPTION')),
    );
  };

const adder =
  <T extends Entity, A>(attributeName: keyof T['props']) =>
  ({
    E,
    validator,
    events,
  }: {
    E: Eq.Eq<A>;
    validator: EntityInvariantParser<T, false, A>;
    events: DomainEvent[];
  }) =>
  (newItem: A): CommandOnModel<T> =>
  (entity: T) => {
    const lens = entityPropsLen<T>().at(attributeName);
    const getAttr = Optics.get(lens);
    const validating = () =>
      pipe(
        validator,
        apply(entity),
        apply(newItem),
        Either.mapLeft(ValidationErrTrait.sumUp('REDUCER_ERROR')),
      );
    const mustNotExist = (arr: A[]) =>
      Either.fromPredicate(
        (a: A) => {
          return !Arr.elem(E)(a)(arr);
        },
        () => BaseExceptionTrait.construct('Item existed', 'ITEM_EXISTED'),
      );
    return pipe(
      entity,
      getAttr,
      shouldBeArray<A>({
        message: `property ${attributeName as string} should be an array`,
        code: 'PROP_NOT_ARRAY',
      }),
      Either.bindTo('array'),
      Either.bind('item', validating),
      Either.tap(({ item, array }) =>
        pipe(mustNotExist, apply(array), apply(item)),
      ),
      Either.flatMap(({ item, array }) =>
        Either.tryCatch(
          () =>
            Optics.replace(lens)([
              ...array,
              item,
            ] as T['props'][keyof T['props']])(entity) as T,
          (e: unknown) =>
            BaseExceptionTrait.construct(
              (e as Error).message,
              'ADDER_OPTICS_CHANGE_ERROR',
            ),
        ),
      ),
      Either.map((updatedEntity) =>
        BehaviorMonadTrait.of(updatedEntity, events),
      ),
    );
  };

const remover =
  <T extends Entity, A>(attributeName: keyof T['props']) =>
  ({
    E,
    validator,
    events,
  }: {
    E: Eq.Eq<A>;
    validator: EntityInvariantParser<T, false, A>;
    events: DomainEvent[];
  }) =>
  (removedItem: A) =>
  (entity: T) => {
    const lens = entityPropsLen<T>().at(attributeName);
    const getAttr = Optics.get(lens);
    const validating = () =>
      pipe(
        validator,
        apply(entity),
        apply(removedItem),
        Either.mapLeft(ValidationErrTrait.sumUp('REMOVER_VALIDATING_FAIL')),
      );
    const mustExist =
      (arr: A[]) =>
      (checkedItem: A): Validation<number, BaseException> =>
        pipe(
          arr,
          Arr.findIndex((a) => E.equals(a, checkedItem)),
          Either.fromOption(() =>
            BaseExceptionTrait.construct(
              'Item does not existed',
              'ITEM_NOT_EXISTED',
            ),
          ),
        );
    return pipe(
      entity,
      getAttr,
      shouldBeArray<A>({
        message: `property ${attributeName as string} should be an array`,
        code: 'PROP_NOT_ARRAY',
      }),
      Either.bindTo('array'),
      Either.bind('item', validating),
      Either.bind('idx', ({ item, array }) =>
        pipe(mustExist, apply(array), apply(item)),
      ),
      Either.map(({ array, idx }) =>
        pipe(Arr.deleteAt, apply(idx), apply(array)),
      ),
      Either.flatMap((updatedArray) =>
        Either.tryCatch(
          () =>
            Optics.replace(lens)(updatedArray as T['props'][keyof T['props']])(
              entity,
            ) as T,
          (e: unknown) =>
            BaseExceptionTrait.construct(
              (e as Error).message,
              'ADDER_OPTICS_CHANGE_ERROR',
            ),
        ),
      ),
      Either.map((updatedEntity) =>
        BehaviorMonadTrait.of(updatedEntity, events),
      ),
    );
  };

export const getEntityEq = <T extends Entity>() =>
  Eq.contramap((entity: T) => ({
    tag: entity._tag,
    id: entity.id,
  }))(
    Eq.struct({
      tag: S.Eq,
      id: S.Eq,
    }),
  );

const isEqual = <T extends Entity>(entityLeft: T, entityRight: T) =>
  getEntityEq<T>().equals(entityLeft, entityRight);

const getSnapshot = <T extends RRecord.ReadonlyRecord<string, any>>(
  state: Entity<T>,
) =>
  RRecord.fromRecord({
    createdAt: state.createdAt,
    updatedAt: state.createdAt,
    id: state.id,
    ...state.props,
  });

export const updateProps =
  <ET extends Entity>(props: GetProps<ET>) =>
  (et: ET) =>
    ({ ...et, props }) as ET;

export interface EntityTrait<
  E extends Entity,
  NewParams = any,
  ParseParams = EntityLiken<E>,
> extends DomainModelTrait<
    E,
    NewParams,
    ParseParams extends { id: string }
      ? ParseParams
      : WithEntityMetaInput<ParseParams>
  > {}

export interface IEntityGenericTrait<
  T extends Entity = Entity<RRecord.ReadonlyRecord<string, any>>,
> {
  factory: <TS extends Entity = T>(
    propsParser: Parser<TS['props']>,
  ) => (tag: string) => Parser<TS, FirstArgumentType<typeof propsParser>>;
  id: <TS extends Entity = T>(t: TS) => Identifier;
  setId: <TS extends Entity = T>(id: Identifier) => (domainState: TS) => TS;
  createdAt: <TS extends Entity = T>(
    t: TS,
  ) => ReturnType<SimpleQueryOpt<TS, Date>>;
  updatedAt: <TS extends Entity = T>(
    t: TS,
  ) => ReturnType<SimpleQueryOpt<TS, Date>>;
  markUpdate: <TS extends Entity = T>(state: TS) => TS;
  getSnapshot: <TS extends Entity = T>(
    state: TS,
  ) => RRecord.ReadonlyRecord<string, any>;
  isEqual: IsEqual<Entity>;
  simpleQuery: <TS extends Entity = T, R = any>(
    key: KeyProps<TS>,
  ) => (t: TS) => R;
  simpleQueryOpt: <TS extends Entity = T, R = any>(
    key: KeyProps<TS>,
  ) => (t: TS) => Option.Option<R>;
  remover: <E extends Entity = T, V = any>(
    key: KeyProps<E>,
  ) => (config: {
    E: Eq.Eq<V>;
    validator: EntityInvariantParser<E, false, V>;
    events: DomainEvent[];
  }) => SimpleRemover<E, V>;
  adder: <E extends Entity = T, V = any>(
    key: KeyProps<E>,
  ) => (config: {
    E: Eq.Eq<V>;
    validator: EntityInvariantParser<E, false, V>;
    events: DomainEvent[];
  }) => SimpleAdder<E, V>;
  setter: <E extends Entity = T, V extends T['props'][keyof T['props']] = any>(
    a: KeyProps<T>,
  ) => (config: {
    validator: EntityInvariantParser<E, false, V>;
    events: DomainEvent[];
  }) => SimpleSeter<E, V>;
  propsLen: <E extends Entity = T>() => Optics.Lens<E, E['props']>;
  structParsingProps: <E extends Entity = T>(
    raw: ParsingInput<E['props']>,
  ) => Validation<E['props']>;
  getTag: (dV: Entity) => string;
  unpack: <E extends Entity>(dV: Entity) => GetProps<E>;
  updateProps: <ET extends Entity>(props: GetProps<ET>) => (et: ET) => ET;
}

export const getEntityGenericTraitForType = <E extends Entity>() => ({
  factory: construct<E>,
  id: id<E>,
  setId: setId<E>,
  createdAt: createdAt<E>,
  updatedAt: updatedAt<E>,
  markUpdate: markUpdate<E>,
  getSnapshot: getSnapshot<E>,
  isEqual: isEqual<E>,
  simpleQuery: <R>(key: keyof E['props']) =>
    GenericDomainModelTrait.simpleQuery<E, R>(key),
  simpleQueryOpt: <R>(key: keyof E['props']) =>
    GenericDomainModelTrait.simpleQueryOpt<E, R>(key),
  remover: <V>(a: FirstArgumentType<typeof remover<E, V>>) => remover<E, V>(a),
  adder: <V>(a: FirstArgumentType<typeof adder<E, V>>) => adder<E, V>(a),
  setter: <V extends E['props'][keyof E['props']]>(
    a: FirstArgumentType<typeof setter<E, V>>,
  ) => setter<E, V>(a),
  propsLen: entityPropsLen<E>,
  structParsingProps: GenericDomainModelTrait.structParsingProps<E>,
  getTag: GenericDomainModelTrait.getTag,
  unpack: GenericDomainModelTrait.unpack,
  updateProps: updateProps<E>,
});

export const EntityGenericTrait: IEntityGenericTrait = {
  factory: construct,
  id,
  setId,
  createdAt,
  updatedAt,
  markUpdate,
  getSnapshot,
  isEqual,
  remover,
  adder,
  setter,
  simpleQuery: GenericDomainModelTrait.simpleQuery,
  simpleQueryOpt: GenericDomainModelTrait.simpleQueryOpt,
  propsLen: entityPropsLen,
  structParsingProps: GenericDomainModelTrait.structParsingProps,
  getTag: GenericDomainModelTrait.getTag,
  unpack: GenericDomainModelTrait.unpack,
  updateProps,
};

export const getBaseEntityTrait = <
  E extends Entity,
  I = EntityLiken<E>,
  P = WithEntityMetaInput<I>,
>(
  config: BaseDMTraitFactoryConfig<E, I, P>,
) => getBaseDMTrait<E, I, P>(EntityGenericTrait.factory)(config);

type AsReducerReturn<E extends Entity> = Either.Either<
  BaseException,
  { props: Writable<GetProps<E>> | GetProps<E>; domainEvents: DomainEvent[] }
>;

interface AsReducer {
  <En extends Entity, IFUNC extends (input: any) => CommandOnModel<En>>(
    reducerLogic: (
      input: FirstArgumentType<IFUNC>,
      props: GetProps<En>,
      entity: En,
    ) => AsReducerReturn<En>,
  ): (input: FirstArgumentType<IFUNC>) => CommandOnModel<En>;
}

export const asReducer: AsReducer =
  <En extends Entity, IFUNC extends (input: any) => CommandOnModel<En>>(
    reducerLogic: (
      input: FirstArgumentType<IFUNC>,
      props: GetProps<En>,
      entity: En,
    ) => AsReducerReturn<En>,
  ) =>
  (input: FirstArgumentType<IFUNC>) =>
  (entity: En) => {
    const propsLen = EntityGenericTrait.propsLen<En>();
    const result = reducerLogic(input, Optics.get(propsLen)(entity), entity);
    return pipe(
      result,
      Either.match(
        (exception) => CommandOnModelTrait.fromException<En>(exception),
        (r) =>
          CommandOnModelTrait.fromModel2Events(
            Optics.replace(propsLen)(RRecord.fromRecord(r.props))(entity),
            r.domainEvents,
          ),
      ),
    );
  };

export const AsReducerTrait = {
  right: (v: [Writable<GetProps<Entity>>, DomainEvent[]]) => ({
    _tag: 'success',
    result: v,
  }),
  left: (e: ValidationErr) => ({
    _tag: 'failure',
    result: e,
  }),
  as: asReducer,
};

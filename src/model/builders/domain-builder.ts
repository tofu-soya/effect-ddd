// src/model/builders/enhanced-domain-builder.ts

import { Effect, Schema, pipe, Option, Record } from 'effect';
import {
  ValueObject,
  Entity,
  AggregateRoot,
  ParseResult,
  IDomainEvent,
} from '@model/interfaces';
import {
  AggGenericTrait,
  EntityGenericTrait,
  ValueObjectGenericTrait,
} from '@model/implementations';
import { IdentifierTrait } from 'src/typeclasses';
import { ValidationException } from '@model/exception';
import {
  CommandResult,
  DomainModel,
  Parser,
  WithEntityMetaInput,
} from '@model/interfaces';

// ===== Enhanced Type Definitions =====

/**
 * Query function type for domain models
 */
export type QueryFunction<Props = any, Return = any> = (props: Props) => Return;

/**
 * Query effect function type for async queries
 */
export type QueryEffectFunction<Props = any, Return = any> = (
  props: Props,
) => Effect.Effect<Return, any, any>;

/**
 * Command function type for entities
 */
export type CommandFunction<E extends Entity, Input = any> = (
  input: Input,
) => (entity: E, correlationId?: string) => CommandResult<E>;

/**
 * Event handler function type
 */
export type EventHandlerFunction = (event: IDomainEvent) => void;

/**
 * Extract query method types from a queries record
 */
type QueryMethods<
  Props,
  Q extends Record<string, QueryFunction<Props> | QueryEffectFunction<Props>>,
> = {
  [K in keyof Q]: Q[K] extends QueryFunction<Props, infer R>
    ? () => R
    : Q[K] extends QueryEffectFunction<Props, infer R>
      ? () => Effect.Effect<R, any, any>
      : never;
};

/**
 * Extract command method types from a commands record
 */
type CommandMethods<
  E extends Entity,
  C extends Record<string, CommandFunction<E>>,
> = {
  [K in keyof C]: C[K];
};

// ===== Enhanced Configuration Types =====

interface DomainConfig<
  DM extends DomainModel,
  ParseParam = unknown,
  NewParam = DM['props'],
  Q extends Record<
    string,
    QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
  > = Record<string, never>,
> {
  readonly tag: string;
  readonly schema?: Schema.Schema<unknown>;
  readonly validators: ReadonlyArray<
    (props: DM['props']) => ParseResult<DM['props']>
  >;
  readonly newMethod?: (
    params: NewParam,
    parse: (input: ParseParam) => ParseResult<DM>,
  ) => ParseResult<DM>;
  readonly queries: Q;
}

interface EntityConfig<
  E extends Entity,
  ParseParam = unknown,
  NewParam = E['props'],
  Q extends Record<
    string,
    QueryFunction<E['props']> | QueryEffectFunction<E['props']>
  > = Record<string, never>,
  C extends Record<string, CommandFunction<E>> = Record<string, never>,
> extends DomainConfig<E, ParseParam, NewParam, Q> {
  readonly commands: C;
  readonly newMethod?: (
    params: NewParam,
    parse: (input: WithEntityMetaInput<ParseParam>) => ParseResult<E>,
  ) => ParseResult<E>;
}

interface AggregateConfig<
  A extends AggregateRoot,
  ParseParam = unknown,
  NewParam = A['props'],
  Q extends Record<
    string,
    QueryFunction<A['props']> | QueryEffectFunction<A['props']>
  > = Record<string, never>,
  C extends Record<string, CommandFunction<A>> = Record<string, never>,
  H extends Record<string, EventHandlerFunction> = Record<string, never>,
> extends EntityConfig<A, ParseParam, NewParam, Q, C> {
  readonly eventHandlers: H;
}

// ===== Enhanced Trait Types =====

interface EnhancedValueObjectTrait<
  VO extends ValueObject,
  NewParam = unknown,
  ParseParam = unknown,
  Q extends Record<
    string,
    QueryFunction<VO['props']> | QueryEffectFunction<VO['props']>
  > = Record<string, never>,
> {
  parse: (input: ParseParam) => ParseResult<VO>;
  new: (params: NewParam) => ParseResult<VO>;
}

interface EnhancedEntityTrait<
  E extends Entity,
  NewParam = unknown,
  ParseParam = unknown,
  Q extends Record<
    string,
    QueryFunction<E['props']> | QueryEffectFunction<E['props']>
  > = Record<string, never>,
  C extends Record<string, CommandFunction<E>> = {},
> extends EnhancedValueObjectTrait<E, NewParam, ParseParam, Q> {}

interface EnhancedAggregateRootTrait<
  A extends AggregateRoot,
  NewParam = unknown,
  ParseParam = unknown,
  Q extends Record<
    string,
    QueryFunction<A['props']> | QueryEffectFunction<A['props']>
  > = Record<string, never>,
  C extends Record<string, CommandFunction<A>> = Record<string, never>,
  H extends Record<string, EventHandlerFunction> = Record<string, never>,
> extends EnhancedEntityTrait<A, NewParam, ParseParam, Q, C> {
  eventHandlers: H;
}

// ===== Core Configuration Builders =====

const createDomainConfig = <
  DM extends DomainModel,
  ParseParam = unknown,
  NewParam = DM['props'],
>(
  tag: string,
): DomainConfig<DM, ParseParam, NewParam, Record<string, never>> => ({
  tag,
  schema: undefined,
  validators: [],
  newMethod: undefined,
  queries: {},
});

const createEntityConfig = <
  E extends Entity,
  ParseParam = unknown,
  NewParam = E['props'],
>(
  tag: string,
): EntityConfig<
  E,
  ParseParam,
  NewParam,
  Record<string, never>,
  Record<string, never>
> => ({
  ...createDomainConfig<E, ParseParam, NewParam>(tag),
  newMethod: undefined,
  commands: {},
});

const createAggregateConfig = <
  A extends AggregateRoot,
  ParseParam = unknown,
  NewParam = A['props'],
>(
  tag: string,
): AggregateConfig<
  A,
  ParseParam,
  NewParam,
  Record<string, never>,
  Record<string, never>,
  Record<string, never>
> => ({
  ...createEntityConfig<A, ParseParam, NewParam>(tag),
  eventHandlers: {},
});

// ===== Enhanced Configuration Transformers =====

const withSchema =
  <
    S extends Schema.Schema<any>,
    DM extends DomainModel<Schema.Schema.Type<S>>,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
    >,
  >(
    schema: S,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam, Q>,
  ): DomainConfig<DM, ParseParam, NewParam, Q> => ({
    ...config,
    schema,
  });

const withValidation =
  <
    DM extends DomainModel,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
    >,
  >(
    validator: (props: DM['props']) => ParseResult<DM['props']>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam, Q>,
  ): DomainConfig<DM, ParseParam, NewParam, Q> => ({
    ...config,
    validators: [...config.validators, validator],
  });

const withInvariant =
  <
    DM extends DomainModel,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
    >,
  >(
    predicate: (props: DM['props']) => boolean,
    errorMessage: string,
    errorCode: string = 'INVARIANT_VIOLATION',
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam, Q>,
  ): DomainConfig<DM, ParseParam, NewParam, Q> =>
    withValidation<DM, ParseParam, NewParam, Q>((props) => {
      if (!predicate(props)) {
        return Effect.fail(ValidationException.new(errorCode, errorMessage));
      }
      return Effect.succeed(props);
    })(config);

const withNew =
  <
    DM extends DomainModel,
    ParseParam,
    NewParam,
    NewNewParam,
    Q extends Record<
      string,
      QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
    >,
  >(
    newMethod: (
      params: NewNewParam,
      parse: (input: ParseParam) => ParseResult<DM>,
    ) => ParseResult<DM>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam, Q>,
  ): DomainConfig<DM, ParseParam, NewNewParam, Q> => ({
    ...config,
    newMethod,
  });

const withQuery =
  <
    DM extends DomainModel,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
    >,
    K extends string,
    R,
  >(
    name: K,
    query: QueryFunction<DM['props'], R>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam, Q>,
  ): DomainConfig<
    DM,
    ParseParam,
    NewParam,
    Q & Record<K, QueryFunction<DM['props'], R>>
  > => ({
    ...config,
    queries: {
      ...config.queries,
      [name]: query,
    } as Q & Record<K, QueryFunction<DM['props'], R>>,
  });

const withQueryEffect =
  <
    DM extends DomainModel,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
    >,
    K extends string,
    R,
  >(
    name: K,
    query: QueryEffectFunction<DM['props'], R>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam, Q>,
  ): DomainConfig<
    DM,
    ParseParam,
    NewParam,
    Q & Record<K, QueryEffectFunction<DM['props'], R>>
  > => ({
    ...config,
    queries: {
      ...config.queries,
      [name]: query,
    } as Q & Record<K, QueryEffectFunction<DM['props'], R>>,
  });

const withCommand =
  <
    E extends Entity,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<E['props']> | QueryEffectFunction<E['props']>
    >,
    C extends Record<string, CommandFunction<E>>,
    K extends string,
    I,
  >(
    name: K,
    handler: (
      input: I,
      props: E['props'],
      entity: E,
    ) => Effect.Effect<{ props: E['props'] }, any, never>,
  ) =>
  (
    config: EntityConfig<E, ParseParam, NewParam, Q, C>,
  ): EntityConfig<
    E,
    ParseParam,
    NewParam,
    Q,
    C & Record<K, CommandFunction<E, I>>
  > => ({
    ...config,
    commands: {
      ...config.commands,
      [name]: EntityGenericTrait.asCommand(handler),
    } as C & Record<K, CommandFunction<E, I>>,
  });

const withAggregateCommand =
  <
    A extends AggregateRoot,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<A['props']> | QueryEffectFunction<A['props']>
    >,
    C extends Record<string, CommandFunction<A>>,
    H extends Record<string, EventHandlerFunction>,
    K extends string,
    I,
  >(
    name: K,
    handler: (
      input: I,
      props: A['props'],
      aggregate: A,
      correlationId: string,
    ) => Effect.Effect<
      { props: A['props']; domainEvents: IDomainEvent[] },
      any,
      any
    >,
  ) =>
  (
    config: AggregateConfig<A, ParseParam, NewParam, Q, C, H>,
  ): AggregateConfig<
    A,
    ParseParam,
    NewParam,
    Q,
    C & Record<K, CommandFunction<A, I>>,
    H
  > => ({
    ...config,
    commands: {
      ...config.commands,
      [name]: AggGenericTrait.asCommand(handler),
    } as C & Record<K, CommandFunction<A, I>>,
  });

const withEventHandler =
  <
    A extends AggregateRoot,
    ParseParam,
    NewParam,
    Q extends Record<
      string,
      QueryFunction<A['props']> | QueryEffectFunction<A['props']>
    >,
    C extends Record<string, CommandFunction<A>>,
    H extends Record<string, EventHandlerFunction>,
    K extends string,
  >(
    eventName: K,
    handler: EventHandlerFunction,
  ) =>
  (
    config: AggregateConfig<A, ParseParam, NewParam, Q, C, H>,
  ): AggregateConfig<
    A,
    ParseParam,
    NewParam,
    Q,
    C,
    H & Record<K, EventHandlerFunction>
  > => ({
    ...config,
    eventHandlers: {
      ...config.eventHandlers,
      [eventName]: handler,
    } as H & Record<K, EventHandlerFunction>,
  });

// ===== Props Parser Factory =====

const createPropsParser =
  <DM extends DomainModel, ParseParam = unknown, NewParam = DM['props']>(
    config: DomainConfig<DM, ParseParam, NewParam, any>,
  ) =>
  (raw: ParseParam): ParseResult<DM['props']> => {
    if (!config.schema) {
      throw new Error(`Schema is required for parsing ${config.tag}`);
    }

    return Effect.gen(function* () {
      // First, validate with schema
      const validated = (yield* Schema.decodeUnknown(config.schema!)(
        raw,
      )) as DM['props'];

      // Then run custom validators
      let result = validated;
      for (const validator of config.validators) {
        result = yield* validator(result);
      }

      return result;
    });
  };

// ===== Enhanced Builders =====

function buildValueObject<
  VO extends ValueObject,
  ParseParam,
  NewParam,
  Q extends Record<
    string,
    QueryFunction<VO['props']> | QueryEffectFunction<VO['props']>
  >,
>(
  config: DomainConfig<VO, ParseParam, NewParam, Q>,
): EnhancedValueObjectTrait<VO, NewParam, ParseParam, Q> &
  QueryMethods<VO['props'], Q> {
  const propsParser = createPropsParser(config);

  // Use the existing ValueObjectGenericTrait
  const baseTrait = ValueObjectGenericTrait.createValueObjectTrait<
    VO,
    NewParam,
    ParseParam
  >(propsParser, config.tag);

  // Enhanced new method that provides parse access
  const newMethod = config.newMethod
    ? (params: NewParam) => {
        return config.newMethod!(params, baseTrait.parse);
      }
    : baseTrait.new;

  // Create query methods that bind to the domain object's props
  const queryMethods = {} as QueryMethods<VO['props'], Q>;

  // This will be added to instances, not the trait itself
  Object.keys(config.queries).forEach((key) => {
    const queryFn = config.queries[key];
    // Note: This creates the method signature, actual implementation happens at instance level
    (queryMethods as any)[key] = () => {
      throw new Error(
        `Query method ${key} should be called on an instance, not the trait`,
      );
    };
  });

  return {
    ...baseTrait,
    new: newMethod,
    ...queryMethods,
  };
}

function buildEntity<
  E extends Entity,
  ParseParam,
  NewParam,
  Q extends Record<
    string,
    QueryFunction<E['props']> | QueryEffectFunction<E['props']>
  >,
  C extends Record<string, CommandFunction<E>>,
>(
  config: EntityConfig<E, ParseParam, NewParam, Q, C>,
): EnhancedEntityTrait<E, NewParam, ParseParam, Q, C> &
  QueryMethods<E['props'], Q> &
  CommandMethods<E, C> {
  const propsParser = createPropsParser(
    config as DomainConfig<E, ParseParam, NewParam, Q>,
  );

  // Use the existing EntityGenericTrait
  const baseTrait = EntityGenericTrait.createEntityTrait<
    E,
    NewParam,
    ParseParam
  >(propsParser, config.tag);

  // Enhanced new method that provides parse access
  const newMethod = config.newMethod
    ? (params: NewParam) => {
        return config.newMethod!(params, baseTrait.parse);
      }
    : baseTrait.new;

  // Create query methods
  const queryMethods = {} as QueryMethods<E['props'], Q>;
  Object.keys(config.queries).forEach((key) => {
    (queryMethods as any)[key] = () => {
      throw new Error(
        `Query method ${key} should be called on an instance, not the trait`,
      );
    };
  });

  return {
    ...baseTrait,
    new: newMethod,
    ...queryMethods,
    ...config.commands,
  } as any;
}

function buildAggregateRoot<
  A extends AggregateRoot,
  ParseParam,
  NewParam,
  Q extends Record<
    string,
    QueryFunction<A['props']> | QueryEffectFunction<A['props']>
  >,
  C extends Record<string, CommandFunction<A>>,
  H extends Record<string, EventHandlerFunction>,
>(
  config: AggregateConfig<A, ParseParam, NewParam, Q, C, H>,
): EnhancedAggregateRootTrait<A, NewParam, ParseParam, Q, C, H> &
  QueryMethods<A['props'], Q> &
  CommandMethods<A, C> {
  const propsParser = createPropsParser(
    config as DomainConfig<E, ParseParam, NewParam, Q>,
  );

  // Use the existing AggGenericTrait
  const baseTrait = AggGenericTrait.createAggregateRootTrait<
    A,
    NewParam,
    ParseParam
  >(propsParser, config.tag);

  // Override the new method if provided
  const newMethod = config.newMethod
    ? (params: NewParam) => {
        return config.newMethod!(params, baseTrait.parse);
      }
    : baseTrait.new;

  // Create query methods
  const queryMethods = {} as QueryMethods<A['props'], Q>;
  Object.keys(config.queries).forEach((key) => {
    (queryMethods as any)[key] = () => {
      throw new Error(
        `Query method ${key} should be called on an instance, not the trait`,
      );
    };
  });

  return {
    ...baseTrait,
    new: newMethod,
    ...queryMethods,
    ...config.commands,
    eventHandlers: config.eventHandlers,
  } as any;
}

// ===== Public API =====

export const createValueObject = <
  VO extends ValueObject,
  ParseParam = unknown,
  NewParam = VO['props'],
>(
  tag: string,
) => createDomainConfig<VO, ParseParam, NewParam>(tag);

export const createEntity = <
  E extends Entity,
  ParseParam = unknown,
  NewParam = E['props'],
>(
  tag: string,
) => createEntityConfig<E, ParseParam, NewParam>(tag);

export const createAggregateRoot = <
  A extends AggregateRoot,
  ParseParam = unknown,
  NewParam = A['props'],
>(
  tag: string,
) => createAggregateConfig<A, ParseParam, NewParam>(tag);

export {
  withSchema,
  withValidation,
  withInvariant,
  withNew,
  withQuery,
  withQueryEffect,
  withCommand,
  withAggregateCommand,
  withEventHandler,
  buildValueObject,
  buildEntity,
  buildAggregateRoot,
};

// ===== Enhanced Instance Creation =====

/**
 * Creates domain object instances with query methods properly bound
 */
export const createInstance = <
  DM extends DomainModel,
  Q extends Record<
    string,
    QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
  >,
>(
  domainObject: DM,
  queries: Q,
): DM & QueryMethods<DM['props'], Q> => {
  const instance = { ...domainObject } as DM & QueryMethods<DM['props'], Q>;

  // Bind query methods to the instance
  Object.entries(queries).forEach(([key, queryFn]) => {
    (instance as any)[key] = () => queryFn(domainObject.props);
  });

  return instance;
};

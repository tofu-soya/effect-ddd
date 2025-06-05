// src/model/effect/builders/domain-builder.ts

import { Effect, Schema, pipe, Option, Record } from 'effect';
import {
  ValueObject,
  Entity,
  AggregateRoot,
  ParseResult,
  IDomainEvent,
  EntityTrait,
  ValueObjectTrait,
} from '../interfaces';
import {
  AggGenericTrait,
  EntityGenericTrait,
  ValueObjectGenericTrait,
} from '../implementations';
import { IdentifierTrait } from 'src/typeclasses';
import { ValidationException } from '../exception';
import {
  CommandResult,
  DomainModel,
  Parser,
  WithEntityMetaInput,
} from '../interfaces';
import { parse } from 'path';

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
 * Props parser function type
 */
export type PropsParser<Props = any, Input = any> = (
  input: Input,
) => ParseResult<Props>;

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
  readonly propsParser?: PropsParser<DM['props'], ParseParam>;
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
> extends ValueObjectTrait<VO, NewParam, ParseParam> {}

interface EnhancedEntityTrait<
  E extends Entity,
  NewParam = unknown,
  ParseParam = unknown,
  Q extends Record<
    string,
    QueryFunction<E['props']> | QueryEffectFunction<E['props']>
  > = Record<string, never>,
  C extends Record<string, CommandFunction<E>> = Record<string, never>,
> extends EntityTrait<E, NewParam, ParseParam> {}

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
// ===== Type Guards and Utilities =====

type AnyDomainConfig = DomainConfig<any, any, any, any>;
type AnyEntityConfig = EntityConfig<any, any, any, any, any>;
type AnyAggregateConfig = AggregateConfig<any, any, any, any, any, any>;

// Type predicate to check if config is EntityConfig or AggregateConfig
type IsEntityLikeConfig<T> = T extends EntityConfig<any, any, any, any, any>
  ? true
  : false;

// Type predicate to check if config is AggregateConfig
type IsAggregateConfig<T> = T extends AggregateConfig<
  any,
  any,
  any,
  any,
  any,
  any
>
  ? true
  : false;

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
  propsParser: undefined,
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
  <TConfig extends AnyDomainConfig, S extends Schema.Schema<any>>(schema: S) =>
  (config: TConfig): TConfig => ({
    ...config,
    schema,
    // Clear propsParser when schema is set to avoid conflicts
    propsParser: undefined,
  });

/**
 * Set a custom props parser that will be used instead of schema-based parsing
 */
const withPropsParser =
  <
    TConfig extends AnyDomainConfig,
    NewPropsParser extends PropsParser<any, any>,
  >(
    propsParser: NewPropsParser,
  ) =>
  (config: TConfig): TConfig =>
    ({
      ...config,
      propsParser,
      // Clear schema when propsParser is set to avoid conflicts
      schema: undefined,
    }) as TConfig;

const withValidation =
  <TConfig extends AnyDomainConfig>(
    validator: TConfig extends DomainConfig<infer DM, any, any, any>
      ? (props: DM['props']) => ParseResult<DM['props']>
      : never,
  ) =>
  (config: TConfig): TConfig =>
    ({
      ...config,
      validators: [...config.validators, validator],
    }) as TConfig;

const withInvariant =
  <TConfig extends AnyDomainConfig>(
    predicate: TConfig extends DomainConfig<infer DM, any, any, any>
      ? (props: DM['props']) => boolean
      : never,
    errorMessage: string,
    errorCode: string = 'INVARIANT_VIOLATION',
  ) =>
  (config: TConfig): TConfig => {
    const validator = (props: any) => {
      if (!predicate(props)) {
        return Effect.fail(ValidationException.new(errorCode, errorMessage));
      }
      return Effect.succeed(props);
    };

    return pipe(config, withValidation(validator as any));
  };

const withNew =
  <TConfig extends AnyDomainConfig>(
    newMethod: TConfig extends DomainConfig<
      infer DM,
      infer ParseParam,
      infer NewParam,
      any
    >
      ? (
          params: NewParam,
          parse: (input: ParseParam) => ParseResult<DM>,
        ) => ParseResult<DM>
      : never,
  ) =>
  (
    config: TConfig,
  ): Omit<TConfig, 'newMethod'> & { newMethod: typeof newMethod } => ({
    ...config,
    newMethod,
  });

/**
 * Extract query method types from a queries record
 */
const withQuery =
  <TConfig extends AnyDomainConfig, K extends string, R>(
    name: K,
    query: TConfig extends DomainConfig<infer DM, any, any, any>
      ? QueryFunction<DM['props'], R>
      : never,
  ) =>
  (
    config: TConfig,
  ): TConfig & {
    queries: TConfig['queries'] & Record<K, typeof query>;
  } =>
    ({
      ...config,
      queries: {
        ...config.queries,
        [name]: query,
      },
    }) as TConfig & { queries: TConfig['queries'] & Record<K, typeof query> };

/**
 * Add async query method - works with all config types
 */
const withQueryEffect =
  <TConfig extends AnyDomainConfig, K extends string, R>(
    name: K,
    query: TConfig extends DomainConfig<infer DM, any, any, any>
      ? QueryEffectFunction<DM['props'], R>
      : never,
  ) =>
  (
    config: TConfig,
  ): TConfig & {
    queries: TConfig['queries'] & Record<K, typeof query>;
  } =>
    ({
      ...config,
      queries: {
        ...config.queries,
        [name]: query,
      },
    }) as TConfig & { queries: TConfig['queries'] & Record<K, typeof query> };

/**
 * Add command method - only works with Entity and Aggregate configs
 */
const withCommand =
  <TConfig extends AnyEntityConfig, K extends string, I>(
    name: K,
    handler: TConfig extends EntityConfig<infer E, any, any, any, any>
      ? (
          input: I,
          props: E['props'],
          entity: E,
        ) => Effect.Effect<{ props: E['props'] }, any, never>
      : never,
  ) =>
  (
    config: TConfig,
  ): TConfig & {
    commands: TConfig['commands'] & Record<K, CommandFunction<any, I>>;
  } => {
    // Ensure we only accept EntityConfig or AggregateConfig
    if (!('commands' in config)) {
      throw new Error(
        'withCommand can only be used with Entity or Aggregate configurations',
      );
    }

    const commandFunction = EntityGenericTrait.asCommand(handler as any);

    return {
      ...config,
      commands: {
        ...config.commands,
        [name]: commandFunction,
      },
    } as TConfig & {
      commands: TConfig['commands'] & Record<K, CommandFunction<any, I>>;
    };
  };

/**
 * Add aggregate command - only works with Aggregate configs
 */
const withAggregateCommand =
  <TConfig extends AnyAggregateConfig, K extends string, I>(
    name: K,
    handler: TConfig extends AggregateConfig<infer A, any, any, any, any, any>
      ? (
          input: I,
          props: A['props'],
          aggregate: A,
          correlationId: string,
        ) => Effect.Effect<
          { props: A['props']; domainEvents: IDomainEvent[] },
          any,
          any
        >
      : never,
  ) =>
  (
    config: TConfig,
  ): TConfig & {
    commands: TConfig['commands'] &
      Record<
        K,
        CommandFunction<
          TConfig extends AggregateConfig<infer A, any, any, any, any, any>
            ? A
            : never,
          I
        >
      >;
  } => {
    // Ensure we only accept AggregateConfig
    if (!('eventHandlers' in config)) {
      throw new Error(
        'withAggregateCommand can only be used with Aggregate configurations',
      );
    }

    const commandFunction = AggGenericTrait.asCommand(handler as any);

    return {
      ...config,
      commands: {
        ...config.commands,
        [name]: commandFunction,
      },
    } as TConfig & {
      commands: TConfig['commands'] & Record<K, CommandFunction<any, I>>;
    };
  };

/**
 * Add event handler - only works with Aggregate configs
 */
const withEventHandler =
  <TConfig extends AnyAggregateConfig, K extends string>(
    eventName: K,
    handler: EventHandlerFunction,
  ) =>
  (
    config: TConfig,
  ): TConfig & {
    eventHandlers: TConfig['eventHandlers'] & Record<K, EventHandlerFunction>;
  } => {
    // Ensure we only accept AggregateConfig
    if (!('eventHandlers' in config)) {
      throw new Error(
        'withEventHandler can only be used with Aggregate configurations',
      );
    }

    return {
      ...config,
      eventHandlers: {
        ...config.eventHandlers,
        [eventName]: handler,
      },
    } as TConfig & {
      eventHandlers: TConfig['eventHandlers'] & Record<K, EventHandlerFunction>;
    };
  };

// ===== Enhanced Props Parser Factory =====

/**
 * Creates a props parser based on configuration
 * Priority: propsParser > schema > error
 */
const createPropsParser =
  <DM extends DomainModel, ParseParam = unknown, NewParam = DM['props']>(
    config: DomainConfig<DM, ParseParam, NewParam, any>,
  ) =>
  (raw: ParseParam): ParseResult<DM['props']> => {
    // Priority 1: Use custom propsParser if provided
    if (config.propsParser) {
      return Effect.gen(function* () {
        // Parse with custom parser
        const validated = yield* config.propsParser!(raw);

        // Then run custom validators
        let result = validated;
        for (const validator of config.validators) {
          result = yield* validator(result);
        }

        return result;
      });
    }

    // Priority 2: Use schema if provided
    if (config.schema) {
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
    }

    // Priority 3: Error if neither is provided
    return Effect.fail(
      ValidationException.new(
        'NO_PARSER_CONFIGURED',
        `No parser configured for ${config.tag}. Use either withSchema() or withPropsParser().`,
      ),
    );
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
    config as DomainConfig<A, ParseParam, NewParam, Q>,
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
    parse: baseTrait.parse,
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
  withPropsParser,
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

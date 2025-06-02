import { Effect, Schema, pipe, Option } from 'effect';
import {
  ValueObject,
  Entity,
  AggregateRoot,
  ParseResult,
  IDomainEvent,
} from '@model/effect';
import {
  AggGenericTrait,
  EntityGenericTrait,
  ValueObjectGenericTrait,
} from '@model/effect';
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
 * Replaces deprecated Function type with specific signature
 */
export type QueryFunction<Props = any, Return = any> = (props: Props) => Return;

/**
 * Query effect function type for async queries
 * Replaces deprecated Function type with specific Effect signature
 */
export type QueryEffectFunction<Props = any, Return = any> = (
  props: Props,
) => Effect.Effect<Return, any, any>;

/**
 * Command function type for entities
 * Replaces deprecated Function type with specific command signature
 */
export type CommandFunction<E extends Entity, Input = any> = (
  input: Input,
) => (entity: E, correlationId?: string) => CommandResult<E>;

/**
 * Event handler function type
 * Replaces deprecated Function type with specific event handler signature
 */
export type EventHandlerFunction = (event: IDomainEvent) => void;
/**
 * Maps Domain Model types to their appropriate Config types
 * - ValueObject -> DomainConfig
 * - Entity -> EntityConfig
 * - AggregateRoot -> AggregateConfig
 */
export type ConfigForDomainModel<
  DM extends DomainModel,
  ParseParam = unknown,
  NewParam = DM['props'],
> = DM extends AggregateRoot
  ? AggregateConfig<DM, ParseParam, NewParam>
  : DM extends Entity
    ? EntityConfig<DM, ParseParam, NewParam>
    : DM extends ValueObject
      ? DomainConfig<DM, ParseParam, NewParam>
      : never;

// ===== Configuration Types =====

interface DomainConfig<
  DM extends DomainModel,
  ParseParam = unknown,
  NewParam = DM['props'],
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
  readonly queries: Record<
    string,
    QueryFunction<DM['props']> | QueryEffectFunction<DM['props']>
  >;
}

interface EntityConfig<
  E extends Entity,
  ParseParam = unknown,
  NewParam = E['props'],
> extends DomainConfig<E, ParseParam, NewParam> {
  readonly commands: Record<string, CommandFunction<E>>;
  readonly newMethod?: (
    params: NewParam,
    parse: Parser<E, WithEntityMetaInput<ParseParam>>,
  ) => ParseResult<E>;
}

interface AggregateConfig<
  A extends AggregateRoot,
  ParseParam = unknown,
  NewParam = A['props'],
> extends EntityConfig<A, ParseParam, NewParam> {
  readonly eventHandlers: Record<string, EventHandlerFunction>;
}

// ===== Core Configuration Builders =====

// ===== Core Configuration Builders =====

const createDomainConfig = <
  DM extends DomainModel,
  ParseParam = unknown,
  NewParam = DM['props'],
>(
  tag: string,
): DomainConfig<DM, ParseParam, NewParam> => ({
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
): EntityConfig<E, ParseParam, NewParam> => ({
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
): AggregateConfig<A, ParseParam, NewParam> => ({
  ...createEntityConfig<A, ParseParam, NewParam>(tag),
  eventHandlers: {},
});

// ===== Configuration Transformers =====

const withSchema =
  <
    S extends Schema.Schema<any>,
    DM extends DomainModel<Schema.Schema.Type<S>>,
    ParseParam,
    NewParam,
  >(
    schema: S,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam>,
  ): DomainConfig<DM, ParseParam, NewParam> => ({
    ...config,
    schema,
  });

const withValidation =
  <DM extends DomainModel, ParseParam, NewParam>(
    validator: (props: DM['props']) => ParseResult<DM['props']>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam>,
  ): DomainConfig<DM, ParseParam, NewParam> => ({
    ...config,
    validators: [...config.validators, validator],
  });

const withInvariant =
  <DM extends DomainModel, ParseParam, NewParam>(
    predicate: (props: DM['props']) => boolean,
    errorMessage: string,
    errorCode: string = 'INVARIANT_VIOLATION',
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam>,
  ): DomainConfig<DM, ParseParam, NewParam> =>
    withValidation<DM, ParseParam, NewParam>((props) => {
      if (!predicate(props)) {
        return Effect.fail(ValidationException.new(errorCode, errorMessage));
      }
      return Effect.succeed(props);
    })(config);

const withNew =
  <DM extends DomainModel, ParseParam, NewParam, NewNewParam>(
    newMethod: (
      params: NewNewParam,
      parse: (input: ParseParam) => ParseResult<DM>,
    ) => ParseResult<DM>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam>,
  ): DomainConfig<DM, ParseParam, NewNewParam> => ({
    ...config,
    newMethod,
  });

const withQuery =
  <DM extends DomainModel, ParseParam, NewParam, R>(
    name: string,
    query: QueryFunction<DM['props'], R>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam>,
  ): DomainConfig<DM, ParseParam, NewParam> => ({
    ...config,
    queries: {
      ...config.queries,
      [name]: query,
    },
  });

const withQueryEffect =
  <DM extends DomainModel, ParseParam, NewParam, R>(
    name: string,
    query: QueryEffectFunction<DM['props'], R>,
  ) =>
  (
    config: DomainConfig<DM, ParseParam, NewParam>,
  ): DomainConfig<DM, ParseParam, NewParam> => ({
    ...config,
    queries: {
      ...config.queries,
      [name]: query,
    },
  });

const withCommand =
  <E extends Entity, ParseParam, NewParam, I>(
    name: string,
    handler: (
      input: I,
      props: E['props'],
      entity: E,
    ) => Effect.Effect<{ props: E['props'] }, any, never>,
  ) =>
  (
    config: EntityConfig<E, ParseParam, NewParam>,
  ): EntityConfig<E, ParseParam, NewParam> => ({
    ...config,
    commands: {
      ...config.commands,
      [name]: EntityGenericTrait.asCommand(handler),
    },
  });

const withAggregateCommand =
  <A extends AggregateRoot, ParseParam, NewParam, I>(
    name: string,
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
    config: AggregateConfig<A, ParseParam, NewParam>,
  ): AggregateConfig<A, ParseParam, NewParam> => ({
    ...config,
    commands: {
      ...config.commands,
      [name]: AggGenericTrait.asCommand(handler),
    },
  });

const withEventHandler =
  <A extends AggregateRoot, ParseParam, NewParam>(
    eventName: string,
    handler: EventHandlerFunction,
  ) =>
  (
    config: AggregateConfig<A, ParseParam, NewParam>,
  ): AggregateConfig<A, ParseParam, NewParam> => ({
    ...config,
    eventHandlers: {
      ...config.eventHandlers,
      [eventName]: handler,
    },
  });
// ===== Props Parser Factory =====

/**
 * Creates a props parser for ValueObject domain models
 */
const createValueObjectPropsParser =
  <VO extends ValueObject, ParseParam = unknown, NewParam = VO['props']>(
    config: DomainConfig<VO, ParseParam, NewParam>,
  ) =>
  (raw: ParseParam): ParseResult<VO['props']> => {
    if (!config.schema) {
      throw new Error(`Schema is required for parsing ${config.tag}`);
    }

    return Effect.gen(function* () {
      // First, validate with schema
      const validated = (yield* Schema.decodeUnknown(config.schema!)(
        raw,
      )) as VO['props'];

      // Then run custom validators
      let result = validated;
      for (const validator of config.validators) {
        result = yield* validator(result);
      }

      return result;
    });
  };

/**
 * Creates a props parser for Entity domain models
 */
const createEntityPropsParser =
  <E extends Entity, ParseParam = unknown, NewParam = E['props']>(
    config: EntityConfig<E, ParseParam, NewParam>,
  ) =>
  (raw: ParseParam): ParseResult<E['props']> => {
    if (!config.schema) {
      throw new Error(`Schema is required for parsing ${config.tag}`);
    }

    return Effect.gen(function* () {
      // First, validate with schema
      const validated = (yield* Schema.decodeUnknown(config.schema!)(
        raw,
      )) as E['props'];

      // Then run custom validators
      let result = validated;
      for (const validator of config.validators) {
        result = yield* validator(result);
      }

      return result;
    });
  };

/**
 * Creates a props parser for AggregateRoot domain models
 */
const createAggregateRootPropsParser =
  <A extends AggregateRoot, ParseParam = unknown, NewParam = A['props']>(
    config: AggregateConfig<A, ParseParam, NewParam>,
  ) =>
  (raw: ParseParam): ParseResult<A['props']> => {
    if (!config.schema) {
      throw new Error(`Schema is required for parsing ${config.tag}`);
    }

    return Effect.gen(function* () {
      // First, validate with schema
      const validated = (yield* Schema.decodeUnknown(config.schema!)(
        raw,
      )) as A['props'];

      // Then run custom validators
      let result = validated;
      for (const validator of config.validators) {
        result = yield* validator(result);
      }

      return result;
    });
  };

// ===== Builders using existing traits =====

const buildValueObject = <VO extends ValueObject, ParseParam, NewParam>(
  config: DomainConfig<VO, ParseParam, NewParam>,
) => {
  const propsParser = createValueObjectPropsParser<VO, ParseParam, NewParam>(
    config,
  );

  // Use the existing ValueObjectGenericTrait
  const baseTrait = ValueObjectGenericTrait.createValueObjectTrait<
    VO,
    NewParam,
    ParseParam
  >(propsParser, config.tag);

  // Enhanced new method that provides parse access
  const newMethod = config.newMethod
    ? (params: NewParam) => {
        // Create a parse function that validates and creates the value object

        // Call the custom newMethod with access to parse
        return config.newMethod!(params, baseTrait.parse);
      }
    : baseTrait.new;

  return {
    ...baseTrait,
    new: newMethod,
    ...config.queries,
  };
};

const buildEntity = <E extends Entity, ParseParam, NewParam>(
  config: EntityConfig<E, ParseParam, NewParam>,
) => {
  const propsParser = createEntityPropsParser(config);

  // Use the existing EntityGenericTrait
  const baseTrait = EntityGenericTrait.createEntityTrait<
    E,
    NewParam,
    ParseParam
  >(propsParser, config.tag);

  // Enhanced new method that provides parse access
  const newMethod = config.newMethod
    ? (params: NewParam) => {
        // Create a parse function that validates and creates the entity

        // Call the custom newMethod with access to parse
        return config.newMethod!(params, baseTrait.parse);
      }
    : baseTrait.new;

  return {
    ...baseTrait,
    new: newMethod,
    ...config.queries,
    ...config.commands,
  };
};

const buildAggregateRoot = <T extends AggregateRoot, ParseParam, NewParams>(
  config: AggregateConfig<T, ParseParam, NewParams>,
) => {
  const propsParser = createAggregateRootPropsParser(config);

  // Use the existing AggGenericTrait
  const baseTrait = AggGenericTrait.createAggregateRootTrait<
    T,
    NewParams,
    ParseParam
  >(propsParser, config.tag);

  // Override the new method if provided
  const newMethod = config.newMethod
    ? (params: NewParams) => {
        return pipe(
          config.newMethod!(params, baseTrait.parse),
          Effect.map(
            (props) =>
              ({
                _tag: config.tag,
                props,
                id: IdentifierTrait.uuid(),
                createdAt: new Date(),
                updatedAt: Option.none(),
                domainEvents: [],
              }) as AggregateRoot<T>,
          ),
        );
      }
    : baseTrait.new;

  return {
    ...baseTrait,
    new: newMethod,
    ...config.queries,
    ...config.commands,
    eventHandlers: config.eventHandlers,
  };
};

// ===== Public API =====

/**
 * Functional domain builder API leveraging existing traits
 *
 * Usage examples:
 *
 * // Value Object with query
 * const EmailTrait = pipe(
 *   createValueObject<EmailProps, string>('Email'),
 *   withSchema(EmailSchema),
 *   withNew((emailString: string) =>
 *     Effect.succeed({ value: emailString.toLowerCase().trim() })
 *   ),
 *   withQuery('getDomain', (props) => props.value.split('@')[1]),
 *   withInvariant(
 *     (props) => validator.isEmail(props.value),
 *     'Invalid email format'
 *   ),
 *   buildValueObject
 * );
 *
 * // Entity with commands and queries
 * const UserTrait = pipe(
 *   createEntity<UserProps, UserCreationParams>('User'),
 *   withSchema(UserSchema),
 *   withNew(createUserWithDefaults),
 *   withQuery('isActive', (props) => props.isActive),
 *   withQuery('getDisplayName', (props) => `${props.name} (${props.email})`),
 *   withCommand('updateName', updateNameCommand),
 *   withCommand('activate', activateCommand),
 *   buildEntity
 * );
 *
 * // Aggregate Root with events, commands, and queries
 * const OrderTrait = pipe(
 *   createAggregateRoot<OrderProps, OrderCreationParams>('Order'),
 *   withSchema(OrderSchema),
 *   withNew(createOrderWithValidation),
 *   withQuery('getTotalItems', (props) => props.items.length),
 *   withQuery('getItemsValue', (props) =>
 *     props.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
 *   ),
 *   withAggregateCommand('addItem', addItemCommand),
 *   withAggregateCommand('confirm', confirmOrderCommand),
 *   withEventHandler('OrderConfirmed', handleOrderConfirmed),
 *   buildAggregateRoot
 * );
 */

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

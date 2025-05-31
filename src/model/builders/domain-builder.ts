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

// ===== Configuration Types =====

interface DomainConfig<T extends Record<string, any>, NewParams = T> {
  readonly tag: string;
  readonly schema?: Schema.Schema<T>;
  readonly validators: ReadonlyArray<(props: T) => ParseResult<T>>;
  readonly newMethod?: (params: NewParams) => ParseResult<T>;
  readonly queries: Record<string, Function>;
}

interface EntityConfig<T extends Record<string, any>, NewParams = T>
  extends DomainConfig<T, NewParams> {
  readonly commands: Record<string, Function>;
}

interface AggregateConfig<T extends Record<string, any>, NewParams = T>
  extends EntityConfig<T, NewParams> {
  readonly eventHandlers: Record<string, Function>;
}

// ===== Core Configuration Builders =====

const createDomainConfig = <T extends Record<string, any>, NewParams = T>(
  tag: string,
): DomainConfig<T, NewParams> => ({
  tag,
  schema: undefined,
  validators: [],
  newMethod: undefined,
  queries: {},
});

const createEntityConfig = <T extends Record<string, any>, NewParams = T>(
  tag: string,
): EntityConfig<T, NewParams> => ({
  ...createDomainConfig<T, NewParams>(tag),
  commands: {},
});

const createAggregateConfig = <T extends Record<string, any>, NewParams = T>(
  tag: string,
): AggregateConfig<T, NewParams> => ({
  ...createEntityConfig<T, NewParams>(tag),
  eventHandlers: {},
});

// ===== Configuration Transformers =====

const withSchema =
  <S extends Record<string, any>, NewParams>(schema: Schema.Schema<S>) =>
  (config: DomainConfig<S, NewParams>): DomainConfig<S, NewParams> => ({
    ...config,
    schema,
  });

const withValidation =
  <T extends Record<string, any>, NewParams>(
    validator: (props: T) => ParseResult<T>,
  ) =>
  (config: DomainConfig<T, NewParams>): DomainConfig<T, NewParams> => ({
    ...config,
    validators: [...config.validators, validator],
  });

const withInvariant =
  <T extends Record<string, any>, NewParams>(
    predicate: (props: T) => boolean,
    errorMessage: string,
    errorCode: string = 'INVARIANT_VIOLATION',
  ) =>
  (config: DomainConfig<T, NewParams>): DomainConfig<T, NewParams> =>
    withValidation<T, NewParams>((props) => {
      if (!predicate(props)) {
        return Effect.fail(ValidationException.new(errorCode, errorMessage));
      }
      return Effect.succeed(props);
    })(config);

const withNew =
  <T extends Record<string, any>, NewParams, NewNewParams>(
    newMethod: (params: NewNewParams) => ParseResult<T>,
  ) =>
  (config: DomainConfig<T, NewParams>): DomainConfig<T, NewNewParams> => ({
    ...config,
    newMethod,
  });

const withQuery =
  <T extends Record<string, any>, NewParams, R>(
    name: string,
    query: (props: T) => R,
  ) =>
  (config: DomainConfig<T, NewParams>): DomainConfig<T, NewParams> => ({
    ...config,
    queries: {
      ...config.queries,
      [name]: query,
    },
  });

const withQueryEffect =
  <T extends Record<string, any>, NewParams, R>(
    name: string,
    query: (props: T) => Effect.Effect<R, any, any>,
  ) =>
  (config: DomainConfig<T, NewParams>): DomainConfig<T, NewParams> => ({
    ...config,
    queries: {
      ...config.queries,
      [name]: query,
    },
  });

const withCommand =
  <T extends Record<string, any>, I, NewParams>(
    name: string,
    handler: (
      input: I,
      props: T,
      entity: Entity<T>,
    ) => Effect.Effect<{ props: T }, any, never>,
  ) =>
  (config: EntityConfig<T, NewParams>): EntityConfig<T, NewParams> => ({
    ...config,
    commands: {
      ...config.commands,
      [name]: EntityGenericTrait.asCommand(handler),
    },
  });

const withAggregateCommand =
  <T extends Record<string, any>, I, NewParams>(
    name: string,
    handler: (
      input: I,
      props: T,
      aggregate: AggregateRoot<T>,
      correlationId: string,
    ) => Effect.Effect<{ props: T; domainEvents: IDomainEvent[] }, any, any>,
  ) =>
  (config: AggregateConfig<T, NewParams>): AggregateConfig<T, NewParams> => ({
    ...config,
    commands: {
      ...config.commands,
      [name]: AggGenericTrait.asCommand(handler),
    },
  });

const withEventHandler =
  <T extends Record<string, any>, NewParams>(
    eventName: string,
    handler: Function,
  ) =>
  (config: AggregateConfig<T, NewParams>): AggregateConfig<T, NewParams> => ({
    ...config,
    eventHandlers: {
      ...config.eventHandlers,
      [eventName]: handler,
    },
  });

// ===== Props Parser Factory =====

const createPropsParser =
  <T extends Record<string, any>, NewParams>(
    config: DomainConfig<T, NewParams>,
  ) =>
  (raw: unknown): ParseResult<T> => {
    if (!config.schema) {
      throw new Error(`Schema is required for parsing ${config.tag}`);
    }

    return Effect.gen(function* () {
      // First, validate with schema
      const validated = yield* Schema.decodeUnknown(config.schema!)(raw);

      // Then run custom validators
      let result = validated;
      for (const validator of config.validators) {
        result = yield* validator(result);
      }

      return result;
    });
  };

// ===== Builders using existing traits =====

const buildValueObject = <T extends Record<string, any>, NewParams>(
  config: DomainConfig<T, NewParams>,
) => {
  const propsParser = createPropsParser(config);

  // Use the existing ValueObjectGenericTrait
  const baseTrait = ValueObjectGenericTrait.createValueObjectTrait<
    ValueObject<T>,
    NewParams,
    unknown
  >(propsParser, config.tag);

  // Override the new method if provided
  const newMethod = config.newMethod
    ? (params: NewParams) => {
        return pipe(
          config.newMethod!(params),
          Effect.map(
            (props) =>
              ({
                _tag: config.tag,
                props,
              }) as ValueObject<T>,
          ),
        );
      }
    : baseTrait.new;

  return {
    ...baseTrait,
    new: newMethod,
    ...config.queries,
  };
};

const buildEntity = <T extends Record<string, any>, NewParams>(
  config: EntityConfig<T, NewParams>,
) => {
  const propsParser = createPropsParser(config);

  // Use the existing EntityGenericTrait
  const baseTrait = EntityGenericTrait.createEntityTrait<
    Entity<T>,
    NewParams,
    unknown
  >(propsParser, config.tag);

  // Override the new method if provided
  const newMethod = config.newMethod
    ? (params: NewParams) => {
        return pipe(
          config.newMethod!(params),
          Effect.map(
            (props) =>
              ({
                _tag: config.tag,
                props,
                id: IdentifierTrait.uuid(),
                createdAt: new Date(),
                updatedAt: Option.none(),
              }) as Entity<T>,
          ),
        );
      }
    : baseTrait.new;

  return {
    ...baseTrait,
    new: newMethod,
    ...config.queries,
    ...config.commands,
  };
};

const buildAggregateRoot = <T extends Record<string, any>, NewParams>(
  config: AggregateConfig<T, NewParams>,
) => {
  const propsParser = createPropsParser(config);

  // Use the existing AggGenericTrait
  const baseTrait = AggGenericTrait.createAggregateRootTrait<
    AggregateRoot<T>,
    NewParams,
    unknown
  >(propsParser, config.tag);

  // Override the new method if provided
  const newMethod = config.newMethod
    ? (params: NewParams) => {
        return pipe(
          config.newMethod!(params),
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

export const createValueObject = <T extends Record<string, any>, NewParams = T>(
  tag: string,
) => createDomainConfig<T, NewParams>(tag);

export const createEntity = <T extends Record<string, any>, NewParams = T>(
  tag: string,
) => createEntityConfig<T, NewParams>(tag);

export const createAggregateRoot = <
  T extends Record<string, any>,
  NewParams = T,
>(
  tag: string,
) => createAggregateConfig<T, NewParams>(tag);

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

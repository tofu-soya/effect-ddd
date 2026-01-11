import { Effect, Option, pipe } from 'effect';
import {
  CommandOnModel,
  Entity,
  EntityPropsParser,
  EntityTrait,
  IEntityGenericTrait,
  WithEntityMetaInput,
} from '../interfaces/entity.interface';
import { GetProps, Identifier, IdentifierTrait } from 'src/typeclasses';
import { CoreException, ParseResult } from '../interfaces/validation.interface';
import { v4 as uuidv4 } from 'uuid';
/**
 * Implementation of the generic entity trait
 */
export const EntityGenericTrait: IEntityGenericTrait = {
  getTag: (entity) => entity._tag,

  getId: (entity) => entity.id,

  getCreatedAt: (entity) => entity.createdAt,

  getUpdatedAt: (entity) => entity.updatedAt,

  markUpdated: <E extends Entity>(entity: E): E => ({
    ...entity,
    updatedAt: Option.some(new Date()),
  }),

  unpack: <E extends Entity>(entity: E): GetProps<E> =>
    entity.props as GetProps<E>,

  isEqual: <E extends Entity>(entity1: E, entity2: E): boolean =>
    entity1._tag === entity2._tag && entity1.id === entity2.id,

  createEntityTrait: <E extends Entity, N = unknown, P = unknown>(
    propsParser: EntityPropsParser<E, P>,
    tag: string,
    options = { autoGenId: true },
  ): EntityTrait<E, N, P> => {
    const parse = (input: WithEntityMetaInput<P>): ParseResult<E> => {
      return pipe(
        Effect.succeed(input),
        Effect.flatMap((data) => {
          const id = options.autoGenId && !data.id ? uuidv4() : data.id || '';
          const createdAt = pipe(
            data.createdAt,
            Option.getOrElse(() => new Date()),
          );
          const updatedAt = data.updatedAt;

          return pipe(
            propsParser(data),
            Effect.map(
              (props) =>
                ({
                  _tag: tag,
                  id: id as Identifier,
                  createdAt,
                  updatedAt,
                  props,
                }) as E,
            ),
          );
        }),
      );
    };

    return {
      parse,
      new: (params: N) => parse(params as unknown as WithEntityMetaInput<P>),
    };
  },
  asCommand: <E extends Entity, I>(
    reducerLogic: (
      input: I,
      props: GetProps<E>,
      entity: E,
      correlationId: string,
    ) => Effect.Effect<{ props: GetProps<E> }, CoreException, never>,
    validators?: ReadonlyArray<
      (props: GetProps<E>) => Effect.Effect<GetProps<E>, CoreException, never>
    >,
  ) => {
    return (input: I): CommandOnModel<E> => {
      return (entity: E, correlationId?: string) => {
        const _correlationId = correlationId || IdentifierTrait.uuid();
        return pipe(
          reducerLogic(
            input,
            EntityGenericTrait.unpack(entity),
            entity,
            _correlationId,
          ),
          Effect.flatMap(({ props }) => {
            // Run validators on new props if provided
            let validationEffect: Effect.Effect<
              GetProps<E>,
              CoreException,
              never
            > = Effect.succeed(props);
            if (validators && validators.length > 0) {
              for (const validator of validators) {
                validationEffect = pipe(
                  validationEffect,
                  Effect.flatMap(validator),
                );
              }
            }

            return pipe(
              validationEffect,
              Effect.map(
                (validatedProps): E => ({
                  ...entity,
                  props: validatedProps as E['props'],
                  updatedAt: Option.some(new Date()),
                }),
              ),
            );
          }),
        );
      };
    };
  },
};

/**
 * Helper function to create an entity trait
 */
export const createEntityTrait = <E extends Entity, N = unknown, P = unknown>(
  propsParser: EntityPropsParser<E>,
  tag: string,
  options?: { autoGenId: boolean },
): EntityTrait<E, N, P> => {
  return EntityGenericTrait.createEntityTrait(propsParser, tag, options);
};

/**
 * AsReducer function type
 */

/**
 * Implementation of asReducer function
 *
 * This function allows creating reducers that modify entity properties
 * and generate domain events in a type-safe way.
 */

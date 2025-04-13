import { ReadonlyRecord } from 'effect/Record';
import { Option } from 'effect/Option';
import { Effect } from 'effect/Effect';
import { pipe } from 'effect/Function';
import { Eq } from 'effect/Equal';
import { Array } from 'effect/Array';
import { ParseIssue, ParseResult, Parser } from './validation';
import { DomainModel, DomainModelTrait, PropsParser } from './domain-model.base';
import { Identifier } from 'src/typeclasses/obj-with-id';
import { GetProps } from 'src/typeclasses';
import { Brand } from '@type_util/index';
import { v4 as uuidv4 } from 'uuid';

/**
 * Entity type that extends DomainModel with additional properties
 */
export type Entity<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<string, unknown>
> = DomainModel<Props> & {
  readonly id: Identifier;
  readonly updatedAt: Option<Date>;
};

/**
 * Common properties for all entities
 */
export type EntityCommonProps = Omit<Entity, 'props'>;

/**
 * Input type for entity creation with metadata
 */
export type WithEntityMetaInput<OriginInput> = OriginInput & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Option<Date>;
};

/**
 * Parser for entity properties
 */
export type EntityPropsParser<E extends Entity = Entity, I = unknown> = (
  raw: I
) => ParseResult<E['props']>;

/**
 * Interface for entity trait
 */
export interface EntityTrait<
  E extends Entity,
  NewParams = unknown,
  ParseParams = unknown
> extends DomainModelTrait<E, NewParams, WithEntityMetaInput<ParseParams>> {}

/**
 * Generic entity trait interface
 */
export interface IEntityGenericTrait {
  getTag: (entity: Entity) => string;
  getId: <E extends Entity>(entity: E) => Identifier;
  getCreatedAt: <E extends Entity>(entity: E) => Date;
  getUpdatedAt: <E extends Entity>(entity: E) => Option<Date>;
  markUpdated: <E extends Entity>(entity: E) => E;
  unpack: <E extends Entity>(entity: E) => GetProps<E>;
  isEqual: <E extends Entity>(entity1: E, entity2: E) => boolean;
  createEntityTrait: <
    E extends Entity,
    N = unknown,
    P = unknown
  >(
    propsParser: EntityPropsParser<E>,
    tag: string,
    options?: { autoGenId: boolean }
  ) => EntityTrait<E, N, P>;
}

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
    updatedAt: Option.some(new Date())
  }),
  
  unpack: <E extends Entity>(entity: E): GetProps<E> => entity.props as GetProps<E>,
  
  isEqual: <E extends Entity>(entity1: E, entity2: E): boolean => 
    entity1._tag === entity2._tag && entity1.id === entity2.id,
  
  createEntityTrait: <
    E extends Entity,
    N = unknown,
    P = unknown
  >(
    propsParser: EntityPropsParser<E>,
    tag: string,
    options = { autoGenId: true }
  ): EntityTrait<E, N, P> => {
    const parse = (input: WithEntityMetaInput<P>): ParseResult<E> => {
      return pipe(
        Effect.succeed(input),
        Effect.flatMap((data) => {
          const id = options.autoGenId && !data.id ? uuidv4() : data.id || '';
          const createdAt = data.createdAt || new Date();
          const updatedAt = data.updatedAt || Option.none();
          
          return pipe(
            propsParser(data),
            Effect.map((props) => ({
              _tag: tag,
              id: id as Identifier,
              createdAt,
              updatedAt,
              props
            } as E))
          );
        })
      );
    };
    
    return {
      parse,
      new: (params: N) => parse(params as unknown as WithEntityMetaInput<P>)
    };
  }
};

/**
 * Helper function to create an entity trait
 */
export const createEntityTrait = <
  E extends Entity,
  N = unknown,
  P = unknown
>(
  propsParser: EntityPropsParser<E>,
  tag: string,
  options?: { autoGenId: boolean }
): EntityTrait<E, N, P> => {
  return EntityGenericTrait.createEntityTrait(propsParser, tag, options);
};

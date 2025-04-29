import { ReadonlyRecord } from 'effect/Record';
import { Option } from 'effect';
import { ParseResult } from './validation';
import { DomainModel, DomainModelTrait } from './domain-model.base';
import { Identifier } from 'src/typeclasses/obj-with-id';
import { GetProps } from 'src/typeclasses';

/**
 * Entity type that extends DomainModel with additional properties
 */
export type Entity<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<
    string,
    unknown
  >,
> = DomainModel<Props> & {
  readonly id: Identifier;
  readonly updatedAt: Option.Option<Date>;
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
  updatedAt?: Option.Option<Date>;
};

/**
 * Parser for entity properties
 */
export type EntityPropsParser<E extends Entity = Entity, I = unknown> = (
  raw: I,
) => ParseResult<E['props']>;

/**
 * Interface for entity trait
 */
export interface EntityTrait<
  E extends Entity,
  NewParams = unknown,
  ParseParams = unknown,
> extends DomainModelTrait<E, NewParams, WithEntityMetaInput<ParseParams>> {}

/**
 * Generic entity trait interface
 */
export interface IEntityGenericTrait {
  getTag: (entity: Entity) => string;
  getId: <E extends Entity>(entity: E) => Identifier;
  getCreatedAt: <E extends Entity>(entity: E) => Date;
  getUpdatedAt: <E extends Entity>(entity: E) => Option.Option<Date>;
  markUpdated: <E extends Entity>(entity: E) => E;
  unpack: <E extends Entity>(entity: E) => GetProps<E>;
  isEqual: <E extends Entity>(entity1: E, entity2: E) => boolean;
  createEntityTrait: <E extends Entity, N = unknown, P = unknown>(
    propsParser: EntityPropsParser<E, P>,
    tag: string,
    options?: { autoGenId: boolean },
  ) => EntityTrait<E, N, P>;
}

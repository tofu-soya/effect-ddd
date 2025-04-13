import { ReadonlyRecord } from 'effect/Record';
import { Option, Effect } from 'effect';
import { pipe } from 'effect/Function';
import { ParseResult, Parser } from './validation';
import { Entity, EntityTrait, IEntityGenericTrait } from './entity.base';
import { Identifier } from 'src/typeclasses/obj-with-id';
import { GetProps } from 'src/typeclasses';
import { DomainEvent } from '../event/domain-event.base';

/**
 * AggregateRoot type that extends Entity
 */
export type AggregateRoot<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<string, unknown>
> = Entity<Props> & {
  readonly domainEvents: ReadonlyArray<DomainEvent>;
};

/**
 * Input type for aggregate root creation
 */
export type WithAggregateMetaInput<OriginInput> = OriginInput & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Option.Option<Date>;
  domainEvents?: ReadonlyArray<DomainEvent>;
};

/**
 * Parser for aggregate root properties
 */
export type AggregatePropsParser<A extends AggregateRoot = AggregateRoot, I = unknown> = (
  raw: I
) => ParseResult<A['props']>;

/**
 * Interface for aggregate root trait
 */
export interface AggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown
> extends EntityTrait<A, NewParams, WithAggregateMetaInput<ParseParams>> {}

/**
 * Generic aggregate root trait interface
 */
export interface IAggGenericTrait extends IEntityGenericTrait {
  getDomainEvents: <A extends AggregateRoot>(aggregate: A) => ReadonlyArray<DomainEvent>;
  clearEvents: <A extends AggregateRoot>(aggregate: A) => A;
  addDomainEvent: <A extends AggregateRoot>(event: DomainEvent) => (aggregate: A) => A;
  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A>,
    tag: string,
    options?: { autoGenId: boolean }
  ) => AggregateRootTrait<A, N, P>;
}

/**
 * Implementation of the generic aggregate root trait
 */
export const AggGenericTrait: IAggGenericTrait = {
  // Inherit all methods from EntityGenericTrait
  getTag: (entity) => entity._tag,
  getId: (entity) => entity.id,
  getCreatedAt: (entity) => entity.createdAt,
  getUpdatedAt: (entity) => entity.updatedAt,
  markUpdated: (entity) => ({
    ...entity,
    updatedAt: Option.some(new Date())
  }),
  unpack: (entity) => entity.props as GetProps<typeof entity>,
  isEqual: (entity1, entity2) => 
    entity1._tag === entity2._tag && entity1.id === entity2.id,
  
  // Aggregate specific methods
  getDomainEvents: (aggregate) => aggregate.domainEvents,
  
  clearEvents: (aggregate) => ({
    ...aggregate,
    domainEvents: []
  }),
  
  addDomainEvent: (event) => (aggregate) => ({
    ...aggregate,
    domainEvents: [...aggregate.domainEvents, event]
  }),
  
  // Factory methods
  createEntityTrait: (propsParser, tag, options = { autoGenId: true }) => {
    const parse = (input: any): ParseResult<any> => {
      return pipe(
        Effect.succeed(input),
        Effect.flatMap((data) => {
          const id = options.autoGenId && !data.id ? crypto.randomUUID() : data.id || '';
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
            }))
          );
        })
      );
    };
    
    return {
      parse,
      new: (params: any) => parse(params)
    };
  },
  
  createAggregateRootTrait: (propsParser, tag, options = { autoGenId: true }) => {
    const parse = (input: any): ParseResult<any> => {
      return pipe(
        Effect.succeed(input),
        Effect.flatMap((data) => {
          const id = options.autoGenId && !data.id ? crypto.randomUUID() : data.id || '';
          const createdAt = data.createdAt || new Date();
          const updatedAt = data.updatedAt || Option.none();
          const domainEvents = data.domainEvents || [];
          
          return pipe(
            propsParser(data),
            Effect.map((props) => ({
              _tag: tag,
              id: id as Identifier,
              createdAt,
              updatedAt,
              domainEvents,
              props
            }))
          );
        })
      );
    };
    
    return {
      parse,
      new: (params: any) => parse(params)
    };
  }
};

/**
 * Helper function to create an aggregate root trait
 */
export const createAggregateRootTrait = <
  A extends AggregateRoot,
  N = unknown,
  P = unknown
>(
  propsParser: AggregatePropsParser<A>,
  tag: string,
  options?: { autoGenId: boolean }
): AggregateRootTrait<A, N, P> => {
  return AggGenericTrait.createAggregateRootTrait(propsParser, tag, options);
};

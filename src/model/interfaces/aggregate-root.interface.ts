import { Effect, Option, Record } from 'effect';
import {
  CommandOnModel,
  Entity,
  EntityTrait,
  IEntityGenericTrait,
} from './entity.interface';
import { IDomainEvent } from './domain-event.interface';
import { CoreException, ParseResult } from './validation.interface';
import { GetProps } from 'src/typeclasses';

export interface AggregateRoot<
  Props extends Record<string, unknown> = Record<string, unknown>,
> extends Entity<Props> {
  readonly domainEvents: ReadonlyArray<IDomainEvent>;
}

/**
 * Input type for aggregate root creation
 */
export type WithAggregateMetaInput<OriginInput> = OriginInput & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Option.Option<Date>;
  domainEvents?: ReadonlyArray<IDomainEvent>;
};

/**
 * Parser for aggregate root properties
 */
export type AggregatePropsParser<
  A extends AggregateRoot = AggregateRoot,
  I = unknown,
> = (raw: I) => ParseResult<A['props']>;

/**
 * Validator function type for aggregate props
 */
export type AggregateValidator<A extends AggregateRoot> = (
  props: GetProps<A>,
) => Effect.Effect<GetProps<A>, CoreException, never>;

/**
 * Interface for aggregate root trait
 */
export interface AggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown,
> extends EntityTrait<A, NewParams, ParseParams> {}

export interface BaseAggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown,
> extends AggregateRootTrait<A, NewParams, ParseParams> {
  /**
   * Creates a command that:
   * 1. Always enforces validators from withInvariant/withValidation (baked into trait)
   * 2. Allows additional validators per-command for customization
   */
  asCommand: <I>(
    reducerLogic: (
      input: I,
      props: GetProps<A>,
      aggregate: A,
      correlationId: string,
    ) => Effect.Effect<
      { props: GetProps<A>; domainEvents: IDomainEvent[] },
      CoreException,
      never
    >,
    additionalValidators?: ReadonlyArray<AggregateValidator<A>>,
  ) => (input: I) => CommandOnModel<A>;
}

/**
 * Generic aggregate root trait interface
 */
export interface IAggGenericTrait
  extends Omit<IEntityGenericTrait, 'createEntityTrait'> {
  getDomainEvents: <A extends AggregateRoot>(
    aggregate: A,
  ) => ReadonlyArray<IDomainEvent>;
  clearEvents: <A extends AggregateRoot>(aggregate: A) => A;
  addDomainEvent: <A extends AggregateRoot>(
    event: IDomainEvent,
  ) => (aggregate: A) => A;
  addDomainEvents: <A extends AggregateRoot>(
    events: ReadonlyArray<IDomainEvent>,
  ) => (aggregate: A) => A;
  /**
   * Creates an aggregate root trait with validators baked in.
   * The returned trait's asCommand will automatically enforce these validators.
   */
  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A, P>,
    tag: string,
    options?: { autoGenId: boolean },
    validators?: ReadonlyArray<AggregateValidator<A>>,
  ) => BaseAggregateRootTrait<A, N, P>;
}

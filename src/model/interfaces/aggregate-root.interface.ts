import type { Effect } from '@effect/io/Effect';
import type { Option } from '@effect/data/Option';
import type { ReadonlyRecord } from '@effect/data/ReadonlyRecord';
import type { BaseException } from '../exception.base';
import type { IDomainEvent } from './domain-event.interface';

export type AggregateRoot<
  Props extends ReadonlyRecord<string, unknown> = ReadonlyRecord<
    string,
    unknown
  >,
> = {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Option.Option<Date>;
  readonly domainEvents: ReadonlyArray<IDomainEvent>;
  readonly props: Props;
};

export type WithAggregateMetaInput<OriginInput> = OriginInput & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Option.Option<Date>;
  domainEvents?: ReadonlyArray<IDomainEvent>;
};

export type AggregatePropsParser<
  A extends AggregateRoot = AggregateRoot,
  I = unknown,
> = (raw: I) => Effect<A['props'], BaseException, never>;

export interface AggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown,
> {
  new: (params: NewParams) => A;
  parse: (params: ParseParams) => Effect<A, BaseException, never>;
  getDomainEvents: (aggregate: A) => ReadonlyArray<IDomainEvent>;
  clearEvents: (aggregate: A) => A;
  addDomainEvent: (event: IDomainEvent) => (aggregate: A) => A;
  addDomainEvents: (events: ReadonlyArray<IDomainEvent>) => (aggregate: A) => A;
}

export interface IAggGenericTrait
  extends Omit<IEntityGenericTrait, 'asCommand'> {
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
}

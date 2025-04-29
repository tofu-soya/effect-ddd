import { randomUUID } from 'crypto';
import { Identifier } from 'src/typeclasses/obj-with-id';
import { AggregateRoot, AggGenericTrait } from '../aggregate-root.base';

/**
 * Domain event metadata
 */
export type DomainEventMetadata = {
  /** Timestamp when this domain event occurred */
  readonly timestamp: number;

  /** ID for correlation purposes (for Integration Events, logs correlation, etc). */
  readonly correlationId: string;

  /**
   * Causation id used to reconstruct execution order if needed
   */
  readonly causationId?: string;

  /**
   * User ID for debugging and logging purposes
   */
  readonly userId?: string;
};

/**
 * Class-based implementation of Domain Event
 */
export class DomainEvent<P = any> {
  /**
   * Create a new domain event
   */
  constructor(
    public readonly name: string,
    public readonly metadata: DomainEventMetadata,
    public readonly payload: P,
    public readonly aggregateId?: Identifier,
    public readonly aggregateType?: string,
  ) {}

  /**
   * Check if this event is of a specific type
   */
  is<E extends DomainEvent<any>>(eventName: string): this is E {
    return this.name === eventName;
  }

  /**
   * Get typed event payload
   */
  getPayload() {
    return this.payload;
  }

  /**
   * Create a domain event from an aggregate
   */
  static fromAggregate<A extends AggregateRoot<any>, P = any>(params: {
    agg: A;
    name: string;
    payload: P;
    correlationId?: string;
    userId?: string;
    causationId?: string;
  }): DomainEvent<P> {
    return new DomainEvent<P>(
      params.name,
      {
        timestamp: new Date().getTime(),
        correlationId: params.correlationId || randomUUID(),
        causationId: params.causationId,
        userId: params.userId,
      },
      params.payload,
      AggGenericTrait.id(params.agg),
      AggGenericTrait.getTag(params.agg),
    );
  }

  /**
   * Create a domain event without an aggregate
   */
  static create<P = any>(params: {
    name: string;
    payload: P;
    correlationId?: string;
    userId?: string;
    causationId?: string;
    aggregateId?: Identifier;
    aggregateType?: string;
  }): DomainEvent<P> {
    return new DomainEvent<P>(
      params.name,
      {
        timestamp: new Date().getTime(),
        correlationId: params.correlationId || randomUUID(),
        causationId: params.causationId,
        userId: params.userId,
      },
      params.payload,
      params.aggregateId,
      params.aggregateType,
    );
  }
}

/**
 * Extract the payload type from a DomainEvent
 */
export type ExtractDomainEventPayload<T extends DomainEvent<any>> =
  T extends DomainEvent<infer P> ? P : unknown;

/**
 * Backwards compatibility with existing trait-based approach
 */
export const DomainEventTrait = {
  construct: <A extends AggregateRoot<any>, P = any>(params: {
    agg: A;
    name: string;
    payload: P;
    correlationId?: string;
  }): DomainEvent<P> => DomainEvent.fromAggregate(params),
};

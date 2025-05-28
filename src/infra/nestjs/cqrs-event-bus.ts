import { IDomainEvent } from '@model/effect';
import { IEventBus } from '@model/event/event-bus';
import { EventBus as NestEventBus, IEvent } from '@nestjs/cqrs';

export class NestJsEventBusAdapter implements IEventBus {
  private readonly eventMapper: DomainEventMapper;

  /**
   * Create a new NestJS event bus adapter
   *
   * @param nestEventBus - The NestJS event bus to publish events to
   * @param eventMapper - The event mapper to use for converting domain events
   */
  constructor(
    private readonly nestEventBus: NestEventBus,
    eventMapper: DomainEventMapper,
  ) {
    this.eventMapper = eventMapper;
  }

  /**
   * Publish a domain event to the NestJS event bus
   */
  publish(event: IDomainEvent): void {
    const nestEvent = this.eventMapper.toNestEvent(event);
    this.nestEventBus.publish(nestEvent);
  }
}

/**
 * A generic mapper that converts domain events to NestJS CQRS events
 * without knowledge of specific event types
 */
export class DomainEventMapper {
  /**
   * Create a new mapper with the provided event type mappings
   */
  constructor(
    private readonly eventTypeMap: Record<
      string,
      new (...args: any[]) => IEvent
    > = {},
  ) {}

  /**
   * Register additional event mappings
   */
  registerEventMappings(
    mappings: Record<string, new (...args: any[]) => IEvent>,
  ): void {
    Object.assign(this.eventTypeMap, mappings);
  }

  /**
   * Map a domain event to a NestJS CQRS event
   */
  toNestEvent(domainEvent: IDomainEvent): IEvent {
    const EventClass = this.eventTypeMap[domainEvent.name];

    if (!EventClass) {
      throw new Error(`No mapping found for event type: ${domainEvent.name}`);
    }

    try {
      // First try to use the constructor arguments
      return new EventClass(
        domainEvent.aggregateId,
        domainEvent.aggregateType,
        domainEvent.name,
        domainEvent.metadata,
        domainEvent.payload,
      );
    } catch (error) {
      // Fallback to instantiating with empty constructor and copying properties
      const nestEvent = new EventClass();
      Object.assign(nestEvent, {
        aggregateId: domainEvent.aggregateId,
        aggregateType: domainEvent.aggregateType,
        name: domainEvent.name,
        metadata: domainEvent.metadata,
        payload: domainEvent.payload,
      });
      return nestEvent;
    }
  }
}
/**
 * Create a domain event mapper with the provided event type mappings
 */
export function createDomainEventMapper(
  eventTypeMap: Record<string, new (...args: any[]) => IEvent> = {},
): DomainEventMapper {
  return new DomainEventMapper(eventTypeMap);
}

/**
 * Create an event mapping object from event classes with EVENT_NAME static properties
 *
 * @example
 * const eventMappings = createEventMappingsFromClasses([
 *   CIPInitEvent,
 *   CIPCandidateSettledEvent
 * ]);
 */
export function createEventMappingsFromClasses(
  eventClasses: (new (
    ...args: any[]
  ) => IEvent & { static?: { EVENT_NAME?: string } })[],
): Record<string, new (...args: any[]) => IEvent> {
  const mappings: Record<string, new (...args: any[]) => IEvent> = {};

  for (const EventClass of eventClasses) {
    // Try to get EVENT_NAME static property
    const eventName = (EventClass as any).EVENT_NAME;
    if (eventName && typeof eventName === 'string') {
      mappings[eventName] = EventClass;
    }
  }

  return mappings;
}

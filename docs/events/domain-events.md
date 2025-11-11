# Domain Events

Domain events represent meaningful business occurrences within your domain that other parts of the system need to react to. They enable decoupled, event-driven architectures where changes in one aggregate can trigger side effects in other parts of the system.

## Core Interfaces

### IDomainEvent
Domain event structure containing the event information and metadata.

```typescript
interface IDomainEvent<P = any> {
  readonly name: string;
  readonly metadata: {
    readonly timestamp: number;
    readonly correlationId: string;
    readonly causationId?: string;
    readonly userId?: string;
  };
  readonly payload: P;
  readonly aggregateId?: Identifier;
  readonly aggregateType?: string;

  getPayload(): P;
}
```

### IDomainEventTrait
Factory interface for creating domain events.

```typescript
interface IDomainEventTrait {
  create<P, A extends AggregateRoot>(params: {
    name: string;
    payload: P;
    correlationId: string;
    causationId?: string;
    userId?: string;
    aggregate?: A;
  }): IDomainEvent<P>;
}
```

## Creating Domain Events

### DomainEventTrait.create()
Factory method to create domain events with metadata.

```typescript
import { DomainEventTrait } from 'effect-ddd';

const orderPlacedEvent = DomainEventTrait.create({
  name: 'OrderPlaced',
  payload: {
    orderId: order.id,
    customerId: order.props.customerId,
    totalAmount: order.props.total,
    items: order.props.items
  },
  correlationId: 'cmd-order-123',
  causationId: 'user-action-456',
  userId: 'user-789',
  aggregate: order
});
```

#### Parameters
- **name**: Business event name (e.g., 'OrderPlaced', 'ItemAdded')
- **payload**: Event data containing business information
- **correlationId**: Trace ID to correlate related operations
- **causationId**: (Optional) ID of the command/event that caused this event
- **userId**: (Optional) ID of the user who triggered the event
- **aggregate**: (Optional) Source aggregate root that emitted the event

#### Auto-Generated Fields
- **timestamp**: Automatically set to `Date.now()`
- **aggregateId**: Extracted from aggregate if provided
- **aggregateType**: Extracted from aggregate if provided

## Event Publishing

### IDomainEventPublisher Interface
Service interface for publishing domain events.

```typescript
interface IDomainEventPublisher {
  publish(event: IDomainEvent): Effect.Effect<void, BaseException, never>;
  publishAll(events: ReadonlyArray<IDomainEvent>): Effect.Effect<void, BaseException, never>;
}
```

### Publishing Single Events
```typescript
import { DomainEventPublisherContext } from 'effect-ddd';

const publishOrderEvent = (order: Order) =>
  Effect.gen(function* () {
    const publisher = yield* DomainEventPublisherContext;
    
    const event = DomainEventTrait.create({
      name: 'OrderPlaced',
      payload: {
        orderId: order.id,
        amount: order.props.total
      },
      correlationId: IdentifierTrait.uuid(),
      aggregate: order
    });

    yield* publisher.publish(event);
  });
```

### Publishing Multiple Events
```typescript
const publishOrderEvents = (events: IDomainEvent[]) =>
  Effect.gen(function* () {
    const publisher = yield* DomainEventPublisherContext;
    yield* publisher.publishAll(events);
  });
```

## Event Handlers in Aggregate Builders

### withEventHandler() in Builders
For simple aggregates, you can use the builder to define event handlers.

```typescript
import { withEventHandler } from 'effect-ddd';

const SimpleOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withEventHandler('OrderPlaced', (event) => {
    console.log(`Order placed: ${event.aggregateId}`);
    // Trigger side effects:
    // - Send confirmation email
    // - Update inventory
    // - Create shipping record
  }),
  withEventHandler('OrderCancelled', (event) => {
    console.log(`Order cancelled: ${event.payload.reason}`);
    // Trigger side effects:
    // - Release inventory
    // - Send cancellation email
    // - Update analytics
  }),
  buildAggregateRoot
);
```

### Event Handler Signature
```typescript
type EventHandlerFunction = (event: IDomainEvent) => void;
```

## Event Repository and Persistence

### IDomainEventRepository Interface
Repository interface for persisting and retrieving domain events.

```typescript
interface IDomainEventRepository {
  save(event: IDomainEvent): Effect.Effect<void, BaseException, never>;
  getUnhandledEvents(): Effect.Effect<IDomainEvent[], BaseException, never>;
  markAsHandled(eventId: string): Effect.Effect<void, BaseException, never>;
}
```

### Usage with Repository
```typescript
import { DomainEventRepositoryContext } from 'effect-ddd';

const saveAndMarkHandled = (event: IDomainEvent) =>
  Effect.gen(function* () {
    const repository = yield* DomainEventRepositoryContext;
    
    yield* repository.save(event);
    // Process event...
    yield* repository.markAsHandled(event.id);
  });
```

## Common Patterns

### Aggregate Command with Events
```typescript
// In aggregate command
const addItemCommand = (item: OrderItem) => (order: Order, correlationId: string) =>
  Effect.gen(function* () {
    // Business logic validation
    if (order.props.status !== 'draft') {
      return yield* Effect.fail(ValidationException.new('ORDER_LOCKED', 'Cannot modify'));
    }

    // Create domain events
    const domainEvents = [
      DomainEventTrait.create({
        name: 'OrderItemAdded',
        payload: { item, newTotal: calculateTotal([...order.props.items, item]) },
        correlationId,
        aggregate: order,
      }),
    ];

    // Return updated state with events
    return BaseOrderTrait.parse({
      ...order.props,
      items: [...order.props.items, item],
      domainEvents: [...order.domainEvents, ...domainEvents],
    });
  });
```

### Event Processing with Effect
```typescript
const processOrderEvents = (order: Order) =>
  Effect.gen(function* () {
    const publisher = yield* DomainEventPublisherContext;
    
    // Process all pending events
    for (const event of order.domainEvents) {
      yield* publisher.publish(event);
    }
    
    // Clear events after publishing
    return { ...order, domainEvents: [] };
  });
```

### Event Handler Registry
```typescript
// For complex aggregates, implement handlers separately
const OrderEventHandlers = {
  OrderPlaced: (event: IDomainEvent) => {
    // Send email confirmation
    console.log(`Sending confirmation for order ${event.aggregateId}`);
  },
  
  OrderShipped: (event: IDomainEvent) => {
    // Update tracking information
    console.log(`Order ${event.aggregateId} has been shipped`);
  },
  
  OrderCancelled: (event: IDomainEvent) => {
    // Handle cancellation
    console.log(`Order ${event.aggregateId} cancelled: ${event.payload.reason}`);
  },
};

// Process event by type
const handleEvent = (event: IDomainEvent) => {
  const handler = OrderEventHandlers[event.name as keyof typeof OrderEventHandlers];
  if (handler) {
    handler(event);
  }
};
```

## Event Bus Integration

### IEventBus Interface
Simple event bus interface for immediate event publication.

```typescript
interface IEventBus {
  publish(event: IDomainEvent): void;
}
```

## Best Practices

### Event Design
1. **Use past tense names**: 'OrderPlaced', 'ItemAdded', 'PaymentProcessed'
2. **Include relevant data**: Event payload should contain all necessary information
3. **Keep events immutable**: Once created, events should not be modified
4. **Use correlation IDs**: Enable tracing across service boundaries

### Event Handling
1. **Keep handlers simple**: Event handlers should trigger side effects, not complex logic
2. **Handle failures gracefully**: Use Effect error handling for event processing
3. **Ensure idempotency**: Event handlers should be safe to run multiple times
4. **Separate concerns**: Use different handlers for different types of side effects

### Performance Considerations
1. **Batch event publishing**: Use `publishAll()` for multiple events
2. **Async processing**: Use Effect for non-blocking event handling
3. **Event ordering**: Consider event sequence when processing multiple events
4. **Persistence strategy**: Choose appropriate event storage based on requirements

### Builder Usage
- **Simple aggregates (1-3 event types)**: Use `withEventHandler()` in builders
- **Complex aggregates (4+ event types)**: Implement handlers separately for better maintainability
- **Event sourcing**: Consider separate event sourcing implementation for complex scenarios

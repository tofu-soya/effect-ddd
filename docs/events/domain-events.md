# Domain Events

Domain events represent meaningful business occurrences in your domain.

## Creating Events

```typescript
import { DomainEventTrait } from 'effect-ddd';

const orderPlaced = DomainEventTrait.create({
  name: 'ORDER_PLACED',
  payload: {
    orderId: '123',
    amount: 100
  },
  correlationId: 'cmd-123',
  aggregate: order
});
```

## Event Structure

- `name`: Business event name
- `payload`: Event data
- `correlationId`: Trace ID
- `aggregate`: Source aggregate (optional)
- `timestamp`: When event occurred

## Publishing Events

```typescript
import { IDomainEventPublisher } from 'effect-ddd';

const publishOrderPlaced = (order: Order) =>
  Effect.gen(function* () {
    const event = DomainEventTrait.create({
      name: 'ORDER_PLACED',
      payload: order.unpack(),
      correlationId: order.correlationId,
      aggregate: order
    });

    yield* IDomainEventPublisher.publish(event);
  });
```

## Event Handlers

```typescript
import { withEventHandler } from 'effect-ddd';

const OrderTrait = pipe(
  createAggregateRoot('Order'),
  withEventHandler('ORDER_PLACED', (event) => {
    // Send confirmation email
    // Update reporting
    // etc
  })
);
```

## Event Sourcing

For event-sourced aggregates:

```typescript
const OrderTrait = pipe(
  createEventSourcedAggregate('Order'),
  withEventReducer('ORDER_CREATED', (event, order) => ({
    ...order,
    status: 'created'
  })),
  withEventReducer('ORDER_PAID', (event, order) => ({
    ...order, 
    status: 'paid'
  }))
);
```

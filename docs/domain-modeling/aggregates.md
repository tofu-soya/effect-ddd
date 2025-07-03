# Aggregate Roots

Aggregate Roots are special Entities that form a consistency boundary for a cluster of domain objects. All operations within the aggregate boundary go through the Aggregate Root.

## Defining Aggregate Roots

1. **Define Properties (Props Type):** Define the aggregate's properties (`YourARProps`).
2. **Define AggregateRoot Type:** Extend the generic `AggregateRoot` type.
3. **Define Trait Interface:** Create an interface (`IYourARTrait`) that extends `AggregateRootTrait<YourAR, NewParams, ParseParams>`.
4. **Initiate Configuration:** Use `createAggregateRoot<YourARProps, NewParams>(tag: string)`.
5. **Define Structure and Validation:** Use `withSchema()`.
6. **Add Aggregate Commands:** Use `withAggregateCommand()` which can return domain events.
7. **Add Event Handlers:** Use `withEventHandler()` to process domain events.
8. **Build the Trait:** Call `buildAggregateRoot()`.

## Example: Order Aggregate

```typescript
import { Effect, pipe } from 'effect';
import {
  createAggregateRoot,
  withAggregateCommand,
  buildAggregateRoot,
  AggregateRoot,
  ValidationException,
} from 'effect-ddd';

type OrderProps = {
  customerId: string;
  items: OrderItem[];
  status: 'draft' | 'confirmed';
};

export type Order = AggregateRoot<OrderProps>;

export interface IOrderTrait extends AggregateRootTrait<Order, OrderInput> {
  addItem(item: OrderItem): CommandOnModel<Order>;
}

export const OrderTrait: IOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withAggregateCommand('addItem', (item, props, aggregate, correlationId) =>
    Effect.gen(function* () {
      if (props.status !== 'draft') {
        return yield* Effect.fail(
          ValidationException.new('ORDER_LOCKED', 'Cannot modify order')
        );
      }
      
      const event = DomainEventTrait.create({
        name: 'ItemAdded',
        payload: { item },
        correlationId,
        aggregate
      });

      return {
        props: { ...props, items: [...props.items, item] },
        domainEvents: [event]
      };
    }),
  buildAggregateRoot,
);
```

## Key Differences from Entities

1. **Consistency Boundary:** Aggregates maintain invariants across multiple objects
2. **Domain Events:** Commands can emit domain events
3. **Single Access Point:** All changes go through the Aggregate Root

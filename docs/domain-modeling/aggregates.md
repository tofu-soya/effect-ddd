# Aggregate Roots

Aggregate Roots are special Entities that form a consistency boundary for domain objects and can emit domain events.

## Core Interface

```typescript
export interface AggregateRoot<Props extends Record<string, unknown>> extends Entity<Props> {
  readonly domainEvents: ReadonlyArray<IDomainEvent>;
}

export interface AggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown,
> extends EntityTrait<A, NewParams, ParseParams> {
  // Core Methods provided by trait
  new(params: NewParams): Effect.Effect<A, ValidationException>;
  parse(data: ParseParams): Effect.Effect<A, ValidationException>;
}
```

## Defining Aggregate Roots

**Recommended Pattern** for aggregates with many commands/queries (better TypeScript LSP performance):

### Step 1: Define Types
```typescript
type OrderProps = {
  customerId: string;
  items: OrderItem[];
  status: 'draft' | 'confirmed';
  total: number;
};

type OrderInput = { customerId: string };
export type Order = AggregateRoot<OrderProps>;
```

### Step 2: Define Schema
```typescript
const OrderSchema = Schema.Struct({
  customerId: Schema.String,
  items: Schema.Array(OrderItemSchema),
  status: Schema.Literal('draft', 'confirmed'),
  total: Schema.Number,
});
```

### Step 3: Create Base Trait (using builders as utilities)
```typescript
const BaseOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  buildAggregateRoot
);
```

> **📖 See:** [Aggregate Trait Builder Guide](./aggregate-trait-builder.md) for detailed builder API documentation

### Step 4: Define Trait Interface
```typescript
export interface IOrderTrait extends AggregateRootTrait<Order, OrderInput, OrderInput> {
  // Queries
  getItemCount(order: Order): number;
  getTotal(order: Order): number;
  
  // Commands  
  addItem(item: OrderItem): (order: Order, correlationId?: string) => Effect.Effect<Order, ValidationException>;
  confirmOrder(): (order: Order, correlationId?: string) => Effect.Effect<Order, ValidationException>;
}
```

### Step 5: Implement Domain Logic
```typescript
export const OrderTrait: IOrderTrait = {
  // Inherit basic operations (new, parse)
  ...BaseOrderTrait,
  
  // Implement domain queries
  getItemCount: (order) => order.props.items.length,
  getTotal: (order) => order.props.total,
  
  // Implement domain commands
  addItem: (item) => (order, correlationId) =>
    Effect.gen(function* () {
      if (order.props.status !== 'draft') {
        return yield* Effect.fail(ValidationException.new('ORDER_LOCKED', 'Cannot modify'));
      }

      const domainEvents = [
        DomainEventTrait.create({
          name: 'OrderItemAdded',
          payload: { item },
          correlationId: correlationId || IdentifierTrait.uuid(),
          aggregate: order,
        }),
      ];

      return BaseOrderTrait.parse({
        ...order.props,
        items: [...order.props.items, item],
        domainEvents: [...order.domainEvents, ...domainEvents],
      });
    }),
};
```

## Usage

```typescript
const order = await Effect.runPromise(OrderTrait.new({ customerId: 'cust-1' }));
console.log(OrderTrait.getItemCount(order)); // 0

const updatedOrder = await Effect.runPromise(
  OrderTrait.addItem({ productId: 'P1', quantity: 1, price: 100 })(order)
);
console.log(OrderTrait.getItemCount(updatedOrder)); // 1
```

## Builder Functions as Utilities

- `createAggregateRoot()` / `buildAggregateRoot()` are **trait building utilities**
- They provide basic `new`, `parse` operations and schema validation
- **Not intended** for complex domain logic (use normal methods instead for better LSP performance)

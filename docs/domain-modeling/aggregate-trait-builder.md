# Aggregate Root Trait Builder

**File:** `docs/domain-modeling/aggregate-trait-builder.md`

## Overview

The Aggregate Root Trait Builder provides utilities for creating basic aggregate root traits with validation and core operations (`new`, `parse`). For complex aggregates with many commands/queries, use this builder only for scaffolding and implement domain logic as separate methods.

## Core Interface

### AggregateRootTrait
```typescript
export interface AggregateRootTrait<
  A extends AggregateRoot,
  NewParams = unknown,
  ParseParams = unknown,
> extends EntityTrait<A, NewParams, ParseParams> {}
```

### Core Methods Provided
```typescript
// Create new aggregate instance
new(params: NewParams): Effect.Effect<A, ValidationException>

// Parse from external data  
parse(data: ParseParams): Effect.Effect<A, ValidationException>
```

## Builder API

### Step 1: Initialize Builder
```typescript
import { createAggregateRoot } from 'effect-ddd';

const config = createAggregateRoot<AggregateProps, NewParams>('AggregateName');
```

### Step 2: Add Validation
```typescript
import { withSchema, withInvariant, withValidation } from 'effect-ddd';

// Option A: Use Effect Schema
const configWithSchema = pipe(
  config,
  withSchema(AggregateSchema)
);

// Option B: Use custom parser (alternative to schema)
const configWithParser = pipe(
  config,
  withPropsParser(customParserFunction)
);

// Add business invariants
const configWithInvariant = pipe(
  configWithSchema,
  withInvariant(
    (props) => props.items.length > 0,
    'Aggregate must have at least one item',
    'EMPTY_AGGREGATE'
  )
);

// Add custom validation
const configWithValidation = pipe(
  configWithInvariant,
  withValidation((props) => 
    props.total >= 0 
      ? Effect.succeed(props)
      : Effect.fail(ValidationException.new('INVALID_TOTAL', 'Total must be non-negative'))
  )
);
```

### Step 3: Build Trait
```typescript
import { buildAggregateRoot } from 'effect-ddd';

const BaseAggregateTrait = pipe(
  configWithValidation,
  buildAggregateRoot
);
```

## Complete Example

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  createAggregateRoot,
  withSchema,
  withInvariant,
  buildAggregateRoot,
  AggregateRoot,
  AggregateRootTrait,
  ValidationException,
} from 'effect-ddd';

// 1. Define types
type OrderProps = {
  customerId: string;
  items: OrderItem[];
  status: 'draft' | 'confirmed' | 'shipped';
  total: number;
};

type OrderInput = {
  customerId: string;
};

export type Order = AggregateRoot<OrderProps>;

// 2. Define schema
const OrderSchema = Schema.Struct({
  customerId: Schema.String.pipe(Schema.minLength(1)),
  items: Schema.Array(OrderItemSchema),
  status: Schema.Literal('draft', 'confirmed', 'shipped'),
  total: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
});

// 3. Build base trait using builder utilities
const BaseOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withInvariant(
    (props) => props.status === 'draft' || props.items.length > 0,
    'Confirmed orders must have items',
    'EMPTY_CONFIRMED_ORDER'
  ),
  withInvariant(
    (props) => {
      const calculatedTotal = props.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return Math.abs(props.total - calculatedTotal) < 0.01;
    },
    'Total must match sum of item prices',
    'TOTAL_MISMATCH'
  ),
  buildAggregateRoot
);

// 4. Export for use in domain trait implementation
export { BaseOrderTrait };
```

## Usage in Domain Trait

```typescript
// In your main domain file
import { BaseOrderTrait } from './order-base-trait';

export interface IOrderTrait extends AggregateRootTrait<Order, OrderInput, OrderInput> {
  // Domain queries
  getItemCount(order: Order): number;
  getTotal(order: Order): number;
  
  // Domain commands
  addItem(item: OrderItem): (order: Order) => Effect.Effect<Order, ValidationException>;
}

export const OrderTrait: IOrderTrait = {
  // Inherit builder-provided methods (new, parse)
  ...BaseOrderTrait,
  
  // Implement domain-specific logic
  getItemCount: (order) => order.props.items.length,
  getTotal: (order) => order.props.total,
  
  addItem: (item) => (order) =>
    Effect.gen(function* () {
      // Domain logic here...
      return BaseOrderTrait.parse({
        ...order.props,
        items: [...order.props.items, item],
      });
    }),
};
```

## Builder Functions Reference

### Core Builders
- `createAggregateRoot<Props, NewParams>(tag: string)` - Initialize aggregate builder

### Validation
- `withSchema(schema: Schema.Schema)` - Add Effect Schema validation
- `withPropsParser(parser: PropsParser)` - Add custom parsing logic (alternative to schema)
- `withInvariant(predicate, message, code?)` - Add business rule validation
- `withValidation(validator)` - Add custom validation function

### Query and Command Builders (Use with Caution)
- `withQuery(name, queryFn)` - Add query method to trait
- `withAggregateCommand(name, commandFn)` - Add command method to trait

### Finalization
- `buildAggregateRoot(config)` - Create the base aggregate trait

## Best Practices

1. **Use builders for scaffolding only** - Provides `new`, `parse`, and validation
2. **Implement domain logic separately** - Better TypeScript LSP performance
3. **Keep invariants in builders** - Structural and data consistency rules
4. **Domain commands as methods** - Complex business logic outside builders
5. **Export base trait** - Reuse builder output in domain implementations

## withQuery() and withAggregateCommand() Usage

### For Simple Aggregates (Recommended)

When your aggregate has only a few queries/commands, you can use the builder methods:

```typescript
const SimpleOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withQuery('getItemCount', (props) => props.items.length),
  withQuery('getTotal', (props) => props.total),
  withAggregateCommand('addItem', (item, props, aggregate, correlationId) =>
    Effect.gen(function* () {
      if (props.status !== 'draft') {
        return yield* Effect.fail(ValidationException.new('ORDER_LOCKED', 'Cannot modify'));
      }

      return {
        props: { ...props, items: [...props.items, item] },
        domainEvents: [
          DomainEventTrait.create({
            name: 'ItemAdded',
            payload: { item },
            correlationId,
            aggregate,
          })
        ],
      };
    })
  ),
  buildAggregateRoot
);
```

### For Complex Aggregates (Not Recommended)

❌ **Avoid this pattern for aggregates with many operations:**

```typescript
// This will hurt TypeScript LSP performance
const ComplexOrderTrait = pipe(
  createAggregateRoot<OrderProps, OrderInput>('Order'),
  withSchema(OrderSchema),
  withQuery('getItemCount', (props) => props.items.length),
  withQuery('getTotal', (props) => props.total),
  withQuery('getStatus', (props) => props.status),
  withQuery('getCustomerId', (props) => props.customerId),
  withQuery('canModify', (props) => props.status === 'draft'),
  // ... many more queries
  withAggregateCommand('addItem', addItemHandler),
  withAggregateCommand('removeItem', removeItemHandler),
  withAggregateCommand('updateQuantity', updateQuantityHandler),
  withAggregateCommand('confirmOrder', confirmOrderHandler),
  withAggregateCommand('cancelOrder', cancelOrderHandler),
  // ... many more commands
  buildAggregateRoot // <- TypeScript will struggle here
);
```

### API Signatures

#### withQuery()
```typescript
withQuery<K extends string, R>(
  name: K,
  queryFn: (props: AggregateProps) => R
): (config: AggregateConfig) => AggregateConfig & { queries: Record<K, QueryFn> }
```

#### withAggregateCommand()
```typescript
withAggregateCommand<K extends string, I>(
  name: K,
  commandFn: (
    input: I,
    props: AggregateProps,
    aggregate: Aggregate,
    correlationId: string
  ) => Effect.Effect<
    { props: AggregateProps; domainEvents: IDomainEvent[] },
    ValidationException
  >
): (config: AggregateConfig) => AggregateConfig & { commands: Record<K, CommandFn> }
```

## Performance Notes

- **Small aggregates (1-3 operations)**: `withQuery()` and `withAggregateCommand()` are fine
- **Complex aggregates (4+ operations)**: Use builders for scaffolding only, implement methods separately
- **TypeScript LSP**: Deep builder chains slow down autocomplete and type checking
- **Compilation speed**: Fewer builder methods = faster TypeScript compilation
# Effect-Based Domain Model Implementation

This documentation covers the Effect-based implementations of domain primitives including Value Objects, Entities, Aggregate Roots, and Domain Events.

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Value Objects](#value-objects)
3. [Entities](#entities)
4. [Aggregate Roots](#aggregate-roots)
5. [Domain Events](#domain-events)
6. [Validation](#validation)
7. [Repository Pattern](#repository-pattern)
8. [Usage Examples](#usage-examples)

## Core Concepts

### DomainModel
The base type for all domain objects with:
- `_tag`: Type identifier
- `props`: Immutable properties
- `createdAt`: Creation timestamp

### Effect Integration
All operations return `Effect` monads for:
- Type-safe error handling
- Dependency management
- Pure functional programming

## Value Objects

### Definition
Immutable objects identified by their attributes:
```typescript
interface ValueObject<Props> extends DomainModel<Props> {}
```

### Implemented Value Objects
1. **Username**
   - 1-20 characters
   - No leading/trailing underscores/dots
   - Alphanumeric with limited special chars

2. **FirstLastName**
   - Minimum 2 chars
   - No special symbols/numbers

3. **Email**
   - Valid email format

4. **PhoneNumber**
   - Valid international phone format

5. **VNPhoneNumber**
   - Valid Vietnam-specific phone format

### Usage
```typescript
import { Username, Email } from './value-object';

const username = Username.parse("validUser123");
const email = Email.parse("test@example.com");
```

## Entities

### Definition
Mutable objects with identity:
```typescript
interface Entity<Props> extends DomainModel<Props> {
  id: Identifier;
  updatedAt: Option<Date>;
}
```

### Features
- Identity tracking
- Timestamp management
- Property validation
- Command pattern support

### Example Entity
```typescript
const UserTrait = createEntityTrait(
  (input) => validateUserProps(input),
  "User"
);

const user = UserTrait.parse({ 
  id: "123", 
  name: "John Doe",
  email: "john@example.com" 
});
```

## Aggregate Roots

### Definition
Entities that enforce consistency boundaries:
```typescript
interface AggregateRoot<Props> extends Entity<Props> {
  domainEvents: IDomainEvent[];
}
```

### Features
- Domain event collection
- Transactional consistency
- Command pattern with events

### Example
```typescript
const OrderTrait = createAggregateRootTrait(
  validateOrderProps,
  "Order"
);

const order = OrderTrait.parse(orderData);
```

## Domain Events

### Definition
Immutable records of domain occurrences:
```typescript
interface IDomainEvent<P> {
  name: string;
  metadata: {
    timestamp: number;
    correlationId: string;
  };
  payload: P;
}
```

### Features
- Event publishing
- Event persistence
- Event handling

### Example
```typescript
const event = {
  name: "OrderCreated",
  metadata: { timestamp: Date.now(), correlationId: "123" },
  payload: { orderId: "456" }
};

Effect.runPromise(domainEventPublisher.publish(event));
```

## Validation

### Approach
- Schema-based validation using Effect Schema
- Branded types for domain primitives
- Custom error messages

### Example Validator
```typescript
const Username = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(20),
  Schema.brand("Username")
);
```

## Repository Pattern

### Interface
```typescript
interface RepositoryPort<A extends AggregateRoot> {
  save(aggregate: A): Effect<void, BaseException>;
  findById(id: Identifier): Effect<A, BaseException>;
  // ...other CRUD operations
}
```

### Features
- Generic repository interface
- Effect-based error handling
- Optional pagination/sorting

## Best Practices

1. **Immutability**: All domain objects are immutable
2. **Validation**: Validate at creation boundaries
3. **Effect**: Use for all side effects
4. **Domain Events**: Capture all state changes
5. **Aggregates**: Keep small and focused

## Type Safety

The implementation leverages:
- Branded types
- Effect Schema
- Type predicates
- Generic traits

This ensures compile-time safety for all domain operations.

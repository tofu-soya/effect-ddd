# Effect Domain Model API Documentation

This document provides comprehensive API documentation for building domain models using Effect's functional programming capabilities.

## Table of Contents
1. [Core Building Blocks](#core-building-blocks)
2. [Value Objects](#value-objects)
3. [Entities](#entities) 
4. [Aggregate Roots](#aggregate-roots)
5. [Domain Events](#domain-events)
6. [Repositories](#repositories)
7. [Testing Utilities](#testing-utilities)
8. [Best Practices](#best-practices)

## Core Building Blocks

### Base Types

#### `ValueObject<Props>`
Base type for immutable domain concepts.

#### `Entity<Props>`
Base type for mutable domain objects with identity.

#### `AggregateRoot<Props>`
Extends `Entity` with domain event capabilities.

### Traits (Interfaces)

#### `ValueObjectTrait<VO, N, P>`
```typescript
interface ValueObjectTrait<VO extends ValueObject, N, P> {
  parse: (raw: P) => Effect.Effect<VO, ValidationException>
  new: (params: N) => Effect.Effect<VO, ValidationException>
}
```

#### `EntityTrait<E, N, P>`
```typescript
interface EntityTrait<E extends Entity, N, P> {
  parse: (raw: P) => Effect.Effect<E, ValidationException>
  new: (params: N) => Effect.Effect<E, ValidationException>
  asCommand: <I>(handler: CommandHandler<E, I>) => CommandOnModel<E>
}
```

#### `AggregateRootTrait<A, N, P>`
Extends `EntityTrait` with domain event capabilities.

## Value Objects

### Creating a Value Object

```typescript
import { Schema, Effect } from 'effect'
import { ValueObjectGenericTrait } from './effect'

// Define props type
type EmailProps = {
  value: string
}

// Create trait
const EmailTrait = ValueObjectGenericTrait.createValueObjectTrait<Email, string>(
  (raw) => 
    Schema.decode(Schema.String.pipe(
      Schema.email(),
      Schema.brand('Email')
    ))(raw),
  'Email'
)

// Usage
const email = EmailTrait.new('test@example.com')
```

### Common Value Objects

Pre-built value objects available:

- `NonEmptyString`
- `PositiveNumber`
- `URL`
- `Email`
- `PhoneNumber`

## Entities

### Creating an Entity

```typescript
import { EntityGenericTrait } from './effect'

type UserProps = {
  name: string
  email: string
}

const UserTrait = EntityGenericTrait.createEntityTrait<User, UserProps>(
  (params) => Effect.gen(function* () {
    const name = yield* NonEmptyStringTrait.parse(params.name)
    const email = yield* EmailTrait.parse(params.email)
    return { name, email }
  }),
  'User'
)
```

### Entity Commands

```typescript
const updateEmail = EntityGenericTrait.asCommand<User, string>(
  (newEmail, props) => 
    EmailTrait.parse(newEmail).pipe(
      Effect.map(email => ({ 
        props: { ...props, email } 
      }))
    )
)
```

## Aggregate Roots

### Creating an Aggregate

```typescript
import { AggGenericTrait } from './effect'

type OrderProps = {
  items: OrderItem[]
  status: OrderStatus
}

const OrderTrait = AggGenericTrait.createAggregateRootTrait<Order, OrderProps>(
  (params) => /* parsing logic */,
  'Order'
)
```

### Domain Events

```typescript
const addItem = AggGenericTrait.asCommand<Order, OrderItem>(
  (item, props, order) => 
    Effect.succeed({
      props: { ...props, items: [...props.items, item] },
      domainEvents: [
        DomainEventTrait.create({
          name: 'ITEM_ADDED',
          payload: { itemId: item.id },
          correlationId: '123',
          aggregate: order  
        })
      ]
    })
)
```

## Domain Events

### Event Creation

```typescript
const event = DomainEventTrait.create({
  name: 'USER_REGISTERED',
  payload: { userId: '123' },
  correlationId: '456',
  aggregate: userAggregate
})
```

### Event Publishing

```typescript
// Get publisher from context
const publisher = yield* DomainEventPublisherContext

// Publish single event
yield* publisher.publish(event)

// Publish multiple events  
yield* publisher.publishAll([event1, event2])
```

## Repositories

### Repository Interface

```typescript
interface RepositoryPort<A extends AggregateRoot> {
  save(aggregate: A): Effect.Effect<void, BaseException>
  findById(id: string): Effect.Effect<A, NotFoundException>
  // ...other CRUD methods
}
```

### Example Implementation

```typescript
class UserRepository implements RepositoryPort<User> {
  save(user: User) {
    return db.save(user).pipe(
      Effect.mapError(() => OperationException.new('SAVE_FAILED', 'Failed to save user'))
    )
  }
  // ...other methods
}
```

## Testing Utilities

### Mock Event Repository

```typescript
import { MockDomainEventRepositoryLayer } from './effect'

const testLayer = MockDomainEventRepositoryLayer.pipe(
  Layer.provide(otherDependencies)
)

Effect.runPromise(
  Effect.provide(
    myService,
    testLayer
  )
)
```

## Best Practices

1. **Validation**:
   - Validate at value object boundaries
   - Use Schema for structural validation
   - Add domain invariants in entity/aggregate traits

2. **Error Handling**:
   ```typescript
   Effect.mapError(error => 
     ValidationException.new('INVALID_EMAIL', 'Invalid email format', {
       details: [error.message]
     })
   )
   ```

3. **Testing**:
   - Use mock implementations
   - Test domain invariants
   - Verify event emission

4. **Design**:
   - Keep aggregates small
   - Make value objects immutable
   - Use domain events for side effects

## Core Concepts

### 1. Aggregate Root

The root entity that maintains consistency boundaries in the domain.

#### Key Types:
- `AggregateRoot<Props>`: Extends Entity with domain events capability
- `WithAggregateMetaInput<OriginInput>`: Input type for aggregate creation
- `AggregatePropsParser<A, I>`: Parser for aggregate properties
- `AggregateRootTrait<A, N, P>`: Trait interface for aggregate operations
- `IAggGenericTrait`: Generic aggregate operations implementation

#### Key Operations:
- Managing domain events (add/clear/get)
- Command pattern implementation via `asCommand`
- Creation via `createAggregateRootTrait`
- Query operations via `asQuery` and `asQueryOpt`

### 2. Domain Events

Events representing significant state changes in the domain.

#### Key Types:
- `IDomainEvent<P>`: Interface for domain events
- `IDomainEventTrait`: Factory for creating domain events
- `IDomainEventRepository`: Persistence interface for events
- `IDomainEventPublisher`: Publishing interface for events

#### Key Operations:
- Event creation with metadata (correlationId, causationId etc)
- Event persistence (save, mark as handled)
- Event publishing (single or multiple)

### 3. Value Objects

Immutable objects representing domain concepts.

#### Key Types:
- `ValueObject<Props>`: Base value object type
- `ValueObjectTrait<VO, N, P>`: Trait interface for value objects
- `PrimitiveVOTrait`: For simple value objects like NonEmptyString

#### Key Operations:
- Validation via Schema
- Parsing from raw inputs
- Type branding for domain safety

### 4. Entities

Mutable domain objects with identity.

#### Key Types:
- `Entity<Props>`: Base entity type
- `EntityTrait<E, N, P>`: Trait interface for entities
- `IEntityGenericTrait`: Generic entity operations

#### Key Operations:
- Lifecycle tracking (createdAt/updatedAt)
- Identity management
- Command operations via `asCommand`

## Implementation Patterns

### Aggregate Root Implementation

```typescript
// Example aggregate creation
const CandidateTrait = AggGenericTrait.createAggregateRootTrait(
  (params: CandidateParam) => Effect.gen(function* () {
    const person = yield* personTrait.parse(params)
    return {
      person,
      linkedInId: params.linkedInId,
      cvs: params.cvs
    }
  }),
  'Candidate'
)

// Example command with domain events
const addCV = AggGenericTrait.asCommand<Candidate, CVParam>(
  (cvParam, props, candidate) => {
    return pipe(
      cvTrait.new(cvParam),
      Effect.map((newCV) => ({
        props: { ...props, cvs: [...props.cvs, newCV] },
        domainEvents: [
          DomainEventTrait.create({
            name: 'CV_ADDED',
            payload: { cvId: newCV.id },
            correlationId: IdentifierTrait.uuid(),
            aggregate: candidate
          })
        ]
      }))
    )
  }
)
```

### Value Object Implementation

```typescript
// Simple value object
const NonEmptyString = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('NonEmptyString')
)

// Complex value object
const EducationTrait = ValueObjectGenericTrait.createValueObjectTrait<
  Education,
  EducationParam
>((params) => {
  const Props = Schema.Struct({
    schoolId: Identifier,
    rate: EducationRateSchema,
    level: Schema.Enums(EducationLevel)
  })
  
  if (params.startDate > params.endDate) {
    return Effect.fail(ValidationException.new(
      'INVALID_DATES', 
      'Start date must be before end date'
    ))
  }
  
  return pipe(
    Schema.decode(Props)(params),
    Effect.map((validated) => ({
      ...validated,
      startDate: params.startDate,
      endDate: params.endDate
    }))
  )
}, 'Education')
```

### Entity Implementation

```typescript
const CVTrait = EntityGenericTrait.createEntityTrait<CV, CVParam>(
  (params) => pipe(
    Effect.all({
      version: Schema.decode(PositiveNumber)(params.version),
      summary: Schema.decode(NonEmptyString)(params.summary)
    }),
    Effect.map(({version, summary}) => ({
      version,
      summary,
      companies: params.companies,
      educations: params.educations
    }))
  ),
  'CV'
)

// Update command
const updateCV = EntityGenericTrait.asCommand<CV, UpdateParam>(
  (params, props) => {
    const updated = {
      ...props,
      summary: Option.getOrElse(() => props.summary)(params.summary),
      companies: Option.getOrElse(() => props.companies)(params.companies)
    }
    return Effect.succeed({ props: updated })
  }
)
```

## Domain Event Flow

1. **Creation**: Events are created via `DomainEventTrait.create()`
2. **Persistence**: Saved via `IDomainEventRepository.save()`
3. **Publication**: Published via `IDomainEventPublisher.publish()`
4. **Processing**: Marked as handled via `markAsHandled()`

## Testing Setup

```typescript
const testLayer = MockDomainEventRepositoryLayer.pipe(
  Layer.provide(testLoggerLayer)
)

Effect.runPromise(
  Effect.provide(
    myDomainService,
    testLayer
  )
)
```

## Best Practices

1. **Aggregate Design**:
   - Keep aggregates small and focused
   - Maintain consistency boundaries
   - Use value objects for domain concepts

2. **Event Sourcing**:
   - Always include correlation IDs
   - Make events meaningful and descriptive
   - Keep event payloads minimal

3. **Validation**:
   - Validate at value object creation
   - Use Schema for structural validation
   - Add domain invariants in aggregate/entity traits

4. **Error Handling**:
   - Use specific exception types (Validation, NotFound etc)
   - Include helpful error messages
   - Structure errors with codes and metadata

5. **Testing**:
   - Use mock implementations for isolation
   - Test domain invariants
   - Verify event emission
````

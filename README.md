# Effect Domain Modeling Library

A functional approach to Domain-Driven Design (DDD) in TypeScript using the Effect ecosystem.

## Key Features

- Railway-oriented domain modeling with Effect
- Immutable value objects and entities 
- Aggregate roots with domain events
- Repository pattern implementation
- Comprehensive validation and error handling
- Test utilities for domain logic

## Installation

```bash
yarn add node-ts-seedwork
```

## Quick Start

```typescript
import { 
  Effect, 
  Schema,
  pipe 
} from 'effect'
import {
  ValueObjectGenericTrait,
  NonEmptyString,
  EntityGenericTrait,
  AggGenericTrait,
  DomainEventTrait
} from 'yl-ddd-ts'

// Define a value object
const EmailTrait = ValueObjectGenericTrait.createValueObjectTrait(
  (raw: string) => Schema.decode(Schema.String.pipe(
    Schema.email(),
    Schema.brand('Email')
  ))(raw),
  'Email'
)

// Create an entity
const UserTrait = EntityGenericTrait.createEntityTrait(
  (params: {name: string, email: string}) => 
    Effect.all({
      name: Schema.decode(NonEmptyString)(params.name),
      email: EmailTrait.new(params.email)
    }),
  'User'
)

// See full documentation for more examples
```

## Documentation

For comprehensive usage guides and API documentation, see:  
📖 [Effect Domain Model User Guide](./docs/user-guide.md)

## Philosophy

This library combines Domain-Driven Design with functional programming principles:

- Focuses on essential complexity over accidental complexity
- Uses railway-oriented programming for error handling  
- Immutable domain objects by default
- Clear separation of domain logic from infrastructure

> "Functional programming helps us focus on the what rather than the how"  
> - Eric Evans, Domain-Driven Design

## When to Use

✅ Complex domains with rich business logic  
✅ Need for strong type safety and validation  
✅ Event-driven architectures  
✅ Team familiar with functional concepts

## When Not to Use

❌ Simple CRUD applications  
❌ Teams new to functional programming  
❌ Projects with tight performance constraints

## Contributing

Issues and PRs welcome! Please see:
- [Contribution Guidelines](./CONTRIBUTING.md)  
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## License

MIT © [Your Name]


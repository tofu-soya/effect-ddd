# Architecture Overview

**File:** `docs/architecture/overview.md`

## System Architecture

This library implements Domain-Driven Design patterns using functional programming principles with the Effect-ts ecosystem.

## Core Principles

1. **Immutability**: All domain objects are immutable by design
2. **Type Safety**: Extensive use of TypeScript for compile-time guarantees
3. **Functional Composition**: Pure functions with pipe-friendly APIs
4. **Effect Integration**: Native Effect-ts error handling and dependency injection

## Layer Architecture

```
Application Layer
├── Commands & Queries (CQRS)
├── Use Cases
└── Application Services

Domain Layer
├── Aggregate Roots
├── Entities
├── Value Objects
├── Domain Services
└── Domain Events

Infrastructure Layer
├── Repositories (TypeORM)
├── Event Bus (RabbitMQ)
├── External APIs
└── Database

Cross-Cutting Concerns
├── Validation (Effect Schema + Custom)
├── Logging
├── Error Handling
└── Dependency Injection
```

## Key Components

### Domain Models

- **Value Objects**: Immutable objects identified by attributes
- **Entities**: Objects with identity and lifecycle
- **Aggregate Roots**: Consistency boundaries with domain events

### Builders

- **Domain Builder**: Functional API for creating domain models
- **Schema Builder**: Composable validation schemas
- **Repository Factory**: TypeORM integration with Effect

## Decision Records

- [ADR-001: Domain Builder Enhancement](./decisions/001-domain-builder-enhancement.md)
- [ADR-002: File Organization](./decisions/002-file-organization-refactor.md)

## Patterns

See [Common Patterns](./patterns.md) for implementation guidelines.

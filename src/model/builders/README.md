# Domain Builder

**File:** `src/model/effect/builders/README.md`

## Overview

The Domain Builder provides a functional, composable API for creating domain models (Value Objects, Entities, and Aggregate Roots) with built-in validation, queries, and commands.

## Features

- **Dual Parsing Strategy**: Choose between Effect Schema (`withSchema`) or custom parsers (`withPropsParser`)
- **Functional Composition**: Clean, pipe-friendly API
- **Type Safety**: Full TypeScript inference
- **Query Methods**: Add computed properties to domain objects
- **Command Pattern**: Immutable updates with built-in validation

## Quick Start

### Value Object with Schema

```typescript
const EmailTrait = pipe(
  createValueObject('Email'),
  withSchema(EmailSchema),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  buildValueObject,
);
```

### Entity with Custom Parser

```typescript
const UserTrait = pipe(
  createEntity('User'),
  withPropsParser(customUserValidator),
  withCommand('activate', activateCommand),
  buildEntity,
);
```

## API Reference

### Core Functions

- `createValueObject(tag)` - Initialize value object builder
- `createEntity(tag)` - Initialize entity builder
- `createAggregateRoot(tag)` - Initialize aggregate root builder

### Configuration

- `withSchema(schema)` - Use Effect Schema for validation
- `withPropsParser(parser)` - Use custom parser function
- `withValidation(validator)` - Add additional validation
- `withInvariant(predicate, message)` - Add invariant checks

### Enhancements

- `withQuery(name, fn)` - Add computed property
- `withCommand(name, handler)` - Add entity command (entities only)
- `withAggregateCommand(name, handler)` - Add aggregate command (aggregates only)

### Builders

- `buildValueObject(config)` - Create value object trait
- `buildEntity(config)` - Create entity trait
- `buildAggregateRoot(config)` - Create aggregate root trait

## Examples

See [Domain Builder Examples](../../../docs/guides/examples/domain-builder-examples.md)

## Recent Updates

- **v2.1.0**: Added `withPropsParser()` for custom parsing logic
- **v2.0.0**: Migrated to Effect-ts ecosystem

See [Update History](../../../docs/updates/) for detailed change information.

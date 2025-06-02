# ADR-001: Domain Builder Dual Parsing Strategy

**File:** `docs/architecture/decisions/001-domain-builder-enhancement.md`  
**Status:** ✅ Accepted  
**Date:** 2024-12-15  
**Deciders:** Development Team  
**Technical Story:** Enable flexible domain model parsing strategies

## 🎯 Context and Problem Statement

The current Domain Builder only supports Effect Schema-based parsing via `withSchema()`. While this works well for simple validation scenarios, it creates limitations for:

1. **Complex Business Logic**: Multi-step validation processes that don't fit schema patterns
2. **Performance Requirements**: High-frequency parsing where schema compilation overhead matters
3. **External Integration**: Validation that requires API calls or database lookups
4. **Custom Error Handling**: Domain-specific error messages and handling logic
5. **Legacy Integration**: Migrating existing custom validation logic

### Decision Drivers

- **Flexibility**: Support both simple and complex domain modeling needs
- **Performance**: Allow optimization for critical parsing paths
- **Migration**: Enable gradual adoption without breaking existing code
- **Maintainability**: Keep API consistent and understandable
- **Type Safety**: Maintain full TypeScript inference

## 🎨 Considered Options

### Option 1: Schema-Only (Status Quo)

```typescript
const UserTrait = pipe(
  createEntity('User'),
  withSchema(UserSchema), // Only option
  buildEntity,
);
```

**Pros:**

- ✅ Simple, declarative approach
- ✅ Consistent API surface
- ✅ Leverages Effect Schema features

**Cons:**

- ❌ Limited flexibility for complex validation
- ❌ Performance overhead for simple cases
- ❌ Difficult to integrate business logic

### Option 2: Parser-Only

```typescript
const UserTrait = pipe(
  createEntity('User'),
  withPropsParser(customParser), // Only option
  buildEntity,
);
```

**Pros:**

- ✅ Maximum flexibility
- ✅ Performance control
- ✅ Easy business logic integration

**Cons:**

- ❌ More boilerplate for simple cases
- ❌ Loses Effect Schema benefits
- ❌ Breaking change for existing code

### Option 3: Dual Strategy (Selected)

```typescript
// Simple cases
const EmailTrait = pipe(
  createValueObject('Email'),
  withSchema(EmailSchema),
  buildValueObject,
);

// Complex cases
const OrderTrait = pipe(
  createAggregateRoot('Order'),
  withPropsParser(complexOrderParser),
  buildAggregateRoot,
);
```

**Pros:**

- ✅ Best of both worlds
- ✅ No breaking changes
- ✅ Gradual adoption path
- ✅ Performance optimization when needed

**Cons:**

- ❌ Slightly more complex API
- ❌ Two code paths to maintain

### Option 4: Hybrid Composition

```typescript
const UserTrait = pipe(
  createEntity('User'),
  withSchema(UserSchema),
  withCustomValidation(businessLogic),
  buildEntity,
);
```

**Pros:**

- ✅ Combines schema + custom logic
- ✅ Incremental enhancement

**Cons:**

- ❌ Complex interaction patterns
- ❌ Unclear precedence rules
- ❌ Potential for conflicts

## 🚀 Decision Outcome

**Chosen option:** **Option 3 - Dual Strategy**

### Implementation Details

#### 1. Priority-Based Parser Resolution

```typescript
const createPropsParser = (config) => (raw) => {
  // Priority 1: Custom parser takes precedence
  if (config.propsParser) {
    return applyValidators(config.propsParser(raw));
  }

  // Priority 2: Fall back to schema
  if (config.schema) {
    return applyValidators(Schema.decodeUnknown(config.schema)(raw));
  }

  // Priority 3: Clear error message
  return Effect.fail(ValidationException.new('NO_PARSER_CONFIGURED', ...));
};
```

#### 2. Mutual Exclusivity

Setting `withPropsParser` clears any existing `schema`, and vice versa, to prevent conflicts:

```typescript
const withPropsParser = (parser) => (config) => ({
  ...config,
  propsParser: parser,
  schema: undefined, // Clear schema to avoid conflicts
});

const withSchema = (schema) => (config) => ({
  ...config,
  schema: schema,
  propsParser: undefined, // Clear parser to avoid conflicts
});
```

#### 3. Enhanced Type Safety

Both approaches maintain full TypeScript inference and type safety.

### Justification

1. **Backward Compatibility**: Existing `withSchema` usage continues unchanged
2. **Progressive Enhancement**: Teams can adopt `withPropsParser` where needed
3. **Clear Semantics**: Mutual exclusivity prevents confusion
4. **Performance Flexibility**: Custom parsers can be optimized for specific use cases
5. **Business Logic Integration**: Complex domain rules can be embedded naturally

## 📊 Positive Consequences

- ✅ **Zero Breaking Changes**: All existing code continues to work
- ✅ **Flexibility**: Supports both simple and complex parsing needs
- ✅ **Performance**: Custom parsers can be optimized
- ✅ **Gradual Migration**: Teams can adopt new features incrementally
- ✅ **Clear API**: Mutual exclusivity prevents confusion
- ✅ **Type Safety**: Full TypeScript support for both approaches

## ⚠️ Negative Consequences

- ❌ **Increased Complexity**: Two parsing strategies to understand
- ❌ **Documentation Overhead**: Need to explain both approaches
- ❌ **Testing Surface**: More code paths to test
- ❌ **Decision Fatigue**: Developers need to choose the right approach

## 🔗 Links

- [Domain Builder Implementation](../../../src/model/effect/builders/domain-builder.ts)
- [Update Documentation](../../updates/v2.1.0-domain-builder.md)
- [Usage Examples](../../guides/examples/domain-builder-examples.md)
- [Migration Guide](../../guides/migration-guide.md)

## 📝 Follow-up Actions

- [ ] Implement `withPropsParser` function
- [ ] Update `createPropsParser` with priority logic
- [ ] Add comprehensive test coverage
- [ ] Create usage examples and documentation
- [ ] Update TypeScript type definitions
- [ ] Performance benchmarking for both approaches

---

**Supersedes:** None  
**Superseded by:** TBD  
**Related ADRs:**

- [ADR-002: File Organization Refactor](002-file-organization-refactor.md)
- [ADR-003: Effect Schema Integration](003-effect-schema-integration.md)

# Core Traits

## ValueObjectTrait

```typescript
interface ValueObjectTrait<VO, N, P> {
  parse(raw: P): Effect<VO, ValidationException>;
  new(params: N): Effect<VO, ValidationException>;
  unpack(vo: VO): VO['props'];
  isEqual(a: VO, b: VO): boolean;
}
```

## EntityTrait

```typescript
interface EntityTrait<E, N, P> extends ValueObjectTrait<E, N, P> {
  getId(entity: E): string;
  getCreatedAt(entity: E): Date;
  getUpdatedAt(entity: E): Option<Date>;
  markUpdated(entity: E): E;
}
```

## AggregateRootTrait

```typescript
interface AggregateRootTrait<A, N, P> extends EntityTrait<A, N, P> {
  getDomainEvents(aggregate: A): IDomainEvent[];
  clearEvents(aggregate: A): A;
  addDomainEvent(event: IDomainEvent): (aggregate: A) => A;
}
```

## CommandTrait

```typescript
interface CommandTrait {
  factory<C extends Command>(params: {
    lifecycle: Option<LifeCycleMeta>;
    props: GetProps<C>;
  }): C;

  correlationId<T extends Command>(command: T): string;
}
```

## QueryTrait

```typescript
interface QueryTrait {
  factory<Q extends Query>(props: GetProps<Q>): Q;
}
```

## Lifecycle Management

```typescript
interface LifeCycleMeta {
  createdTimestamp: number;
  correlationId: string;
  context: Record<string, never>;
}
```

# Repository Pattern

Effect-DDD provides a repository factory for creating TypeORM repositories with Effect integration.

## Basic Repository

```typescript
import { createRepository } from 'effect-ddd/typeorm';

const UserRepository = createRepository({
  entityClass: UserEntity,
  relations: ['profile'],
  mappers: {
    toDomain: (entity) => UserTrait.parse(entity),
    toOrm: (domain) => ({ ...domain.props, id: domain.id }),
    prepareQuery: (params) => ({ email: params.email })
  }
});
```

## Repository Methods

- `save()` - Save an aggregate
- `add()` - Add new aggregate
- `findOne()` - Find by query
- `findMany()` - Find multiple
- `delete()` - Remove aggregate

## Convention-based Mapping

```typescript
import { createRepositoryWithConventions } from 'effect-ddd/typeorm';

const OrderRepository = createRepositoryWithConventions({
  entityClass: OrderEntity,
  domainTrait: OrderTrait,
  relations: ['items'],
  customMappings: {
    prepareQuery: (params) => ({
      status: params.status 
    })
  }
});
```

## Transaction Support

```typescript
import { withTransaction } from 'effect-ddd/typeorm';

const updateUser = (user: User) =>
  withTransaction(() =>
    pipe(
      UserRepository.save(user),
      Effect.flatMap(() => AuditRepository.logUpdate(user))
    )
  );
```

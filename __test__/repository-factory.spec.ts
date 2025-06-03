// src/ports/database/typeorm/__tests__/repository-factory.spec.ts

import { Effect, Context, Layer, Option, pipe, Schema } from 'effect';
import { DataSource, Repository, EntityManager } from 'typeorm';
import {
  createRepository,
  createRepositoryWithDefaults,
  createRepositoryWithConventions,
  createRepositoryLayer,
  repositoryBuilder,
  withRelations,
  withDomainMapper,
  withOrmMapper,
  withQueryMapper,
  build,
  buildLayer,
  RepositoryConfig,
} from '../src/ports/database/typeorm/repository.factory';
import {
  createAggregateRoot,
  createEntity,
  createValueObject,
  withSchema,
  withNew,
  withQuery,
  withCommand,
  withAggregateCommand,
  buildEntity,
  buildAggregateRoot,
  buildValueObject,
} from '../src/model/builders/domain-builder';
import { AggregateRoot, Entity, ValueObject } from '../src/model/interfaces';
import { RepositoryPort } from '../src/model/interfaces/repository.interface';
import {
  BaseException,
  OperationException,
  ValidationException,
} from '../src/model/exception';
import { Identifier, IdentifierTrait } from '../src/typeclasses/obj-with-id';
import { SchemaBuilderTrait } from '../src/model/builders/schema-builder';
import {
  DataSourceContext,
  TypeormRepositoryConfig,
} from '@ports/database/typeorm/effect-repository.factory';

// ===== Test Domain Models =====

// User Value Object

const EmailAddress = pipe(
  SchemaBuilderTrait.string(),
  SchemaBuilderTrait.withEmail('Invalid email format'),
  SchemaBuilderTrait.buildStringSchema,
);

type EmailAddress = Schema.Schema.Type<typeof EmailAddress>;

type UserEmailProps = {
  readonly value: EmailAddress;
};
const UserEmailSchema = Schema.Struct({
  value: EmailAddress,
});
type UserEmail = ValueObject<UserEmailProps>;
const UserEmailTrait = pipe(
  createValueObject<UserEmail, string>('UserEmail'),
  withSchema(UserEmailSchema),
  withNew((emailString: string, parser) =>
    parser(emailString.toLowerCase().trim()),
  ),
  withQuery('getDomain', (props: UserEmailProps) => props.value.split('@')[1]),
  buildValueObject,
);

// User Entity
type UserProps = {
  readonly name: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly registeredAt: Date;
};

type UserInput = {
  readonly name: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly registeredAt: Date;
};

const UserSchema = Schema.Struct({
  name: SchemaBuilderTrait.CommonSchemas.NonEmptyString,
  email: SchemaBuilderTrait.CommonSchemas.Email,
  isActive: Schema.Boolean,
  registeredAt: Schema.Date,
});

const UserTrait = pipe(
  createAggregateRoot<AggregateRoot<UserProps>, UserInput>('User'),
  withSchema(UserSchema),
  withNew((input: UserInput, parser) =>
    parser({
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      isActive: true,
      registeredAt: new Date(),
      createdAt: Option.some(new Date()),
      updatedAt: Option.none(),
    }),
  ),
  withQuery('isActive', (props: UserProps) => props.isActive),
  withQuery(
    'getDisplayName',
    (props: UserProps) => `${props.name} (${props.email})`,
  ),
  withCommand('activate', (_, props: UserProps) =>
    Effect.succeed({ props: { ...props, isActive: true } }),
  ),
  withCommand('deactivate', (_, props: UserProps) =>
    Effect.succeed({ props: { ...props, isActive: false } }),
  ),
  buildAggregateRoot,
);

// Order Aggregate Root

const OrderItemProps = Schema.Struct({
  productId: SchemaBuilderTrait.CommonSchemas.UUID,
  quantity: SchemaBuilderTrait.CommonSchemas.PositiveInteger,
  price: SchemaBuilderTrait.CommonSchemas.PositiveNumber,
});

type OrderItemProps = Schema.Schema.Type<typeof OrderItemProps>;

type OrderItem = ValueObject<OrderItemProps>;

type OrderProps = {
  readonly customerId: Identifier;
  readonly items: OrderItem[];
  readonly status: 'draft' | 'confirmed' | 'shipped';
  readonly total: Schema.Schema.Type<typeof Schema.NonNegative>;
};

type OrderInput = {
  readonly customerId: string;
  readonly items: OrderItem[];
  readonly status: 'draft' | 'confirmed' | 'shipped';
  readonly total: number;
};

const OrderSchema = Schema.Struct({
  customerId: Identifier,
  items: Schema.Array(Schema.Any),
  status: Schema.Enums({
    DRAFT: 'draft',
    CONFIRMED: 'confirmed',
    SHIPPED: 'shipped',
  }),
  total: Schema.NonNegative,
});

const OrderTrait = pipe(
  createAggregateRoot<
    AggregateRoot<OrderProps>,
    OrderInput,
    { customerId: Identifier }
  >('Order'),
  withSchema(OrderSchema),
  withNew((input, parser) =>
    parser({
      customerId: input.customerId,
      items: [],
      status: 'draft',
      total: 0,
      createdAt: Option.some(new Date()),
      updatedAt: Option.none(),
    }),
  ),
  withQuery('getItemCount', (props: OrderProps) => props.items.length),
  withQuery('isEmpty', (props: OrderProps) => props.items.length === 0),
  withQuery('canBeModified', (props: OrderProps) => props.status === 'draft'),
  withAggregateCommand(
    'addItem',
    (
      item: OrderItem,
      props: OrderProps,
      aggregate: AggregateRoot<OrderProps>,
      correlationId: string,
    ) =>
      Effect.gen(function*() {
        if (props.status !== 'draft') {
          return yield* Effect.fail(
            ValidationException.new(
              'ORDER_NOT_MODIFIABLE',
              'Cannot modify confirmed order',
            ),
          );
        }

        const newItems = [...props.items, item];
        const newTotal = newItems.reduce(
          (sum, orderItem) =>
            sum + orderItem.props.price * orderItem.props.quantity,
          0,
        );

        return {
          props: { ...props, items: newItems, total: newTotal },
          domainEvents: [
            {
              name: 'OrderItemAdded',
              payload: { item },
              metadata: {
                timestamp: Date.now(),
                correlationId,
              },
              aggregateId: aggregate.id,
              aggregateType: 'Order',
              getPayload: () => ({ item }),
            },
          ],
        };
      }),
  ),
  buildAggregateRoot,
);

// ===== TypeORM Entities =====

class UserEntity {
  id!: string;
  name!: string;
  email!: string;
  isActive!: boolean;
  registeredAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;
}

class OrderEntity {
  id!: string;
  customerId!: string;
  items!: string; // JSON serialized
  status!: string;
  total!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

// ===== Query Parameter Types =====

interface UserQueryParams {
  id?: string;
  email?: string;
  isActive?: boolean;
}

interface OrderQueryParams {
  id?: string;
  customerId?: string;
  status?: string;
}

// ===== Test Mocks =====

const createMockDataSource = (): DataSource => {
  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  } as unknown as Repository<any>;

  const mockManager = {
    getRepository: jest.fn().mockReturnValue(mockRepository),
  } as unknown as EntityManager;

  return {
    manager: mockManager,
    getRepository: jest.fn().mockReturnValue(mockRepository),
  } as unknown as DataSource;
};

const createMockUser = () =>
  UserTrait.new({
    name: 'John Doe',
    email: 'john@example.com',
    isActive: true,
    registeredAt: new Date(),
  });

const createMockOrder = () =>
  OrderTrait.new({
    customerId: IdentifierTrait.uuid(),
  });

// ===== Tests =====

describe('Repository Factory', () => {
  let mockDataSource: DataSource;
  let mockRepository: Repository<any>;

  beforeEach(() => {
    mockDataSource = createMockDataSource();
    mockRepository = mockDataSource.manager.getRepository(UserEntity);
    jest.clearAllMocks();
  });

  describe('createRepository', () => {
    it('should create a repository with complete configuration', async () => {
      const config: RepositoryConfig<
        AggregateRoot<UserProps>,
        UserEntity,
        UserQueryParams
      > = {
        entityClass: UserEntity,
        relations: ['profile'] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            pipe(
              UserTrait.parse(entity),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (domain: AggregateRoot<UserProps>, existing, repo) =>
            pipe(
              Effect.try(() =>
                repo.create({
                  ...Option.getOrElse(existing, () => ({})),
                  id: domain.id,
                  name: domain.props.name,
                  email: domain.props.email,
                  isActive: domain.props.isActive,
                  registeredAt: domain.props.registeredAt,
                  createdAt: domain.createdAt,
                  updatedAt: Option.getOrUndefined(domain.updatedAt),
                }),
              ),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
        },
        prepareQuery: (params: UserQueryParams) => ({
          id: params.id,
          email: params.email,
          isActive: params.isActive,
        }),
      };

      const repositoryEffect = createRepository(config);

      const program = Effect.gen(function*() {
        const repository = yield* repositoryEffect;
        return repository;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
      expect(repository.save).toBeDefined();
      expect(repository.findOne).toBeDefined();
      expect(repository.findMany).toBeDefined();
    });

    it('should handle domain mapping correctly', async () => {
      const userEntity: UserEntity = {
        id: IdentifierTrait.uuid(),
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
        registeredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne = jest.fn().mockResolvedValue(userEntity);

      const config = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
          toOrm: (domain: Entity<UserProps>, existing: ) =>
            Effect.succeed({
              id: domain.id,
              name: domain.props.name,
              email: domain.props.email,
              isActive: domain.props.isActive,
              registeredAt: domain.props.registeredAt,
            } as UserEntity),
          prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
        },
      };

      const program = Effect.gen(function*() {
        const repository = yield* createRepository(config);
        const result = yield* repository.findOne({ id: userEntity.id });
        return result;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const result = await Effect.runPromise(program);

      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        expect(result.value.props.name).toBe('John Doe');
        expect(result.value.props.email).toBe('john@example.com');
      }
    });
  });

  describe('createRepositoryWithConventions', () => {
    it('should create repository using convention-based mapping', async () => {
      const config = {
        entityClass: UserEntity,
        domainTrait: UserTrait,
        relations: ['profile'] as const,
      };

      const program = Effect.gen(function*() {
        const repository = yield* createRepositoryWithConventions(config);
        return repository;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
      expect(repository.save).toBeDefined();
      expect(repository.findOne).toBeDefined();
    });

    it('should work with aggregate roots', async () => {
      const config = {
        entityClass: OrderEntity,
        domainTrait: OrderTrait,
        relations: ['items'] as const,
        customMappings: {
          prepareQuery: (params: OrderQueryParams) => ({
            customerId: params.customerId,
            status: params.status,
          }),
        },
      };

      const program = Effect.gen(function*() {
        const repository = yield* createRepositoryWithConventions(config);
        return repository;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
    });
  });

  describe('Functional Builder Pattern', () => {
    it('should work with pipe composition', async () => {
      const repositoryEffect = pipe(
        repositoryBuilder<Entity<UserProps>, UserEntity, UserQueryParams>(
          UserEntity,
        ),
        withRelations(['profile']),
        withDomainMapper((entity: UserEntity) =>
          UserTrait.parse({
            name: entity.name,
            email: entity.email,
            isActive: entity.isActive,
            registeredAt: entity.registeredAt,
          }),
        ),
        withQueryMapper((params: UserQueryParams) => ({
          id: params.id,
          email: params.email,
          isActive: params.isActive,
        })),
        build,
      );

      const program = Effect.gen(function*() {
        const repository = yield* repositoryEffect;
        return repository;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
      expect(repository.save).toBeDefined();
      expect(repository.findOne).toBeDefined();
    });

    it('should create layers with functional builder', () => {
      const UserRepositoryTag =
        Context.Tag<RepositoryPort<Entity<UserProps>>>();

      const repositoryLayer = pipe(
        repositoryBuilder<Entity<UserProps>, UserEntity>(UserEntity),
        withRelations(['profile']),
        withDomainMapper((entity: UserEntity) =>
          UserTrait.parse({
            name: entity.name,
            email: entity.email,
            isActive: entity.isActive,
            registeredAt: entity.registeredAt,
          }),
        ),
        buildLayer(UserRepositoryTag),
      );

      expect(repositoryLayer).toBeDefined();
    });
  });

  describe('Repository Operations', () => {
    it('should save an entity correctly', async () => {
      const config = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
          toOrm: (domain: Entity<UserProps>) =>
            Effect.succeed({
              id: domain.id,
              name: domain.props.name,
              email: domain.props.email,
              isActive: domain.props.isActive,
              registeredAt: domain.props.registeredAt,
            } as UserEntity),
          prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
        },
      };

      mockRepository.save = jest.fn().mockResolvedValue({});

      const program = Effect.gen(function*() {
        const repository = yield* createRepository(config);
        const user = yield* createMockUser();
        yield* repository.save(user);
        return user;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      await Effect.runPromise(program);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should find entities with pagination', async () => {
      const mockEntities = [
        {
          id: IdentifierTrait.uuid(),
          name: 'User 1',
          email: 'user1@example.com',
          isActive: true,
          registeredAt: new Date(),
        },
        {
          id: IdentifierTrait.uuid(),
          name: 'User 2',
          email: 'user2@example.com',
          isActive: false,
          registeredAt: new Date(),
        },
      ];

      mockRepository.find = jest.fn().mockResolvedValue(mockEntities);
      mockRepository.count = jest.fn().mockResolvedValue(2);

      const config = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
          toOrm: (domain: Entity<UserProps>) =>
            Effect.succeed({} as UserEntity),
          prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
        },
      };

      const program = Effect.gen(function*() {
        const repository = yield* createRepository(config);
        const result = yield* repository.findManyPaginated({
          params: { isActive: true },
          pagination: { skip: 0, limit: 10 },
        });
        return result;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const result = await Effect.runPromise(program);

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(mockRepository.find).toHaveBeenCalled();
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle mapping errors properly', async () => {
      const config = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            Effect.fail(
              OperationException.new('MAPPING_ERROR', 'Failed to map entity'),
            ),
          toOrm: (domain: Entity<UserProps>) =>
            Effect.succeed({} as UserEntity),
          prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
        },
      };

      mockRepository.findOne = jest.fn().mockResolvedValue({
        id: IdentifierTrait.uuid(),
        name: 'John Doe',
        email: 'john@example.com',
      });

      const program = Effect.gen(function*() {
        const repository = yield* createRepository(config);
        yield* repository.findOne({ id: 'test-id' });
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      await expect(Effect.runPromise(program)).rejects.toThrow();
    });

    it('should handle database errors properly', async () => {
      const config = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
          toOrm: (domain: Entity<UserProps>) =>
            Effect.succeed({} as UserEntity),
          prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
        },
      };

      mockRepository.findOne = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const program = Effect.gen(function*() {
        const repository = yield* createRepository(config);
        yield* repository.findOne({ id: 'test-id' });
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      await expect(Effect.runPromise(program)).rejects.toThrow();
    });
  });

  describe('Domain Events', () => {
    it('should handle domain events in aggregate roots', async () => {
      const config = {
        entityClass: OrderEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: OrderEntity) =>
            OrderTrait.parse({
              customerId: entity.customerId,
              items: JSON.parse(entity.items || '[]'),
              status: entity.status as any,
              total: entity.total,
            }),
          toOrm: (domain: AggregateRoot<OrderProps>) =>
            Effect.succeed({
              id: domain.id,
              customerId: domain.props.customerId,
              items: JSON.stringify(domain.props.items),
              status: domain.props.status,
              total: domain.props.total,
            } as OrderEntity),
          prepareQuery: (params: OrderQueryParams) => ({ id: params.id }),
        },
      };

      mockRepository.save = jest.fn().mockResolvedValue({});

      const program = Effect.gen(function*() {
        const repository = yield* createRepository(config);
        const order = yield* createMockOrder();

        // Add item to trigger domain event
        const orderWithItem = yield* OrderTrait.addItem({
          productId: IdentifierTrait.uuid(),
          quantity: 2,
          price: 10.0,
        })(order);

        yield* repository.save(orderWithItem);
        return orderWithItem;
      }).pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)));

      const result = await Effect.runPromise(program);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0].name).toBe('OrderItemAdded');
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct types for query parameters', () => {
      const config = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
          toOrm: (domain: Entity<UserProps>) =>
            Effect.succeed({} as UserEntity),
          prepareQuery: (params: UserQueryParams) => {
            // This should compile with correct types
            const validParams = {
              id: params.id,
              email: params.email,
              isActive: params.isActive,
            };
            return validParams;
          },
        },
      };

      // This should compile without errors
      const repositoryEffect = createRepository(config);

      expect(repositoryEffect).toBeDefined();
    });

    it('should enforce correct domain model types', async () => {
      const program = Effect.gen(function*() {
        const user = yield* createMockUser();

        // These should be type-safe
        expect(user.props.name).toBeDefined();
        expect(user.props.email).toBeDefined();
        expect(user.props.isActive).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.createdAt).toBeDefined();

        return user;
      });

      const user = await Effect.runPromise(program);
      expect(user).toBeDefined();
    });
  });
});

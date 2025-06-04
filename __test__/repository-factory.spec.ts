// src/ports/database/typeorm/__tests__/repository-factory.spec.ts

import { Effect, Context, Layer, Option, pipe, Schema } from 'effect';
import {
  DataSource,
  Repository,
  EntityManager,
  FindOptionsWhere,
} from 'typeorm';
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
  ConventionConfig,
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
  withInvariant,
} from '../src/model/builders/domain-builder';
import {
  AggregateRoot,
  Entity,
  IDomainEventPublisher,
  ValueObject,
} from '../src/model/interfaces';
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
import { DomainEventPublisherContext } from '@model/interfaces';
import { MockDomainEventRepository } from '@model/implementations/domain-event-repository.mock';
import { AggregateTypeORMEntityBase } from 'src/typeorm';

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
  createValueObject<UserEmail, string, string>('UserEmail'),
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

type User = AggregateRoot<UserProps>;

const UserSchema = Schema.Struct({
  name: SchemaBuilderTrait.CommonSchemas.NonEmptyString,
  email: SchemaBuilderTrait.CommonSchemas.Email,
  isActive: Schema.Boolean,
  registeredAt: Schema.Date,
});

const UserTrait = pipe(
  createAggregateRoot<User, UserInput>('User'),
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

interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
}

// ===== ORDER ITEM TRAIT =====

const OrderItemTrait = pipe(
  createValueObject<OrderItem, OrderItemInput, OrderItemInput>('OrderItem'),
  withSchema(OrderItemProps),

  // Custom creation logic with validation and normalization
  withNew((input, parser) => {
    // Normalize input
    const normalizedInput = {
      productId: input.productId.trim(),
      quantity: Math.floor(Math.abs(input.quantity)), // Ensure positive integer
      price: Math.round(Math.abs(input.price) * 100) / 100, // Round to 2 decimal places, ensure positive
    };

    return parser(normalizedInput);
  }),

  // Business rule invariants
  withInvariant(
    (props) => props.quantity <= 10000,
    'Quantity cannot exceed 10,000 items',
    'QUANTITY_TOO_HIGH',
  ),

  withInvariant(
    (props) => props.price <= 1000000,
    'Price cannot exceed $1,000,000',
    'PRICE_TOO_HIGH',
  ),

  withInvariant(
    (props) => props.quantity > 0,
    'Quantity must be positive',
    'INVALID_QUANTITY',
  ),

  withInvariant(
    (props) => props.price > 0,
    'Price must be positive',
    'INVALID_PRICE',
  ),

  // Query methods for business calculations
  withQuery(
    'getSubtotal',
    (props) => Math.round(props.price * props.quantity * 100) / 100,
  ),

  withQuery('getFormattedPrice', (props) => `$${props.price.toFixed(2)}`),

  withQuery('getFormattedSubtotal', (props) => {
    const subtotal = Math.round(props.price * props.quantity * 100) / 100;
    return `$${subtotal.toFixed(2)}`;
  }),

  withQuery('isHighValue', (props) => props.price * props.quantity > 1000),

  withQuery('isLargeQuantity', (props) => props.quantity >= 100),

  withQuery(
    'getDisplayText',
    (props) =>
      `${props.quantity} x $${props.price.toFixed(2)} = $${(
        props.price * props.quantity
      ).toFixed(2)}`,
  ),

  buildValueObject,
);

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

type Order = AggregateRoot<OrderProps>;

const OrderTrait = pipe(
  createAggregateRoot<Order, OrderInput, { customerId: Identifier }>('Order'),
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
      Effect.gen(function* () {
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

class UserEntity extends AggregateTypeORMEntityBase {
  name!: string;
  email!: string;
  isActive!: boolean;
  registeredAt!: Date;
}

class OrderEntity extends AggregateTypeORMEntityBase {
  customerId!: string;
  items!: string; // JSON serialized
  status!: string;
  total!: number;
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
  let mockDomainEventPublisher: IDomainEventPublisher;
  beforeEach(() => {
    mockDataSource = createMockDataSource();
    mockRepository = mockDataSource.manager.getRepository(UserEntity);
    jest.clearAllMocks();
    const mockDomainEventRepository = new MockDomainEventRepository();
    mockDomainEventPublisher = {
      publish: (event) => mockDomainEventRepository.save(event),
      publishAll: (events) =>
        Effect.forEach(
          events,
          (event) => mockDomainEventRepository.save(event),
          {
            concurrency: 'unbounded',
          },
        ),
    };
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

      const program = Effect.gen(function* () {
        const repository = yield* repositoryEffect;
        return repository;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

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

      const config: RepositoryConfig<
        AggregateRoot<UserProps>,
        UserEntity,
        UserQueryParams
      > = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            pipe(
              UserTrait.parse({
                name: entity.name,
                email: entity.email,
                isActive: entity.isActive,
                registeredAt: entity.registeredAt,
              }),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (
            domain: AggregateRoot<UserProps>,
            existing: Option.Option<UserEntity>,
            repo: Repository<UserEntity>,
          ) =>
            Effect.succeed(
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
        },
        prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
      };

      const program = Effect.gen(function* () {
        const repository = yield* createRepository(config);
        const result = yield* repository.findOne({ id: userEntity.id });
        return result;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

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
      const config: ConventionConfig<
        User,
        UserEntity,
        UserQueryParams,
        typeof UserTrait
      > = {
        entityClass: UserEntity,
        domainTrait: UserTrait,
        relations: ['profile'] as const,
      };

      const program = Effect.gen(function* () {
        const repository = yield* createRepositoryWithConventions(config);
        return repository;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
      expect(repository.save).toBeDefined();
      expect(repository.findOne).toBeDefined();
    });

    it('should work with aggregate roots', async () => {
      const config: ConventionConfig<
        Order,
        OrderEntity,
        OrderQueryParams,
        typeof OrderTrait
      > = {
        entityClass: OrderEntity,
        domainTrait: OrderTrait,
        relations: ['items'] as const,
        prepareQuery: (params: OrderQueryParams) => ({
          customerId: params.customerId,
          status: params.status,
        }),
      };

      const program = Effect.gen(function* () {
        const repository = yield* createRepositoryWithConventions(config);
        return repository;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
    });
  });

  describe('Functional Builder Pattern', () => {
    it('should work with pipe composition', async () => {
      const repositoryEffect = pipe(
        repositoryBuilder<User, UserEntity, UserQueryParams>(UserEntity),
        withRelations(['profile']),
        withDomainMapper((entity) =>
          pipe(
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
            Effect.mapError((error) =>
              OperationException.new('TO_ORM_FAILED', error.toString()),
            ),
          ),
        ),
        withQueryMapper(
          (params: UserQueryParams) =>
            ({
              id: params.id,
              email: params.email,
              isActive: params.isActive,
            }) as FindOptionsWhere<UserEntity>,
        ),
        build,
      );

      const program = Effect.gen(function* () {
        const repository = yield* repositoryEffect;
        return repository;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      const repository = await Effect.runPromise(program);

      expect(repository).toBeDefined();
      expect(repository.save).toBeDefined();
      expect(repository.findOne).toBeDefined();
    });

    it('should create layers with functional builder', () => {
      class UserRepositoryTag extends Context.Tag('UserRepository')<
        UserRepositoryTag,
        RepositoryPort<User>
      >() {}

      const repositoryLayer = pipe(
        repositoryBuilder<User, UserEntity>(UserEntity),
        withRelations(['profile']),
        withDomainMapper((entity: UserEntity) =>
          pipe(
            UserTrait.parse({
              name: entity.name,
              email: entity.email,
              isActive: entity.isActive,
              registeredAt: entity.registeredAt,
            }),
            Effect.mapError((error) =>
              OperationException.new('TO_ORM_FAILED', error.toString()),
            ),
          ),
        ),
        buildLayer(UserRepositoryTag),
      );

      expect(repositoryLayer).toBeDefined();
    });
  });

  describe('Repository Operations', () => {
    it('should save an entity correctly', async () => {
      const config: RepositoryConfig<User, UserEntity, UserQueryParams> = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            pipe(
              UserTrait.parse({
                name: entity.name,
                email: entity.email,
                isActive: entity.isActive,
                registeredAt: entity.registeredAt,
              }),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (
            domain: AggregateRoot<UserProps>,
            existing: Option.Option<UserEntity>,
            repo: Repository<UserEntity>,
          ) =>
            Effect.succeed(
              repo.create({
                ...Option.getOrElse(
                  existing,
                  () =>
                    ({
                      id: domain.id,
                      name: domain.props.name,
                      email: domain.props.email,
                      isActive: domain.props.isActive,
                      registeredAt: domain.props.registeredAt,
                      createdAt: domain.createdAt,
                      updatedAt: Option.getOrUndefined(domain.updatedAt),
                    }) as UserEntity,
                ),
              }),
            ),
        },
        prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
      };

      mockRepository.save = jest.fn().mockResolvedValue({});

      const program = Effect.gen(function* () {
        const repository = yield* createRepository(config);
        const user = yield* createMockUser();
        yield* repository.save(user);
        return user;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

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

      const config: RepositoryConfig<User, UserEntity, UserQueryParams> = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            pipe(
              UserTrait.parse({
                name: entity.name,
                email: entity.email,
                isActive: entity.isActive,
                registeredAt: entity.registeredAt,
              }),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (
            domain: AggregateRoot<UserProps>,
            existing: Option.Option<UserEntity>,
            repo: Repository<UserEntity>,
          ) =>
            Effect.succeed(
              repo.create({
                ...Option.getOrElse(
                  existing,
                  () =>
                    ({
                      id: domain.id,
                      name: domain.props.name,
                      email: domain.props.email,
                      isActive: domain.props.isActive,
                      registeredAt: domain.props.registeredAt,
                      createdAt: domain.createdAt,
                      updatedAt: Option.getOrUndefined(domain.updatedAt),
                    }) as UserEntity,
                ),
              }),
            ),
        },
        prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
      };

      const program = Effect.gen(function* () {
        const repository = yield* createRepository(config);
        const result = yield* repository.findManyPaginated({
          params: { isActive: true },
          pagination: { skip: 0, limit: 10 },
        });
        return result;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      const result = await Effect.runPromise(program);

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(mockRepository.find).toHaveBeenCalled();
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle mapping errors properly', async () => {
      const config: RepositoryConfig<User, UserEntity, UserQueryParams> = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            Effect.fail(
              OperationException.new('MAPPING_ERROR', 'Failed to map entity'),
            ),
          toOrm: (
            domain: AggregateRoot<UserProps>,
            existing: Option.Option<UserEntity>,
            repo: Repository<UserEntity>,
          ) =>
            Effect.succeed(
              repo.create({
                ...Option.getOrElse(
                  existing,
                  () =>
                    ({
                      id: domain.id,
                      name: domain.props.name,
                      email: domain.props.email,
                      isActive: domain.props.isActive,
                      registeredAt: domain.props.registeredAt,
                      createdAt: domain.createdAt,
                      updatedAt: Option.getOrUndefined(domain.updatedAt),
                    }) as UserEntity,
                ),
              }),
            ),
        },
        prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
      };

      mockRepository.findOne = jest.fn().mockResolvedValue({
        id: IdentifierTrait.uuid(),
        name: 'John Doe',
        email: 'john@example.com',
      });

      const program = Effect.gen(function* () {
        const repository = yield* createRepository(config);
        yield* repository.findOne({ id: 'test-id' });
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      await expect(Effect.runPromise(program)).rejects.toThrow();
    });

    it('should handle database errors properly', async () => {
      const config: RepositoryConfig<User, UserEntity, UserQueryParams> = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            pipe(
              UserTrait.parse({
                name: entity.name,
                email: entity.email,
                isActive: entity.isActive,
                registeredAt: entity.registeredAt,
              }),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (
            domain: AggregateRoot<UserProps>,
            existing: Option.Option<UserEntity>,
            repo: Repository<UserEntity>,
          ) =>
            Effect.succeed(
              repo.create({
                ...Option.getOrElse(
                  existing,
                  () =>
                    ({
                      id: domain.id,
                      name: domain.props.name,
                      email: domain.props.email,
                      isActive: domain.props.isActive,
                      registeredAt: domain.props.registeredAt,
                      createdAt: domain.createdAt,
                      updatedAt: Option.getOrUndefined(domain.updatedAt),
                    }) as UserEntity,
                ),
              }),
            ),
        },
        prepareQuery: (params: UserQueryParams) => ({ id: params.id }),
      };

      mockRepository.findOne = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const program = Effect.gen(function* () {
        const repository = yield* createRepository(config);
        yield* repository.findOne({ id: 'test-id' });
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      await expect(Effect.runPromise(program)).rejects.toThrow();
    });
  });

  describe('Domain Events', () => {
    it('should handle domain events in aggregate roots', async () => {
      const config: RepositoryConfig<Order, OrderEntity, OrderQueryParams> = {
        entityClass: OrderEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: OrderEntity) =>
            pipe(
              OrderTrait.parse({
                customerId: entity.customerId,
                items: JSON.parse(entity.items || '[]'),
                status: entity.status as any,
                total: entity.total,
              }),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (
            domain: AggregateRoot<OrderProps>,
            existing: Option.Option<OrderEntity>,
            repo: Repository<OrderEntity>,
          ) =>
            Effect.succeed(
              repo.create({
                ...Option.getOrElse(
                  existing,
                  () =>
                    ({
                      id: domain.id,
                      customerId: domain.props.customerId,
                      items: JSON.stringify(domain.props.items),
                      status: domain.props.status,
                      total: domain.props.total,
                      createdAt: domain.createdAt,
                      updatedAt: Option.getOrUndefined(domain.updatedAt),
                    }) as OrderEntity,
                ),
              }),
            ),
        },
        prepareQuery: (params: OrderQueryParams) => ({ id: params.id }),
      };

      mockRepository.save = jest.fn().mockResolvedValue({});

      const program = Effect.gen(function* () {
        const repository = yield* createRepository(config);
        const order = yield* createMockOrder();
        const orderItem = yield* OrderItemTrait.new({
          productId: IdentifierTrait.uuid().toString(),
          quantity: 2,
          price: 10.0,
        });
        // Add item to trigger domain event
        const orderWithItem = yield* OrderTrait.addItem(orderItem)(order);

        yield* repository.save(orderWithItem);
        return orderWithItem;
      })
        .pipe(Effect.provide(Layer.succeed(DataSourceContext, mockDataSource)))
        .pipe(
          Effect.provide(
            Layer.succeed(
              DomainEventPublisherContext,
              mockDomainEventPublisher,
            ),
          ),
        );

      const result = await Effect.runPromise(program);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0].name).toBe('OrderItemAdded');
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct types for query parameters', () => {
      const config: RepositoryConfig<User, UserEntity, UserQueryParams> = {
        entityClass: UserEntity,
        relations: [] as const,
        mappers: {
          toDomain: (entity: UserEntity) =>
            pipe(
              UserTrait.parse({
                name: entity.name,
                email: entity.email,
                isActive: entity.isActive,
                registeredAt: entity.registeredAt,
              }),
              Effect.mapError((error) =>
                OperationException.new('TO_ORM_FAILED', error.toString()),
              ),
            ),
          toOrm: (
            domain: AggregateRoot<UserProps>,
            existing: Option.Option<UserEntity>,
            repo: Repository<UserEntity>,
          ) =>
            Effect.succeed(
              repo.create({
                ...Option.getOrElse(
                  existing,
                  () =>
                    ({
                      id: domain.id,
                      name: domain.props.name,
                      email: domain.props.email,
                      isActive: domain.props.isActive,
                      registeredAt: domain.props.registeredAt,
                      createdAt: domain.createdAt,
                      updatedAt: Option.getOrUndefined(domain.updatedAt),
                    }) as UserEntity,
                ),
              }),
            ),
        },
        prepareQuery: (params: UserQueryParams) => {
          // This should compile with correct types
          const validParams = {
            id: params.id,
            email: params.email,
            isActive: params.isActive,
          };
          return validParams;
        },
      };

      // This should compile without errors
      const repositoryEffect = createRepository(config);

      expect(repositoryEffect).toBeDefined();
    });

    it('should enforce correct domain model types', async () => {
      const program = Effect.gen(function* () {
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

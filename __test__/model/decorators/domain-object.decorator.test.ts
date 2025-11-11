import { Effect, Schema } from 'effect';
import 'reflect-metadata';
import {
  DomainModel,
  ValueObject,
  Entity,
  AggregateRoot,
  WithSchema,
  Command,
  Query,
  Invariant,
  DomainObjectFactory,
} from '../../../src/model/decorators/domain-object.decorator';
import {} from '../../../src/model/implementations';
import { ValidationException } from '../../../src/model/exception';
import {
  ValueObject as ValueObjectType,
  Entity as EntityType,
  AggregateRoot as AggregateRootType,
  ValueObjectTrait,
  EntityTrait,
  AggregateRootTrait,
  QueryFunction,
  CommandOnModel,
} from 'src';

describe('Domain Object Decorators', () => {
  beforeEach(() => {
    // Clear any existing metadata between tests
    Reflect.deleteMetadata = jest.fn();
  });

  describe('@DomainModel decorator', () => {
    it('should set domain model metadata on class', () => {
      type TestProps = { value: string };
      type TestModel = ValueObjectType<TestProps>;

      @DomainModel<TestModel>()
      class TestDomain {}

      const metadata = Reflect.getMetadata(
        Symbol.for('domainModelType'),
        TestDomain,
      );
      expect(metadata).toBe(true);
    });
  });

  describe('@ValueObject decorator', () => {
    it('should set correct metadata for value object', () => {
      @ValueObject('TestVO')
      class TestValueObject {}

      const type = Reflect.getMetadata(
        Symbol.for('domainObjectType'),
        TestValueObject,
      );
      const tag = Reflect.getMetadata(
        Symbol.for('domainObjectTag'),
        TestValueObject,
      );

      expect(type).toBe('ValueObject');
      expect(tag).toBe('TestVO');
    });
  });

  describe('@Entity decorator', () => {
    it('should set correct metadata for entity', () => {
      @Entity('TestEntity')
      class TestEntity {}

      const type = Reflect.getMetadata(
        Symbol.for('domainObjectType'),
        TestEntity,
      );
      const tag = Reflect.getMetadata(
        Symbol.for('domainObjectTag'),
        TestEntity,
      );

      expect(type).toBe('Entity');
      expect(tag).toBe('TestEntity');
    });
  });

  describe('@AggregateRoot decorator', () => {
    it('should set correct metadata for aggregate root', () => {
      @AggregateRoot('TestAggregate')
      class TestAggregate {}

      const type = Reflect.getMetadata(
        Symbol.for('domainObjectType'),
        TestAggregate,
      );
      const tag = Reflect.getMetadata(
        Symbol.for('domainObjectTag'),
        TestAggregate,
      );

      expect(type).toBe('AggregateRoot');
      expect(tag).toBe('TestAggregate');
    });
  });

  describe('@WithSchema decorator', () => {
    it('should set schema metadata on class', () => {
      const testSchema = Schema.Struct({
        amount: Schema.Number,
        currency: Schema.String,
      });

      @WithSchema(testSchema)
      class TestDomain {}

      const schema = Reflect.getMetadata(
        Symbol.for('domainObjectSchema'),
        TestDomain,
      );
      expect(schema).toBe(testSchema);
    });
  });

  describe('@Query decorator', () => {
    it('should register query methods in metadata', () => {
      class TestDomain {
        @Query()
        getDisplayName(props: { name: string }) {
          return `Name: ${props.name}`;
        }

        @Query()
        isValid(props: { value: number }) {
          return props.value > 0;
        }
      }

      const queries = Reflect.getMetadata(
        Symbol.for('domainObjectQueries'),
        TestDomain,
      );
      expect(queries).toBeDefined();
      expect(queries.getDisplayName).toBeDefined();
      expect(queries.isValid).toBeDefined();
    });
  });

  describe('@Command decorator', () => {
    it('should register command methods with default event names', () => {
      class TestDomain {
        @Command()
        activate() {
          return Effect.succeed({ props: { isActive: true } });
        }

        @Command('CustomEvent')
        update() {
          return Effect.succeed({ props: { updated: true } });
        }
      }

      const commands = Reflect.getMetadata(
        Symbol.for('domainObjectCommands'),
        TestDomain,
      );
      expect(commands).toBeDefined();
      expect(commands.activate.eventName).toBe('activateExecuted');
      expect(commands.update.eventName).toBe('CustomEvent');
    });
  });

  describe('@Invariant decorator', () => {
    it('should register invariant rules in metadata', () => {
      class TestDomain {
        @Invariant('Amount must be positive', 'NEGATIVE_AMOUNT')
        isAmountPositive(props: { amount: number }) {
          return props.amount > 0;
        }

        @Invariant('Name cannot be empty')
        hasName(props: { name: string }) {
          return props.name.length > 0;
        }
      }

      const invariants = Reflect.getMetadata(
        Symbol.for('domainObjectInvariants'),
        TestDomain,
      );
      expect(invariants).toBeDefined();
      expect(invariants).toHaveLength(2);
      expect(invariants[0].message).toBe('Amount must be positive');
      expect(invariants[0].code).toBe('NEGATIVE_AMOUNT');
      expect(invariants[1].code).toBe('HASNAME_VIOLATION');
    });
  });

  describe('DomainObjectFactory.createTrait', () => {
    it('should throw error for class without domain object decorator', () => {
      class UndecoratedClass {}

      expect(() => {
        DomainObjectFactory.createTrait({} as any, UndecoratedClass);
      }).toThrow(
        'Class must be decorated with @ValueObject, @Entity, or @AggregateRoot',
      );
    });

    it('should create value object trait with schema validation', async () => {
      type MoneyProps = { amount: number; currency: string };
      type Money = ValueObjectType<MoneyProps>;

      const MoneySchema = Schema.Struct({
        amount: Schema.Number.pipe(Schema.positive()),
        currency: Schema.String,
      });

      @DomainModel<Money>()
      @ValueObject('Money')
      @WithSchema(MoneySchema)
      class MoneyDomain {
        @Query()
        getFormattedAmount(props: MoneyProps) {
          return `${props.amount} ${props.currency}`;
        }

        @Invariant('Amount must be positive')
        isAmountPositive(props: MoneyProps) {
          return props.amount > 0;
        }
      }

      const MoneyTrait = DomainObjectFactory.createTrait<
        Money,
        typeof MoneyDomain
      >({} as Money, MoneyDomain);

      // Test successful creation
      const validMoneyResult = await Effect.runPromise(
        Effect.either(MoneyTrait.new({ amount: 100, currency: 'USD' })),
      );
      expect(validMoneyResult._tag).toBe('Right');

      // Test schema validation failure
      const invalidMoneyResult = await Effect.runPromise(
        Effect.either(MoneyTrait.new({ amount: -100, currency: 'USD' })),
      );
      expect(invalidMoneyResult._tag).toBe('Left');

      // Test invariant validation failure
      const zeroAmountResult = await Effect.runPromise(
        Effect.either(MoneyTrait.parse({ amount: 0, currency: 'USD' })),
      );
      expect(zeroAmountResult._tag).toBe('Left');
    });

    it('should create entity trait with commands', async () => {
      type UserProps = { name: string; email: string; isActive: boolean };
      type User = EntityType<UserProps>;

      const UserSchema = Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        isActive: Schema.Boolean,
      });

      @DomainModel<User>()
      @Entity('User')
      @WithSchema(UserSchema)
      class UserDomain {
        @Query()
        getDisplayName(props: UserProps) {
          return `${props.name} (${props.email})`;
        }

        @Command()
        activate(input: void, props: UserProps) {
          return Effect.succeed({ props: { ...props, isActive: true } });
        }

        @Command()
        updateEmail(input: string, props: UserProps) {
          return Effect.succeed({ props: { ...props, email: input } });
        }
      }

      const UserTrait = DomainObjectFactory.createTrait<
        User,
        typeof UserDomain
      >({} as User, UserDomain);

      // Test entity creation
      const userResult = await Effect.runPromise(
        Effect.either(
          UserTrait.new({
            name: 'John',
            email: 'john@example.com',
            isActive: false,
          }),
        ),
      );
      expect(userResult._tag).toBe('Right');

      if (userResult._tag === 'Right') {
        const user = userResult.right;
        expect(user.getDisplayName()).toBe('John (john@example.com)');

        // Test command execution
        const activatedUserResult = await Effect.runPromise(
          Effect.either(UserTrait.activate()(user)),
        );
        expect(activatedUserResult._tag).toBe('Right');
      }
    });

    it('should create aggregate root trait with domain events', async () => {
      type OrderProps = { customerId: string; items: string[]; total: number };
      type Order = AggregateRootType<OrderProps>;

      const OrderSchema = Schema.Struct({
        customerId: Schema.String,
        items: Schema.Array(Schema.String),
        total: Schema.Number,
      });

      @DomainModel<Order>()
      @AggregateRoot('Order')
      @WithSchema(OrderSchema)
      class OrderDomain {
        @Query()
        getItemCount(props: OrderProps) {
          return props.items.length;
        }

        @Command()
        addItem(
          input: string,
          props: OrderProps,
          aggregate: Order,
          correlationId: string,
        ) {
          const newItems = [...props.items, input];
          return Effect.succeed({
            props: { ...props, items: newItems },
            domainEvents: [], // Would normally create actual domain events
          });
        }
      }

      const OrderTrait = DomainObjectFactory.createTrait<
        Order,
        typeof OrderDomain
      >({} as Order, OrderDomain);

      // Test aggregate creation
      const orderResult = await Effect.runPromise(
        Effect.either(
          OrderTrait.new({ customerId: 'cust-123', items: [], total: 0 }),
        ),
      );
      expect(orderResult._tag).toBe('Right');

      if (orderResult._tag === 'Right') {
        const order = orderResult.right;
        expect(order.getItemCount()).toBe(0);
      }
    });
  });

  describe('Complete integration example following user-guide pattern', () => {
    it('should work with the complete pattern from user guide', async () => {
      // 1. Define Props type
      type EmailProps = { value: string };

      // 2. Define the domain model type
      type Email = ValueObjectType<EmailProps>;

      // 3. Define trait interface
      type EmailQuery<R> = QueryFunction<Email, R>;
      interface IEmailTrait extends ValueObjectTrait<Email, string, string> {
        getDomain(): EmailQuery<string>;
        isValid(): EmailQuery<boolean>;
      }

      const EmailSchema = Schema.Struct({
        value: Schema.String.pipe(Schema.includes('@')),
      });

      // 4. Implement with decorated class
      @DomainModel<Email>()
      @ValueObject('Email')
      @WithSchema(EmailSchema)
      class EmailDomain {
        @Invariant('Email must contain @')
        hasAtSymbol(props: EmailProps) {
          return props.value.includes('@');
        }

        @Query()
        getDomain(props: EmailProps) {
          return props.value.split('@')[1];
        }

        @Query()
        isValid(props: EmailProps) {
          return props.value.includes('@') && props.value.includes('.');
        }
      }

      // 5. Create trait with explicit type
      const EmailTrait: IEmailTrait = DomainObjectFactory.createTrait<
        Email,
        typeof EmailDomain
      >({} as Email, EmailDomain);

      // Test the complete implementation
      const validEmailResult = await Effect.runPromise(
        Effect.either(EmailTrait.new('user@example.com')),
      );
      expect(validEmailResult._tag).toBe('Right');

      if (validEmailResult._tag === 'Right') {
        const email = validEmailResult.right;
        expect(email.getDomain()).toBe('example.com');
        expect(email.isValid()).toBe(true);
      }

      // Test validation failure
      const invalidEmailResult = await Effect.runPromise(
        Effect.either(EmailTrait.new('invalid-email')),
      );
      expect(invalidEmailResult._tag).toBe('Left');
    });
  });

  describe('Error handling', () => {
    it('should handle validation exceptions properly', async () => {
      type TestProps = { value: number };
      type Test = ValueObjectType<TestProps>;

      const TestSchema = Schema.Struct({
        value: Schema.Number.pipe(Schema.positive()),
      });

      @DomainModel<Test>()
      @ValueObject('Test')
      @WithSchema(TestSchema)
      class TestDomain {
        @Invariant('Value must be even')
        isEven(props: TestProps) {
          return props.value % 2 === 0;
        }
      }

      const TestTrait = DomainObjectFactory.createTrait<
        Test,
        typeof TestDomain
      >({} as Test, TestDomain);

      // Test schema validation error (negative number)
      const schemaErrorResult = await Effect.runPromise(
        Effect.either(TestTrait.new({ value: -5 })),
      );
      expect(schemaErrorResult._tag).toBe('Left');

      // Test invariant validation error (odd number)
      const invariantErrorResult = await Effect.runPromise(
        Effect.either(TestTrait.parse({ value: 3 })),
      );
      expect(invariantErrorResult._tag).toBe('Left');
      if (invariantErrorResult._tag === 'Left') {
        expect(invariantErrorResult.left).toBeInstanceOf(ValidationException);
      }
    });
  });
});

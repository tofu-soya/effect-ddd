import { Effect, Schema } from 'effect';
import 'reflect-metadata';
import {
  TraitImplementation,
  ValueObjectTrait,
  EntityTrait,
  AggregateRootTrait,
  WithSchema,
  Query,
  Command,
  Invariant,
  createTrait,
} from '../../../src/model/decorators/trait-class.decorator';
import {
  ValueObject,
  Entity,
  AggregateRoot,
} from '../../../src/model/implementations';

describe('Trait Class Decorators', () => {
  describe('Value Object Trait', () => {
    it('should create a properly typed value object trait', async () => {
      // 1. Define Props type
      type EmailProps = { value: string };
      
      // 2. Define the domain model type
      type Email = ValueObject<EmailProps>;

      const EmailSchema = Schema.Struct({
        value: Schema.String.pipe(Schema.includes('@')),
      });

      // 3. Define trait implementation
      @ValueObjectTrait('Email')
      @WithSchema(EmailSchema)
      class EmailTraitImpl extends TraitImplementation<EmailProps> {
        readonly props!: EmailProps;

        @Query()
        getDomain(props: EmailProps): string {
          return props.value.split('@')[1];
        }

        @Query()
        isValid(props: EmailProps): boolean {
          return props.value.includes('@') && props.value.includes('.');
        }

        @Invariant('Email must contain @')
        hasAtSymbol(props: EmailProps): boolean {
          return props.value.includes('@');
        }
      }

      // 4. Create trait
      const EmailTrait = createTrait<Email, EmailProps>(EmailTraitImpl);

      // Test valid email
      const validResult = await Effect.runPromise(
        Effect.either(EmailTrait.new('user@example.com'))
      );
      expect(validResult._tag).toBe('Right');

      if (validResult._tag === 'Right') {
        const email = validResult.right;
        expect(email.getDomain()).toBe('example.com');
        expect(email.isValid()).toBe(true);
        expect(email.unpack()).toEqual({ value: 'user@example.com' });
      }

      // Test invalid email (schema validation)
      const invalidResult = await Effect.runPromise(
        Effect.either(EmailTrait.new('invalid-email'))
      );
      expect(invalidResult._tag).toBe('Left');
    });
  });

  describe('Entity Trait', () => {
    it('should create a properly typed entity trait with commands', async () => {
      // 1. Define Props type
      type UserProps = { name: string; email: string; isActive: boolean };
      
      // 2. Define the domain model type
      type User = Entity<UserProps>;

      const UserSchema = Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        isActive: Schema.Boolean,
      });

      // 3. Define trait implementation
      @EntityTrait('User')
      @WithSchema(UserSchema)
      class UserTraitImpl extends TraitImplementation<UserProps> {
        readonly props!: UserProps;

        @Query()
        getDisplayName(props: UserProps): string {
          return `${props.name} (${props.email})`;
        }

        @Query()
        isActiveUser(props: UserProps): boolean {
          return props.isActive;
        }

        @Command()
        activate(input: void, props: UserProps) {
          return Effect.succeed({ props: { ...props, isActive: true } });
        }

        @Command()
        updateEmail(input: string, props: UserProps) {
          return Effect.succeed({ props: { ...props, email: input } });
        }

        @Invariant('Name cannot be empty')
        hasName(props: UserProps): boolean {
          return props.name.length > 0;
        }
      }

      // 4. Create trait
      const UserTrait = createTrait<User, UserProps>(UserTraitImpl);

      // Test entity creation
      const userResult = await Effect.runPromise(
        Effect.either(UserTrait.new({ name: 'John', email: 'john@example.com', isActive: false }))
      );
      expect(userResult._tag).toBe('Right');

      if (userResult._tag === 'Right') {
        const user = userResult.right;
        
        // Test queries
        expect(user.getDisplayName()).toBe('John (john@example.com)');
        expect(user.isActiveUser()).toBe(false);
        
        // Test command
        const activatedResult = await Effect.runPromise(
          Effect.either(UserTrait.activate()(user))
        );
        expect(activatedResult._tag).toBe('Right');
        
        if (activatedResult._tag === 'Right') {
          const activatedUser = activatedResult.right;
          expect(activatedUser.isActiveUser()).toBe(true);
        }
      }
    });
  });

  describe('Aggregate Root Trait', () => {
    it('should create a properly typed aggregate root trait with domain events', async () => {
      // 1. Define Props type
      type OrderProps = { customerId: string; items: string[]; total: number };
      
      // 2. Define the domain model type
      type Order = AggregateRoot<OrderProps>;

      const OrderSchema = Schema.Struct({
        customerId: Schema.String,
        items: Schema.Array(Schema.String),
        total: Schema.Number,
      });

      // 3. Define trait implementation
      @AggregateRootTrait('Order')
      @WithSchema(OrderSchema)
      class OrderTraitImpl extends TraitImplementation<OrderProps> {
        readonly props!: OrderProps;

        @Query()
        getItemCount(props: OrderProps): number {
          return props.items.length;
        }

        @Query()
        getTotalAmount(props: OrderProps): number {
          return props.total;
        }

        @Command()
        addItem(input: string, props: OrderProps, aggregate: Order, correlationId: string) {
          const newItems = [...props.items, input];
          return Effect.succeed({
            props: { ...props, items: newItems },
            domainEvents: [],
          });
        }

        @Invariant('Total must be non-negative')
        hasValidTotal(props: OrderProps): boolean {
          return props.total >= 0;
        }
      }

      // 4. Create trait
      const OrderTrait = createTrait<Order, OrderProps>(OrderTraitImpl);

      // Test aggregate creation
      const orderResult = await Effect.runPromise(
        Effect.either(OrderTrait.new({ customerId: 'cust-123', items: [], total: 0 }))
      );
      expect(orderResult._tag).toBe('Right');

      if (orderResult._tag === 'Right') {
        const order = orderResult.right;
        
        // Test queries
        expect(order.getItemCount()).toBe(0);
        expect(order.getTotalAmount()).toBe(0);
        
        // Test aggregate command
        const updatedResult = await Effect.runPromise(
          Effect.either(OrderTrait.addItem('item1')(order, 'correlation-123'))
        );
        expect(updatedResult._tag).toBe('Right');
        
        if (updatedResult._tag === 'Right') {
          const updatedOrder = updatedResult.right;
          expect(updatedOrder.getItemCount()).toBe(1);
        }
      }
    });
  });

  describe('Error handling and validation', () => {
    it('should handle schema and invariant validation properly', async () => {
      type TestProps = { value: number };
      type Test = ValueObject<TestProps>;

      const TestSchema = Schema.Struct({
        value: Schema.Number.pipe(Schema.positive()),
      });

      @ValueObjectTrait('Test')
      @WithSchema(TestSchema)
      class TestTraitImpl extends TraitImplementation<TestProps> {
        readonly props!: TestProps;

        @Invariant('Value must be even')
        isEven(props: TestProps): boolean {
          return props.value % 2 === 0;
        }
      }

      const TestTrait = createTrait<Test, TestProps>(TestTraitImpl);

      // Test schema validation error (negative number)
      const schemaError = await Effect.runPromise(
        Effect.either(TestTrait.new({ value: -5 }))
      );
      expect(schemaError._tag).toBe('Left');

      // Test invariant validation error (odd number)  
      const invariantError = await Effect.runPromise(
        Effect.either(TestTrait.parse({ value: 3 }))
      );
      expect(invariantError._tag).toBe('Left');

      // Test successful case
      const success = await Effect.runPromise(
        Effect.either(TestTrait.new({ value: 4 }))
      );
      expect(success._tag).toBe('Right');
    });

    it('should throw error for undecorated class', () => {
      class UndecoratedClass extends TraitImplementation {}

      expect(() => {
        createTrait(UndecoratedClass);
      }).toThrow('Class must be decorated with @ValueObjectTrait, @EntityTrait, or @AggregateRootTrait');
    });
  });

  describe('Type safety', () => {
    it('should provide proper typing for all methods', async () => {
      type PersonProps = { firstName: string; lastName: string; age: number };
      type Person = ValueObject<PersonProps>;

      @ValueObjectTrait('Person')
      class PersonTraitImpl extends TraitImplementation<PersonProps> {
        readonly props!: PersonProps;

        @Query()
        getFullName(props: PersonProps): string {
          return `${props.firstName} ${props.lastName}`;
        }

        @Query()
        isAdult(props: PersonProps): boolean {
          return props.age >= 18;
        }
      }

      const PersonTrait = createTrait<Person, PersonProps>(PersonTraitImpl);

      const personResult = await Effect.runPromise(
        Effect.either(PersonTrait.new({ firstName: 'John', lastName: 'Doe', age: 30 }))
      );

      if (personResult._tag === 'Right') {
        const person = personResult.right;
        
        // These should be properly typed
        const fullName: string = person.getFullName();
        const isAdult: boolean = person.isAdult();
        
        expect(fullName).toBe('John Doe');
        expect(isAdult).toBe(true);
      }
    });
  });
});
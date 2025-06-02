// __tests__/integration/repository-factory.integration.test.ts

import { Effect, Context, Layer, pipe, Option, Schema } from 'effect';
import { DataSource } from 'typeorm';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

// Import repository factory
import {
  createRepositoryWithConventions,
  createRepositoryLayerWithConventions,
  repositoryBuilder,
  withRelations,
  withDomainMapper,
  withQueryMapper,
  build,
  RepositoryFactoryTrait,
} from '../src/ports/database/typeorm/repository.factory';

// Import domain builders from the model module
import {
  createValueObject,
  createEntity,
  createAggregateRoot,
  withSchema,
  withInvariant,
  withNew,
  withQuery,
  withCommand,
  withAggregateCommand,
  withEventHandler,
  buildValueObject,
  buildEntity,
  buildAggregateRoot,
} from '../src/model/builders/domain-builder';

// Import schema builders from the model module (updated API)
import {
  stringSchema,
  numberSchema,
  arraySchema,
  withMinLength,
  withMaxLength,
  withPattern,
  withEmail,
  withUrl,
  withPhoneNumber,
  withNonEmpty,
  withMin,
  withMax,
  withPositive,
  withNonNegative,
  withInteger,
  withStringCustom,
  withNumberCustom,
  withStringBrand,
  withNumberBrand,
  withMinItems,
  withMaxItems,
  withNonEmptyArray,
  withUniqueItems,
  buildStringSchema,
  buildNumberSchema,
  buildArraySchema,
  optionalSchema,
  unionSchema,
  enumSchema,
  createFutureDateSchema,
  createPastDateSchema,
  createTimestampFields,
  createAuditFields,
  CommonSchemas,
} from '../src/model/builders/schema-builder';

import {
  AggregateRoot,
  Entity as DomainEntity,
  ValueObject,
  IDomainEvent,
} from '../src/model';

import { Identifier, IdentifierTrait } from '../src/typeclasses';
import { DataSourceContext } from '../src/ports/database/typeorm/effect-repository.factory';
import { ValidationException } from '../src/model/exception';
import { DomainEventTrait } from '@model/implementations/domain-event.impl';

// ===== SCHEMA DEFINITIONS USING UPDATED SCHEMA BUILDER =====

// Email schema using schema builder
const EmailSchema = pipe(
  stringSchema(),
  withEmail('Invalid email format'),
  withStringBrand('Email'),
);

// Phone number schema using schema builder
const PhoneNumberSchema = pipe(
  stringSchema(),
  withPhoneNumber('Invalid phone number format'),
  withStringBrand('PhoneNumber'),
);

// Product SKU schema with custom validation
const ProductSKUSchema = pipe(
  stringSchema(),
  withPattern(
    /^[A-Z0-9-]+$/,
    'SKU must contain only letters, numbers, and hyphens',
  ),
  withMinLength(3, 'SKU too short'),
  withMaxLength(20, 'SKU too long'),
  withStringBrand('ProductSKU'),
);

// Price schema using number builder
const PriceSchema = pipe(
  numberSchema(),
  withPositive('Price must be positive'),
  withMax(999999.99, 'Price too high'),
  withNumberBrand('Price'),
);

// Quantity schema
const QuantitySchema = pipe(
  numberSchema(),
  withPositive('Quantity must be positive'),
  withInteger('Quantity must be a whole number'),
  withMax(1000, 'Quantity too high'),
  withNumberBrand('Quantity'),
);

// ZIP code schema with custom validation
const ZipCodeSchema = pipe(
  stringSchema(),
  withPattern(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  withStringBrand('ZipCode'),
);

// Order status enum
enum OrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

const OrderStatusSchema = enumSchema(OrderStatus);

// Tags array schema
const TagsSchema = pipe(
  arraySchema(CommonSchemas.NonEmptyString),
  withMinItems(1, 'At least one tag is required'),
  withMaxItems(5, 'Maximum 5 tags allowed'),
  withUniqueItems('Tags must be unique'),
  buildArraySchema,
);

// ===== DOMAIN MODELS USING DOMAIN BUILDER =====

// Email Value Object
interface EmailProps {
  value: Schema.Schema.Type<typeof EmailSchema>;
}

interface Email extends ValueObject<EmailProps> { }


const EmailTrait = pipe(
  createValueObject<Email, string>('Email'),
  withSchema(
    Schema.Struct({
      value: EmailSchema,
    }),
  ),
  withNew((emailString: string, parser) =>
    parser(emailString.toLowerCase().trim()),
  ),
  withQuery('getDomain', (props) => props.value.split('@')[1]),
  withQuery('isGmail', (props) => props.value.endsWith('@gmail.com')),
  withInvariant(
    (props) => props.value.includes('@'),
    'Email must contain @ symbol',
  ),
  buildValueObject,
);


// Address Value Object using common schemas
interface AddressProps {
  street: string;
  city: string;
  country: string;
  zipCode: string;
}

interface Address extends ValueObject<AddressProps> { }

const AddressTrait = pipe(
  createValueObject<AddressProps>('Address'),
  withSchema(
    Schema.Struct({
      street: CommonSchemas.NonEmptyString,
      city: CommonSchemas.NonEmptyString,
      country: CommonSchemas.NonEmptyString,
      zipCode: ZipCodeSchema,
    }),
  ),
  withQuery(
    'getFullAddress',
    (props) =>
      `${props.street}, ${props.city}, ${props.country} ${props.zipCode}`,
  ),
  withQuery('isUSAddress', (props) => props.country.toUpperCase() === 'USA'),
  withInvariant(
    (props) => props.street.length > 0 && props.city.length > 0,
    'Address must have street and city',
  ),
  buildValueObject,
);

// Product Value Object
interface ProductProps {
  name: string;
  sku: string;
  price: number;
  category: string;
  tags: string[];
}

interface Product extends ValueObject<ProductProps> { }

const ProductTrait = pipe(
  createValueObject<ProductProps>('Product'),
  withSchema(
    Schema.Struct({
      name: CommonSchemas.NonEmptyString,
      sku: ProductSKUSchema,
      price: PriceSchema,
      category: CommonSchemas.NonEmptyString,
      tags: TagsSchema,
    }),
  ),
  withQuery('getDisplayName', (props) => `${props.name} (${props.sku})`),
  withQuery('isExpensive', (props) => props.price > 500),
  withQuery('isPremium', (props) => props.tags.includes('premium')),
  withQuery('getFormattedPrice', (props) => `$${props.price.toFixed(2)}`),
  withInvariant((props) => props.price > 0, 'Product price must be positive'),
  withInvariant(
    (props) => props.sku.length >= 3,
    'Product SKU must be at least 3 characters',
  ),
  buildValueObject,
);

// Order Item Value Object
interface OrderItemProps {
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface OrderItem extends ValueObject<OrderItemProps> { }

const OrderItemTrait = pipe(
  createValueObject<
    OrderItemProps,
    { product: ProductProps; quantity: number; unitPrice: number }
  >('OrderItem'),
  withNew(
    (input: { product: ProductProps; quantity: number; unitPrice: number }) =>
      Effect.gen(function*() {
        const product = yield* ProductTrait.new(input.product);
        const lineTotal = input.quantity * input.unitPrice;

        return {
          product,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          lineTotal,
        };
      }),
  ),
  withQuery('getLineTotal', (props) => props.lineTotal),
  withQuery('getProductName', (props) => props.product.props.name),
  withQuery('getProductSKU', (props) => props.product.props.sku),
  withQuery('isHighValue', (props) => props.lineTotal > 1000),
  withInvariant(
    (props) =>
      Math.abs(props.lineTotal - props.quantity * props.unitPrice) < 0.01,
    'Line total must equal quantity times unit price',
  ),
  withInvariant((props) => props.quantity > 0, 'Quantity must be positive'),
  buildValueObject,
);

// Customer Entity
interface CustomerProps {
  name: string;
  email: Email;
  phone: Option.Option<string>;
  address: Option.Option<Address>;
  isActive: boolean;
  registrationDate: Date;
  tags: string[];
}

interface Customer extends DomainEntity<CustomerProps> { }

const CustomerTrait = pipe(
  createEntity<
    CustomerProps,
    {
      name: string;
      email: string;
      phone?: string;
      address?: AddressProps;
      tags?: string[];
    }
  >('Customer'),
  withNew((input) =>
    Effect.gen(function*() {
      const email = yield* EmailTrait.new(input.email);
      const address = input.address
        ? pipe(AddressTrait.new(input.address), Effect.map(Option.some))
        : Effect.succeed(Option.none());

      const addr = yield* address;

      return {
        name: input.name.trim(),
        email,
        phone: input.phone ? Option.some(input.phone) : Option.none(),
        address: addr,
        isActive: true,
        registrationDate: new Date(),
        tags: input.tags || [],
      };
    }),
  ),
  withQuery('isActive', (props) => props.isActive),
  withQuery(
    'getDisplayName',
    (props) => `${props.name} (${props.email.props.value})`,
  ),
  withQuery('hasAddress', (props) => Option.isSome(props.address)),
  withQuery('hasPhone', (props) => Option.isSome(props.phone)),
  withQuery('isVIP', (props) => props.tags.includes('VIP')),
  withQuery('getEmailDomain', (props) => props.email.getDomain()),
  withCommand('deactivate', (_, props) =>
    Effect.succeed({ ...props, isActive: false }),
  ),
  withCommand('activate', (_, props) =>
    Effect.succeed({ ...props, isActive: true }),
  ),
  withCommand('updateAddress', (newAddress: AddressProps, props) =>
    Effect.gen(function*() {
      const address = yield* AddressTrait.new(newAddress);
      return { ...props, address: Option.some(address) };
    }),
  ),
  withCommand('addTag', (tag: string, props) =>
    Effect.succeed({
      ...props,
      tags: props.tags.includes(tag) ? props.tags : [...props.tags, tag],
    }),
  ),
  withCommand('removeTag', (tag: string, props) =>
    Effect.succeed({
      ...props,
      tags: props.tags.filter((t) => t !== tag),
    }),
  ),
  buildEntity,
);

// Order Aggregate Root
interface OrderProps {
  customerId: Identifier;
  orderNumber: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  orderDate: Date;
  shippingAddress: Option.Option<Address>;
  notes: Option.Option<string>;
  tags: string[];
}

interface Order extends AggregateRoot<OrderProps> { }

const OrderTrait = pipe(
  createAggregateRoot<
    OrderProps,
    {
      customerId: string;
      orderNumber: string;
      items: Array<{
        product: ProductProps;
        quantity: number;
        unitPrice: number;
      }>;
      shippingAddress?: AddressProps;
      notes?: string;
      tags?: string[];
    }
  >('Order'),
  withNew((input) =>
    Effect.gen(function*() {
      const items = yield* Effect.all(
        input.items.map((item) => OrderItemTrait.new(item)),
      );

      const totalAmount = items.reduce(
        (sum, item) => sum + item.props.lineTotal,
        0,
      );

      const shippingAddress = input.shippingAddress
        ? pipe(AddressTrait.new(input.shippingAddress), Effect.map(Option.some))
        : Effect.succeed(Option.none());

      const addr = yield* shippingAddress;

      return {
        customerId: input.customerId as Identifier,
        orderNumber: input.orderNumber,
        items,
        status: OrderStatus.DRAFT,
        totalAmount,
        orderDate: new Date(),
        shippingAddress: addr,
        notes: input.notes ? Option.some(input.notes) : Option.none(),
        tags: input.tags || [],
      };
    }),
  ),
  withQuery('getItemCount', (props) => props.items.length),
  withQuery('isEmpty', (props) => props.items.length === 0),
  withQuery('canBeModified', (props) =>
    [OrderStatus.DRAFT, OrderStatus.PENDING].includes(props.status),
  ),
  withQuery('getTotalAmount', (props) => props.totalAmount),
  withQuery('hasShippingAddress', (props) =>
    Option.isSome(props.shippingAddress),
  ),
  withQuery('isUrgent', (props) => props.tags.includes('urgent')),
  withQuery('isLargeOrder', (props) => props.totalAmount > 1000),
  withQuery('getFormattedTotal', (props) => `$${props.totalAmount.toFixed(2)}`),
  withInvariant(
    (props) => props.items.length > 0,
    'Order must contain at least one item',
  ),
  withInvariant(
    (props) => props.totalAmount > 0,
    'Order total must be positive',
  ),
  withInvariant((props) => {
    const calculatedTotal = props.items.reduce(
      (sum, item) => sum + item.props.lineTotal,
      0,
    );
    return Math.abs(calculatedTotal - props.totalAmount) < 0.01;
  }, 'Order total must match sum of line items'),
  withAggregateCommand('confirm', (_, props, order, correlationId) =>
    Effect.gen(function*() {
      if (props.status !== OrderStatus.PENDING) {
        return yield* Effect.fail(
          ValidationException.new(
            'INVALID_STATUS',
            `Cannot confirm order with status: ${props.status}`,
          ),
        );
      }

      const confirmedEvent = .create({
        name: 'OrderConfirmed',
        payload: { orderId: order.id, confirmedAt: new Date() },
        correlationId,
        aggregate: order,
      });

      return {
        props: { ...props, status: OrderStatus.CONFIRMED },
        domainEvents: [confirmedEvent],
      };
    }),
  ),
  withAggregateCommand(
    'cancel',
    (reason: string, props, order, correlationId) =>
      Effect.gen(function*() {
        if (
          [OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(props.status)
        ) {
          return yield* Effect.fail(
            ValidationException.new(
              'INVALID_STATUS',
              `Cannot cancel order with status: ${props.status}`,
            ),
          );
        }

        const cancelledEvent = DomainEventTrait.create({
          name: 'OrderCancelled',
          payload: { orderId: order.id, reason, cancelledAt: new Date() },
          correlationId,
          aggregate: order,
        });

        return {
          props: { ...props, status: OrderStatus.CANCELLED },
          domainEvents: [cancelledEvent],
        };
      }),
  ),
  withAggregateCommand(
    'ship',
    (
      shippingInfo: { address: AddressProps; trackingNumber: string },
      props,
      order,
      correlationId,
    ) =>
      Effect.gen(function*() {
        if (props.status !== OrderStatus.CONFIRMED) {
          return yield* Effect.fail(
            ValidationException.new(
              'INVALID_STATUS',
              `Cannot ship order with status: ${props.status}`,
            ),
          );
        }

        const shippingAddress = yield* AddressTrait.new(shippingInfo.address);

        const shippedEvent = DomainEventTrait.create({
          name: 'OrderShipped',
          payload: {
            orderId: order.id,
            trackingNumber: shippingInfo.trackingNumber,
            shippedAt: new Date(),
          },
          correlationId,
          aggregate: order,
        });

        return {
          props: {
            ...props,
            status: OrderStatus.SHIPPED,
            shippingAddress: Option.some(shippingAddress),
          },
          domainEvents: [shippedEvent],
        };
      }),
  ),
  withAggregateCommand('addTag', (tag: string, props, order, correlationId) =>
    Effect.succeed({
      props: {
        ...props,
        tags: props.tags.includes(tag) ? props.tags : [...props.tags, tag],
      },
      domainEvents: [],
    }),
  ),
  withEventHandler('OrderConfirmed', (event) => {
    console.log(
      `Order ${event.aggregateId} confirmed at ${event.payload.confirmedAt}`,
    );
  }),
  withEventHandler('OrderCancelled', (event) => {
    console.log(
      `Order ${event.aggregateId} cancelled: ${event.payload.reason}`,
    );
  }),
  withEventHandler('OrderShipped', (event) => {
    console.log(
      `Order ${event.aggregateId} shipped with tracking: ${event.payload.trackingNumber}`,
    );
  }),
  buildAggregateRoot,
);

// ===== TYPEORM ENTITIES =====

@Entity('customers')
class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string | null;

  @Column('json', { nullable: true })
  address: {
    street: string;
    city: string;
    country: string;
    zipCode: string;
  } | null;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  registrationDate: Date;

  @Column('json', { default: '[]' })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderEntity, (order) => order.customer)
  orders: OrderEntity[];
}

@Entity('orders')
class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  customerId: string;

  @Column()
  orderNumber: string;

  @Column('json')
  items: {
    product: {
      name: string;
      sku: string;
      price: number;
      category: string;
      tags: string[];
    };
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];

  @Column()
  status: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column()
  orderDate: Date;

  @Column('json', { nullable: true })
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    zipCode: string;
  } | null;

  @Column({ nullable: true })
  notes: string | null;

  @Column('json', { default: '[]' })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => CustomerEntity, (customer) => customer.orders)
  @JoinColumn({ name: 'customerId' })
  customer: CustomerEntity;
}

// ===== TEST SETUP =====

const createTestDataSource = () =>
  new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    logging: false,
    entities: [CustomerEntity, OrderEntity],
  });

const CustomerRepositoryTag = Context.Tag<any>('CustomerRepository');
const OrderRepositoryTag = Context.Tag<any>('OrderRepository');

// ===== REPOSITORY LAYERS =====

const CustomerRepositoryLayer = createRepositoryLayerWithConventions(
  CustomerRepositoryTag,
  {
    entityClass: CustomerEntity,
    domainTrait: {
      parse: (ormEntity: CustomerEntity) =>
        CustomerTrait.parse({
          name: ormEntity.name,
          email: ormEntity.email,
          phone: ormEntity.phone,
          address: ormEntity.address,
          isActive: ormEntity.isActive,
          registrationDate: ormEntity.registrationDate,
          tags: ormEntity.tags,
          id: ormEntity.id,
          createdAt: ormEntity.createdAt,
          updatedAt: ormEntity.updatedAt,
        }),
    },
    relations: ['orders'],
  },
);

const OrderRepositoryLayer = pipe(
  repositoryBuilder<
    Order,
    OrderEntity,
    { customerId?: string; status?: string; orderNumber?: string }
  >(OrderEntity),
  withRelations(['customer']),
  withDomainMapper((ormEntity: OrderEntity) =>
    OrderTrait.parse({
      customerId: ormEntity.customerId,
      orderNumber: ormEntity.orderNumber,
      items: ormEntity.items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      shippingAddress: ormEntity.shippingAddress,
      notes: ormEntity.notes,
      tags: ormEntity.tags,
      id: ormEntity.id,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
      domainEvents: [],
    }),
  ),
  withQueryMapper(
    (params: {
      customerId?: string;
      status?: string;
      orderNumber?: string;
    }) => ({
      ...(params.customerId && { customerId: params.customerId }),
      ...(params.status && { status: params.status }),
      ...(params.orderNumber && { orderNumber: params.orderNumber }),
    }),
  ),
  (builder) => Layer.effect(OrderRepositoryTag, build(builder)),
);

// ===== INTEGRATION TESTS =====

describe('Repository Factory - Integration Tests with Updated Schema Builder', () => {
  let dataSource: DataSource;
  let runtime: Effect.Runtime.Runtime<never>;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();

    const DataSourceLayer = Layer.succeed(DataSourceContext, dataSource);
    const AppLayer = Layer.mergeAll(
      DataSourceLayer,
      CustomerRepositoryLayer,
      OrderRepositoryLayer,
    );

    runtime = await Effect.runPromise(
      pipe(Effect.runtime<never>(), Effect.provide(AppLayer)),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.manager.clear(OrderEntity);
    await dataSource.manager.clear(CustomerEntity);
  });

  describe('Updated Schema Builder Validation', () => {
    it('should validate email using updated schema builder', async () => {
      const validEmails = ['user@example.com', 'test.email+tag@domain.co.uk'];
      const invalidEmails = ['not-email', '@invalid.com', 'user@', 'user@.com'];

      for (const email of validEmails) {
        const result = await Effect.runPromise(
          EmailTrait.new(email).pipe(Effect.either),
        );
        expect(result._tag).toBe('Right');
        if (result._tag === 'Right') {
          expect(result.right.getDomain()).toBeDefined();
          expect(typeof result.right.isGmail()).toBe('boolean');
        }
      }

      for (const email of invalidEmails) {
        const result = await Effect.runPromise(
          EmailTrait.new(email).pipe(Effect.either),
        );
        expect(result._tag).toBe('Left');
      }
    });

    it('should validate product with complex schema constraints', async () => {
      const validProduct = {
        name: 'MacBook Pro',
        sku: 'MBP-2024-001',
        price: 2999.99,
        category: 'Electronics',
        tags: ['premium', 'laptop', 'apple'],
      };

      const invalidProducts = [
        { ...validProduct, name: '' }, // Empty name
        { ...validProduct, sku: 'invalid sku' }, // Invalid SKU format
        { ...validProduct, price: -100 }, // Negative price
        { ...validProduct, price: 9999999 }, // Price too high
        { ...validProduct, tags: [] }, // Empty tags (violates min items)
        { ...validProduct, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }, // Too many tags
        { ...validProduct, tags: ['duplicate', 'duplicate'] }, // Duplicate tags
      ];

      const validResult = await Effect.runPromise(
        ProductTrait.new(validProduct).pipe(Effect.either),
      );
      expect(validResult._tag).toBe('Right');
      if (validResult._tag === 'Right') {
        expect(validResult.right.isExpensive()).toBe(true);
        expect(validResult.right.isPremium()).toBe(true);
        expect(validResult.right.getFormattedPrice()).toBe('$2999.99');
      }

      for (const product of invalidProducts) {
        const result = await Effect.runPromise(
          ProductTrait.new(product).pipe(Effect.either),
        );
        expect(result._tag).toBe('Left');
      }
    });

    it('should validate ZIP codes using pattern schema', async () => {
      const validZipCodes = ['12345', '12345-6789'];
      const invalidZipCodes = ['123', '12345-67', 'ABCDE', '12345-ABCD'];

      for (const zipCode of validZipCodes) {
        const address = {
          street: '123 Test St',
          city: 'Test City',
          country: 'USA',
          zipCode,
        };

        const result = await Effect.runPromise(
          AddressTrait.new(address).pipe(Effect.either),
        );
        expect(result._tag).toBe('Right');
      }

      for (const zipCode of invalidZipCodes) {
        const address = {
          street: '123 Test St',
          city: 'Test City',
          country: 'USA',
          zipCode,
        };

        const result = await Effect.runPromise(
          AddressTrait.new(address).pipe(Effect.either),
        );
        expect(result._tag).toBe('Left');
      }
    });

    it('should validate arrays with constraints using array schema builder', async () => {
      const validTags = ['electronics', 'premium'];
      const emptyTags: string[] = [];
      const tooManyTags = ['a', 'b', 'c', 'd', 'e', 'f'];
      const duplicateTags = ['electronics', 'electronics'];

      const product = {
        name: 'Test Product',
        sku: 'TEST-001',
        price: 100,
        category: 'Test',
      };

      // Valid tags
      const validResult = await Effect.runPromise(
        ProductTrait.new({ ...product, tags: validTags }).pipe(Effect.either),
      );
      expect(validResult._tag).toBe('Right');

      // Empty tags (should fail)
      const emptyResult = await Effect.runPromise(
        ProductTrait.new({ ...product, tags: emptyTags }).pipe(Effect.either),
      );
      expect(emptyResult._tag).toBe('Left');

      // Too many tags (should fail)
      const tooManyResult = await Effect.runPromise(
        ProductTrait.new({ ...product, tags: tooManyTags }).pipe(Effect.either),
      );
      expect(tooManyResult._tag).toBe('Left');

      // Duplicate tags (should fail)
      const duplicateResult = await Effect.runPromise(
        ProductTrait.new({ ...product, tags: duplicateTags }).pipe(
          Effect.either,
        ),
      );
      expect(duplicateResult._tag).toBe('Left');
    });

    it('should validate numbers with branded types', async () => {
      const validPrice = 99.99;
      const invalidPrice = -10;
      const tooHighPrice = 10000000;

      const validResult = await Effect.runPromise(
        Effect.succeed(validPrice).pipe(
          Effect.flatMap((price) => Schema.decode(PriceSchema)(price)),
          Effect.either,
        ),
      );
      expect(validResult._tag).toBe('Right');

      const invalidResult = await Effect.runPromise(
        Effect.succeed(invalidPrice).pipe(
          Effect.flatMap((price) => Schema.decode(PriceSchema)(price)),
          Effect.either,
        ),
      );
      expect(invalidResult._tag).toBe('Left');

      const tooHighResult = await Effect.runPromise(
        Effect.succeed(tooHighPrice).pipe(
          Effect.flatMap((price) => Schema.decode(PriceSchema)(price)),
          Effect.either,
        ),
      );
      expect(tooHighResult._tag).toBe('Left');
    });
  });

  describe('Common Schemas Usage', () => {
    it('should use CommonSchemas for standard validation', async () => {
      const customer = {
        name: 'John Doe',
        email: 'john@example.com',
        tags: ['VIP', 'premium-customer'],
      };

      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const customerRepo = yield* CustomerRepositoryTag;

          const newCustomer = yield* CustomerTrait.new(customer);
          yield* customerRepo.add(newCustomer);

          return newCustomer;
        }).pipe(Effect.provide(runtime)),
      );

      expect(result.isVIP()).toBe(true);
      expect(result.getEmailDomain()).toBe('example.com');
    });
  });

  describe('Domain Builder Entity Operations with Enhanced Queries', () => {
    it('should create customer with enhanced query methods', async () => {
      const customerData = {
        name: 'Jane Smith',
        email: 'jane.smith@gmail.com',
        phone: '+1-555-0123',
        address: {
          street: '456 Oak Ave',
          city: 'Boston',
          country: 'USA',
          zipCode: '02101',
        },
        tags: ['VIP', 'enterprise'],
      };

      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const customerRepo = yield* CustomerRepositoryTag;

          const customer = yield* CustomerTrait.new(customerData);
          yield* customerRepo.add(customer);

          const retrieved = yield* customerRepo.findOneOrThrow({
            email: customerData.email,
          });

          return retrieved;
        }).pipe(Effect.provide(runtime)),
      );

      // Test enhanced queries
      expect(result.isActive()).toBe(true);
      expect(result.hasAddress()).toBe(true);
      expect(result.hasPhone()).toBe(true);
      expect(result.isVIP()).toBe(true);
      expect(result.getEmailDomain()).toBe('gmail.com');
      expect(result.props.email.isGmail()).toBe(true);
    });

    it('should execute customer tag management commands', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const customerRepo = yield* CustomerRepositoryTag;

          const customer = yield* CustomerTrait.new({
            name: 'Tag Test Customer',
            email: 'tags@example.com',
            tags: ['existing-tag'],
          });
          yield* customerRepo.add(customer);

          // Add tag
          const withNewTag = yield* CustomerTrait.addTag('premium')(customer);
          yield* customerRepo.save(withNewTag);

          // Add duplicate tag (should not duplicate)
          const withDuplicateAttempt =
            yield* CustomerTrait.addTag('premium')(withNewTag);
          yield* customerRepo.save(withDuplicateAttempt);

          // Remove tag
          const withRemovedTag =
            yield* CustomerTrait.removeTag('existing-tag')(
              withDuplicateAttempt,
            );
          yield* customerRepo.save(withRemovedTag);

          const final = yield* customerRepo.findOneByIdOrThrow(customer.id);

          return final;
        }).pipe(Effect.provide(runtime)),
      );

      expect(result.props.tags).toEqual(['premium']);
    });
  });

  describe('Order Aggregate with Enhanced Business Logic', () => {
    let customerId: Identifier;

    beforeEach(async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const customerRepo = yield* CustomerRepositoryTag;

          const customer = yield* CustomerTrait.new({
            name: 'Order Test Customer',
            email: 'orders@example.com',
          });

          yield* customerRepo.add(customer);
          return customer;
        }).pipe(Effect.provide(runtime)),
      );

      customerId = result.id;
    });

    it('should create order with complex validation and enhanced queries', async () => {
      const orderData = {
        customerId,
        orderNumber: 'ORD-COMPLEX-001',
        items: [
          {
            product: {
              name: 'Premium Laptop',
              sku: 'LAPTOP-001',
              price: 1999.99,
              category: 'Electronics',
              tags: ['premium', 'laptop'],
            },
            quantity: 1,
            unitPrice: 1999.99,
          },
          {
            product: {
              name: 'Wireless Mouse',
              sku: 'MOUSE-001',
              price: 59.99,
              category: 'Accessories',
              tags: ['wireless', 'ergonomic'],
            },
            quantity: 2,
            unitPrice: 59.99,
          },
        ],
        shippingAddress: {
          street: '789 Pine St',
          city: 'Seattle',
          country: 'USA',
          zipCode: '98101',
        },
        notes: 'Express delivery requested',
        tags: ['urgent', 'express'],
      };

      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const orderRepo = yield* OrderRepositoryTag;

          const order = yield* OrderTrait.new(orderData);
          yield* orderRepo.add(order);

          const retrieved = yield* orderRepo.findOneOrThrow({
            orderNumber: orderData.orderNumber,
          });

          return retrieved;
        }).pipe(Effect.provide(runtime)),
      );

      // Test enhanced queries
      expect(result.getItemCount()).toBe(2);
      expect(result.isEmpty()).toBe(false);
      expect(result.canBeModified()).toBe(true);
      expect(result.getTotalAmount()).toBe(2119.97);
      expect(result.hasShippingAddress()).toBe(true);
      expect(result.isUrgent()).toBe(true);
      expect(result.isLargeOrder()).toBe(true);
      expect(result.getFormattedTotal()).toBe('$2119.97');

      // Test order item queries
      const firstItem = result.props.items[0];
      expect(firstItem.getProductName()).toBe('Premium Laptop');
      expect(firstItem.getProductSKU()).toBe('LAPTOP-001');
      expect(firstItem.isHighValue()).toBe(true);
    });

    it('should execute order commands with status enum validation', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const orderRepo = yield* OrderRepositoryTag;

          // Create order
          const order = yield* OrderTrait.new({
            customerId,
            orderNumber: 'ORD-STATUS-001',
            items: [
              {
                product: {
                  name: 'Status Test Product',
                  sku: 'STATUS-001',
                  price: 299.99,
                  category: 'Test',
                  tags: ['test'],
                },
                quantity: 1,
                unitPrice: 299.99,
              },
            ],
            tags: ['priority'],
          });

          // Set to pending status first
          const pendingOrder = {
            ...order,
            props: { ...order.props, status: OrderStatus.PENDING },
          };
          yield* orderRepo.add(pendingOrder);

          // Confirm order
          const confirmedOrder = yield* OrderTrait.confirm()(pendingOrder);
          yield* orderRepo.save(confirmedOrder);

          // Add tag to confirmed order
          const taggedOrder =
            yield* OrderTrait.addTag('confirmed-order')(confirmedOrder);
          yield* orderRepo.save(taggedOrder);

          // Ship order
          const shippedOrder = yield* OrderTrait.ship({
            address: {
              street: '123 Delivery St',
              city: 'Portland',
              country: 'USA',
              zipCode: '97201',
            },
            trackingNumber: 'TRK987654',
          })(taggedOrder);
          yield* orderRepo.save(shippedOrder);

          return { confirmed: confirmedOrder, shipped: shippedOrder };
        }).pipe(Effect.provide(runtime)),
      );

      // Test status transitions
      expect(result.confirmed.props.status).toBe(OrderStatus.CONFIRMED);
      expect(result.shipped.props.status).toBe(OrderStatus.SHIPPED);

      // Test events
      expect(result.confirmed.domainEvents[0].name).toBe('OrderConfirmed');
      expect(result.shipped.domainEvents[0].name).toBe('OrderShipped');
      expect(result.shipped.domainEvents[0].payload.trackingNumber).toBe(
        'TRK987654',
      );

      // Test tag was added
      expect(result.shipped.props.tags).toContain('confirmed-order');
    });

    it('should validate enum constraints in order status', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function*() {
          // Try to create order with invalid status (should fail during validation)
          return yield* Schema.decode(OrderStatusSchema)('invalid-status');
        }).pipe(Effect.either),
      );

      expect(result._tag).toBe('Left');
    });
  });

  describe('Performance with Complex Schema Validation', () => {
    it('should handle bulk operations with complex schema validation efficiently', async () => {
      const startTime = Date.now();

      const result = await Effect.runPromise(
        Effect.gen(function*() {
          const customerRepo = yield* CustomerRepositoryTag;

          // Create 20 customers with complex validation
          const customers = yield* Effect.all(
            Array.from({ length: 20 }, (_, i) =>
              CustomerTrait.new({
                name: `Bulk Customer ${i}`,
                email: `bulk${i}@test${i % 3 === 0 ? '-gmail' : ''}.com`,
                ...(i % 4 === 0 && {
                  address: {
                    street: `${100 + i} Bulk St`,
                    city: 'Bulk City',
                    country: 'USA',
                    zipCode: i % 2 === 0 ? '12345' : '98765-4321',
                  },
                }),
                ...(i % 3 === 0 && {
                  phone: `+1-555-${String(i).padStart(4, '0')}`,
                }),
                tags: i % 5 === 0 ? ['VIP', 'priority'] : ['standard'],
              }),
            ),
            { concurrency: 5 },
          );

          yield* customerRepo.saveMultiple(customers);

          const allCustomers = yield* customerRepo.findMany({});
          const vipCustomers = allCustomers.filter((c) => c.isVIP());
          const gmailCustomers = allCustomers.filter((c) =>
            c.props.email.isGmail(),
          );
          const withAddress = allCustomers.filter((c) => c.hasAddress());

          return {
            total: allCustomers.length,
            vip: vipCustomers.length,
            gmail: gmailCustomers.length,
            withAddress: withAddress.length,
          };
        }).pipe(Effect.provide(runtime)),
      );

      const endTime = Date.now();

      expect(result.total).toBe(20);
      expect(result.vip).toBe(4); // Every 5th customer
      expect(result.gmail).toBe(7); // Every 3rd customer has gmail
      expect(result.withAddress).toBe(5); // Every 4th customer
      expect(endTime - startTime).toBeLessThan(8000); // Should complete within 8 seconds
    });
  });
});

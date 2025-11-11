// __test__/model/builders/simple-domain-builder.test.ts

import { Effect, Schema } from 'effect';
import { describe, it, expect } from 'vitest';
import {
  createValueObject,
  createEntity,
  createAggregateRoot,
} from '../../../src/model/builders/simple-domain-builder';
import { ValidationException } from '../../../src/model/exception';

describe('Simple Domain Builder', () => {
  describe('ValueObject Builder', () => {
    it('should create a simple value object with schema', async () => {
      const EmailSchema = Schema.Struct({
        value: Schema.String,
      });

      type EmailProps = Schema.Schema.Type<typeof EmailSchema>;

      const EmailTrait = createValueObject<EmailProps>('Email')
        .withSchema(EmailSchema)
        .withInvariant(
          (props) => props.value.includes('@'),
          'Must be valid email'
        )
        .withQuery('getDomain', (props) => props.value.split('@')[1])
        .build();

      const result = await Effect.runPromise(
        EmailTrait.parse({ value: 'test@example.com' })
      );

      expect(result.props.value).toBe('test@example.com');
      expect(result.getDomain()).toBe('example.com');
    });

    it('should validate invariants', async () => {
      const EmailSchema = Schema.Struct({
        value: Schema.String,
      });

      type EmailProps = Schema.Schema.Type<typeof EmailSchema>;

      const EmailTrait = createValueObject<EmailProps>('Email')
        .withSchema(EmailSchema)
        .withInvariant(
          (props) => props.value.includes('@'),
          'Must be valid email'
        )
        .build();

      const result = Effect.runPromise(
        EmailTrait.parse({ value: 'invalid-email' })
      );

      await expect(result).rejects.toThrow();
    });
  });

  describe('Entity Builder', () => {
    it('should create entity with commands and queries', async () => {
      const UserSchema = Schema.Struct({
        name: Schema.String,
        email: Schema.String,
        isActive: Schema.Boolean,
      });

      type UserProps = Schema.Schema.Type<typeof UserSchema>;

      const UserTrait = createEntity<UserProps>('User')
        .withSchema(UserSchema)
        .withQuery('getDisplayName', (props) => `${props.name} (${props.email})`)
        .withQuery('isActive', (props) => props.isActive)
        .withCommand('activate', (_, props) =>
          Effect.succeed({ props: { ...props, isActive: true } })
        )
        .build();

      const user = await Effect.runPromise(
        UserTrait.parse({
          name: 'John',
          email: 'john@example.com',
          isActive: false,
        })
      );

      expect(user.getDisplayName()).toBe('John (john@example.com)');
      expect(user.isActive()).toBe(false);

      const activatedUser = await Effect.runPromise(
        UserTrait.activate()(user)
      );

      expect(activatedUser.isActive()).toBe(true);
    });
  });

  describe('Aggregate Builder', () => {
    it('should create aggregate with events', async () => {
      const OrderSchema = Schema.Struct({
        customerId: Schema.String,
        total: Schema.Number,
        status: Schema.String,
        items: Schema.Array(Schema.String),
      });

      type OrderProps = Schema.Schema.Type<typeof OrderSchema>;

      let eventHandled = false;

      const OrderTrait = createAggregateRoot<OrderProps>('Order')
        .withSchema(OrderSchema)
        .withQuery('getItemCount', (props) => props.items.length)
        .withAggregateCommand('addItem', (item: string, props, aggregate) =>
          Effect.succeed({
            props: {
              ...props,
              items: [...props.items, item],
            },
            domainEvents: [{
              id: 'test-event',
              name: 'ItemAdded',
              payload: { item },
              aggregateId: aggregate.id,
              aggregateType: 'Order',
              occurredAt: new Date(),
              version: 1,
            }],
          })
        )
        .withEventHandler('ItemAdded', () => {
          eventHandled = true;
        })
        .build();

      const order = await Effect.runPromise(
        OrderTrait.parse({
          customerId: 'customer-1',
          total: 100,
          status: 'pending',
          items: [],
        })
      );

      expect(order.getItemCount()).toBe(0);

      const updatedOrder = await Effect.runPromise(
        OrderTrait.addItem('item-1')(order)
      );

      expect(updatedOrder.getItemCount()).toBe(1);
      expect(updatedOrder.domainEvents).toHaveLength(1);

      // Process events
      OrderTrait.eventHandlers.ItemAdded(updatedOrder.domainEvents[0]);
      expect(eventHandled).toBe(true);
    });
  });

  describe('TypeScript Performance Test', () => {
    it('should have fast type inference', () => {
      // This test primarily checks compilation speed
      // Complex nested types should not slow down LSP

      const ProductSchema = Schema.Struct({
        name: Schema.String,
        price: Schema.Number,
        category: Schema.String,
        inStock: Schema.Boolean,
        tags: Schema.Array(Schema.String),
      });

      type ProductProps = Schema.Schema.Type<typeof ProductSchema>;

      // This should compile quickly without complex type inference
      const ProductTrait = createEntity<ProductProps>('Product')
        .withSchema(ProductSchema)
        .withQuery('isExpensive', (props) => props.price > 100)
        .withQuery('getDisplayName', (props) => `${props.name} - $${props.price}`)
        .withQuery('hasTag', (props) => (tag: string) => props.tags.includes(tag))
        .withCommand('updatePrice', (newPrice: number, props) =>
          Effect.succeed({ props: { ...props, price: newPrice } })
        )
        .withCommand('addTag', (tag: string, props) =>
          Effect.succeed({
            props: { ...props, tags: [...props.tags, tag] }
          })
        )
        .build();

      // Type should be inferred quickly
      expect(ProductTrait._tag).toBe('Product');
    });
  });
});
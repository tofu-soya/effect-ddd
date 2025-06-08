// src/model/effect/decorators/domain-object.decorator.ts

import {
  AggGenericTrait,
  EntityGenericTrait,
  ValueObjectGenericTrait,
} from '@model/implementations';
import { ValidationException } from '@model/exception';
import { Effect, Schema } from 'effect';
import 'reflect-metadata';

// Metadata keys
const DOMAIN_OBJECT_TYPE = Symbol('domainObjectType');
const DOMAIN_OBJECT_TAG = Symbol('domainObjectTag');
const DOMAIN_OBJECT_SCHEMA = Symbol('domainObjectSchema');
const DOMAIN_OBJECT_COMMANDS = Symbol('domainObjectCommands');
const DOMAIN_OBJECT_QUERIES = Symbol('domainObjectQueries');
const DOMAIN_OBJECT_INVARIANTS = Symbol('domainObjectInvariants');

type DomainObjectType = 'ValueObject' | 'Entity' | 'AggregateRoot';

interface InvariantRule {
  predicate: Function;
  message: string;
  code: string;
}

/**
 * Decorator for Value Objects
 */
export function ValueObject(tag: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata(DOMAIN_OBJECT_TYPE, 'ValueObject', constructor);
    Reflect.defineMetadata(DOMAIN_OBJECT_TAG, tag, constructor);
    return constructor;
  };
}

/**
 * Decorator for Entities
 */
export function Entity(tag: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata(DOMAIN_OBJECT_TYPE, 'Entity', constructor);
    Reflect.defineMetadata(DOMAIN_OBJECT_TAG, tag, constructor);
    return constructor;
  };
}

/**
 * Decorator for Aggregate Roots
 */
export function AggregateRoot(tag: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata(DOMAIN_OBJECT_TYPE, 'AggregateRoot', constructor);
    Reflect.defineMetadata(DOMAIN_OBJECT_TAG, tag, constructor);
    return constructor;
  };
}

/**
 * Decorator for defining schema validation
 */
export function WithSchema(schema: Schema.Schema<any>) {
  return function (target: any) {
    Reflect.defineMetadata(DOMAIN_OBJECT_SCHEMA, schema, target);
  };
}

/**
 * Decorator for command methods
 */
export function Command(eventName?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const commands =
      Reflect.getMetadata(DOMAIN_OBJECT_COMMANDS, target.constructor) || {};
    commands[propertyName] = {
      handler: descriptor.value,
      eventName: eventName || `${propertyName}Executed`,
    };
    Reflect.defineMetadata(
      DOMAIN_OBJECT_COMMANDS,
      commands,
      target.constructor,
    );
  };
}

/**
 * Decorator for query methods
 */
export function Query() {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const queries =
      Reflect.getMetadata(DOMAIN_OBJECT_QUERIES, target.constructor) || {};
    queries[propertyName] = descriptor.value;
    Reflect.defineMetadata(DOMAIN_OBJECT_QUERIES, queries, target.constructor);
  };
}

/**
 * Decorator for invariant validation
 */
export function Invariant(message: string, code?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const invariants: InvariantRule[] =
      Reflect.getMetadata(DOMAIN_OBJECT_INVARIANTS, target.constructor) || [];
    invariants.push({
      predicate: descriptor.value,
      message,
      code: code || `${propertyName.toUpperCase()}_VIOLATION`,
    });
    Reflect.defineMetadata(
      DOMAIN_OBJECT_INVARIANTS,
      invariants,
      target.constructor,
    );
  };
}

/**
 * Factory to create domain object traits from decorated classes
 */
export class DomainObjectFactory {
  static createTrait<T>(decoratedClass: new () => T) {
    const type: DomainObjectType = Reflect.getMetadata(
      DOMAIN_OBJECT_TYPE,
      decoratedClass,
    );
    const tag: string = Reflect.getMetadata(DOMAIN_OBJECT_TAG, decoratedClass);
    const schema: Schema.Schema<any> = Reflect.getMetadata(
      DOMAIN_OBJECT_SCHEMA,
      decoratedClass,
    );
    const commands: Record<string, any> =
      Reflect.getMetadata(DOMAIN_OBJECT_COMMANDS, decoratedClass) || {};
    const queries: Record<string, any> =
      Reflect.getMetadata(DOMAIN_OBJECT_QUERIES, decoratedClass) || {};
    const invariants: InvariantRule[] =
      Reflect.getMetadata(DOMAIN_OBJECT_INVARIANTS, decoratedClass) || [];

    if (!type || !tag) {
      throw new Error(
        'Class must be decorated with @ValueObject, @Entity, or @AggregateRoot',
      );
    }

    const propsParser = (raw: unknown) => {
      return Effect.gen(function* () {
        // Schema validation
        const validated = schema
          ? yield* Schema.decodeUnknown(schema)(raw)
          : raw;

        // Invariant validation
        for (const invariant of invariants) {
          if (!invariant.predicate(validated)) {
            return yield* Effect.fail(
              ValidationException.new(invariant.code, invariant.message),
            );
          }
        }

        return validated;
      });
    };

    let baseTrait;

    switch (type) {
      case 'ValueObject':
        baseTrait = ValueObjectGenericTrait.createValueObjectTrait(
          propsParser,
          tag,
        );
        break;
      case 'Entity':
        baseTrait = EntityGenericTrait.createEntityTrait(propsParser, tag);
        break;
      case 'AggregateRoot':
        baseTrait = AggGenericTrait.createAggregateRootTrait(propsParser, tag);
        break;
      default:
        throw new Error(`Unsupported domain object type: ${type}`);
    }

    // Add commands and queries
    return {
      ...baseTrait,
      ...this.processCommands(commands, type === 'AggregateRoot'),
      ...queries,
    };
  }

  private static processCommands(
    commands: Record<string, any>,
    isAggregateRoot: boolean,
  ) {
    const processedCommands: Record<string, any> = {};

    for (const [name, commandConfig] of Object.entries(commands)) {
      if (isAggregateRoot) {
        processedCommands[name] = AggGenericTrait.asCommand(
          commandConfig.handler,
        );
      } else {
        processedCommands[name] = EntityGenericTrait.asCommand(
          commandConfig.handler,
        );
      }
    }

    return processedCommands;
  }
}

// Usage example:
/*
@ValueObject('Money')
@WithSchema(Schema.Struct({
  amount: PositiveNumber,
  currency: Schema.Enums(Currency),
}))
class MoneyDomain {
  @Invariant('Amount must be positive')
  isAmountPositive(props: { amount: number; currency: string }) {
    return props.amount > 0;
  }

  @Query()
  getFormattedAmount(props: { amount: number; currency: string }) {
    return `${props.amount} ${props.currency}`;
  }
}

const MoneyTrait = DomainObjectFactory.createTrait(MoneyDomain);
*/

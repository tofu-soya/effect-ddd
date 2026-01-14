import { Effect } from 'effect';
import { UnitOfWork } from './unit-of-work.service';
import { BaseException } from '@model/exception';

/**
 * Options for @Transactional and @TransactionalEffect decorators
 */
export interface TransactionalOptions {
  /**
   * Whether to automatically commit the transaction on successful execution.
   * If false, you must manually call unitOfWork.commit() in your handler.
   * Default: true
   */
  autoCommit?: boolean;

  /**
   * Property name where UnitOfWork is injected in the class.
   * Default: 'unitOfWork'
   */
  unitOfWorkProperty?: string;
}

/**
 * Method decorator that wraps usecase handler execution in a Unit of Work.
 *
 * Prerequisites:
 * - The class must have UnitOfWork injected (default property name: 'unitOfWork')
 * - CLS middleware must be configured in your NestJS application
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * class MyUseCaseHandler {
 *   constructor(private readonly unitOfWork: UnitOfWork) {}
 *
 *   @Transactional()
 *   async execute(command: MyCommand) {
 *     // Your business logic here
 *     // Repositories will automatically use the transactional EntityManager
 *
 *     // Optionally commit at a specific point (if autoCommit: false)
 *     // await this.unitOfWork.commit();
 *   }
 * }
 * ```
 *
 * @param options Configuration options
 */
export function Transactional(
  options: TransactionalOptions = {},
): MethodDecorator {
  const { autoCommit = true, unitOfWorkProperty = 'unitOfWork' } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get UnitOfWork instance from class instance
      const unitOfWork: UnitOfWork = (this as any)[unitOfWorkProperty];

      if (!unitOfWork) {
        throw new Error(
          `@Transactional decorator requires '${unitOfWorkProperty}' to be injected in ${target.constructor.name}. ` +
            `Please inject UnitOfWork in your class constructor.`,
        );
      }

      if (!(unitOfWork instanceof UnitOfWork)) {
        throw new Error(
          `Property '${unitOfWorkProperty}' in ${target.constructor.name} is not an instance of UnitOfWork`,
        );
      }

      // Begin unit of work
      await Effect.runPromise(unitOfWork.begin());

      try {
        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Auto-commit if enabled
        if (autoCommit) {
          await Effect.runPromise(unitOfWork.commit());
        }

        return result;
      } catch (error) {
        // Always rollback on error
        if (unitOfWork.isActive()) {
          await Effect.runPromise(unitOfWork.rollback());
        }
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Method decorator that wraps Effect-returning methods in a Unit of Work.
 *
 * This is the decorator version of withUnitOfWork() for methods that return Effect.
 *
 * Prerequisites:
 * - The class must have UnitOfWork injected (default property name: 'unitOfWork')
 * - CLS middleware must be configured in your NestJS application
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * class MyUseCaseHandler {
 *   constructor(private readonly unitOfWork: UnitOfWork) {}
 *
 *   @TransactionalEffect()
 *   execute(command: MyCommand): Effect.Effect<MyResult, BaseException> {
 *     return Effect.gen(function* () {
 *       // Your business logic here using Effect
 *       // Repositories will automatically use the transactional EntityManager
 *       const repo = yield* myRepository;
 *       yield* repo.save(data);
 *       return result;
 *     });
 *   }
 * }
 * ```
 *
 * @param options Configuration options
 */
export function TransactionalEffect(
  options: TransactionalOptions = {},
): MethodDecorator {
  const { autoCommit = true, unitOfWorkProperty = 'unitOfWork' } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (
      ...args: any[]
    ): Effect.Effect<any, BaseException> {
      // Get UnitOfWork instance from class instance
      const unitOfWork: UnitOfWork = (this as any)[unitOfWorkProperty];

      if (!unitOfWork) {
        throw new Error(
          `@TransactionalEffect decorator requires '${unitOfWorkProperty}' to be injected in ${target.constructor.name}. ` +
            `Please inject UnitOfWork in your class constructor.`,
        );
      }

      if (!(unitOfWork instanceof UnitOfWork)) {
        throw new Error(
          `Property '${unitOfWorkProperty}' in ${target.constructor.name} is not an instance of UnitOfWork`,
        );
      }

      // Call the original method to get the Effect
      const effect: Effect.Effect<any, BaseException> = originalMethod.apply(
        this,
        args,
      );

      // Wrap the Effect with unit of work logic
      return Effect.gen(function* () {
        // Begin unit of work
        yield* unitOfWork.begin();

        try {
          // Execute the effect
          const result = yield* effect;

          // Auto-commit if enabled
          if (autoCommit) {
            yield* unitOfWork.commit();
          }

          return result;
        } catch (error) {
          // Always rollback on error
          if (unitOfWork.isActive()) {
            yield* unitOfWork.rollback();
          }
          throw error;
        }
      });
    };

    return descriptor;
  };
}

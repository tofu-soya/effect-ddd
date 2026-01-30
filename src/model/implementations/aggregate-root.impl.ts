import { IDomainEvent } from '../interfaces/domain-event.interface';
import {
  AggregatePropsParser,
  AggregateRoot,
  AggregateRootTrait,
  AggregateValidator,
  BaseAggregateRootTrait,
  IAggGenericTrait,
} from '../interfaces/aggregate-root.interface';
import { CommandOnModel } from '../interfaces/entity.interface';
import { GetProps, IdentifierTrait } from 'src/typeclasses';
import { Effect, Option, pipe } from 'effect';
import { CoreException } from '../interfaces/validation.interface';
import { EntityGenericTrait } from './entity.impl';

/**
 * Implementation of the generic aggregate root trait
 */
export const AggGenericTrait: IAggGenericTrait = {
  // Inherit utility methods from EntityGenericTrait
  getTag: EntityGenericTrait.getTag,
  getId: EntityGenericTrait.getId,
  getCreatedAt: EntityGenericTrait.getCreatedAt,
  getUpdatedAt: EntityGenericTrait.getUpdatedAt,
  markUpdated: EntityGenericTrait.markUpdated,
  unpack: EntityGenericTrait.unpack,
  isEqual: EntityGenericTrait.isEqual,

  // Aggregate specific methods
  getDomainEvents: (aggregate) => aggregate.domainEvents,

  clearEvents: (aggregate) => ({
    ...aggregate,
    domainEvents: [],
  }),

  addDomainEvent: (event) => (aggregate) => ({
    ...aggregate,
    domainEvents: [...(aggregate.domainEvents || []), event],
  }),

  addDomainEvents: (events) => (aggregate) => ({
    ...aggregate,
    domainEvents: [...(aggregate.domainEvents || []), ...events],
  }),

  createAggregateRootTrait: <A extends AggregateRoot, N = unknown, P = unknown>(
    propsParser: AggregatePropsParser<A, P>,
    tag: string,
    options?: { autoGenId: boolean },
    validators: ReadonlyArray<AggregateValidator<A>> = [],
  ): BaseAggregateRootTrait<A, N, P> => {
    // Create base entity trait (without validators - we handle them in asCommand)
    const entityTrait = EntityGenericTrait.createEntityTrait<A, N, P>(
      propsParser,
      tag,
      options,
    );

    const parse = (i: any) =>
      pipe(
        i,
        entityTrait.parse,
        Effect.map(AggGenericTrait.addDomainEvents([])),
      );

    const newMethod = (i: N) =>
      pipe(i, entityTrait.new, Effect.map(AggGenericTrait.addDomainEvents([])));

    /**
     * Creates a command that:
     * 1. Always enforces validators baked into this trait (from withInvariant/withValidation)
     * 2. Allows additional validators per-command for customization
     */
    const asCommand = <I>(
      reducerLogic: (
        input: I,
        props: GetProps<A>,
        aggregate: A,
        correlationId: string,
      ) => Effect.Effect<
        { props: GetProps<A>; domainEvents: IDomainEvent[] },
        CoreException,
        never
      >,
      additionalValidators?: ReadonlyArray<AggregateValidator<A>>,
    ) => {
      // Merge baked-in validators with additional validators
      const allValidators = additionalValidators
        ? [...validators, ...additionalValidators]
        : validators;

      return (input: I): CommandOnModel<A> => {
        return (aggregate: A, correlationId?: string) => {
          const _correlationId = correlationId || IdentifierTrait.uuid();
          return pipe(
            reducerLogic(
              input,
              AggGenericTrait.unpack(aggregate),
              aggregate,
              _correlationId,
            ),
            Effect.flatMap(({ props, domainEvents }) => {
              // Run all validators on new props
              let validationEffect: Effect.Effect<
                GetProps<A>,
                CoreException,
                never
              > = Effect.succeed(props);
              if (allValidators.length > 0) {
                for (const validator of allValidators) {
                  validationEffect = pipe(
                    validationEffect,
                    Effect.flatMap(validator),
                  );
                }
              }

              return pipe(
                validationEffect,
                Effect.map((validatedProps) => {
                  // Apply all domain events to the aggregate
                  const withEvents = domainEvents.reduce<A>(
                    (agg, event) =>
                      AggGenericTrait.addDomainEvent<A>(event)(agg),
                    aggregate,
                  );

                  return {
                    ...withEvents,
                    props: validatedProps as A['props'],
                    updatedAt: Option.some(new Date()),
                  };
                }),
              );
            }),
          );
        };
      };
    };

    return {
      parse,
      new: newMethod,
      asCommand,
    };
  },
};

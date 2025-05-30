import { Effect, pipe } from 'effect';
import * as Option from 'effect/Option';
import {
  DomainModel,
  IGenericDomainModelTrait,
  DomainModelTrait,
  QueryOnModel,
} from '../interfaces/domain-model.interface';
import { GetProps } from 'src/typeclasses';
import { ParseResult } from '../interfaces/validation.interface';
import { PropsParser } from '../interfaces/domain-model.interface';
import { BaseException } from '../exception';

// Generic Domain Model Trait implementation
export const GenericDomainModelTrait: IGenericDomainModelTrait = {
  // Get the tag of a domain model
  getTag: <T extends DomainModel>(dV: T): string => dV._tag,

  // Extract the properties from a domain model
  unpack: <T extends DomainModel>(dV: T): GetProps<T> => dV.props,

  // Default props parser - can be overridden by specific traits
  parsingProps: <I = unknown, T extends DomainModel = DomainModel>(
    raw: I,
  ): ParseResult<T['props'], I> => {
    return Effect.succeed(raw as unknown as T['props']);
  },

  // Factory function to create a specific domain model trait
  createDomainModelTrait: <
    I extends { createdAt: Date } = { createdAt: Date },
    N = unknown,
    DM extends DomainModel = DomainModel,
  >(
    propsParsing: PropsParser<DM>,
    tag: string,
  ): DomainModelTrait<DM, N, I> => {
    return {
      // Parse an input into a domain model
      parse: (input: I) => {
        return pipe(
          propsParsing(input),
          Effect.map(
            (props) =>
              ({
                _tag: tag,
                props,
                createdAt: input.createdAt,
              }) as DM,
          ),
        );
      },

      // Create a new domain model from structured parameters
      new: (params: N) => {
        return pipe(
          Effect.succeed(params),
          Effect.flatMap((p) => propsParsing(p)),
          Effect.map(
            (props) =>
              ({
                _tag: tag,
                props,
                createdAt: new Date(),
              }) as DM,
          ),
        );
      },
    };
  },

  // Create a query function that extracts information from a domain model
  asQuery: <DM extends DomainModel, R>(
    queryLogic: (
      props: GetProps<DM>,
      dm: DM,
    ) => Effect.Effect<R, BaseException, never>,
  ): QueryOnModel<DM, R> => {
    return (dm: DM) => {
      return pipe(
        Effect.succeed(GenericDomainModelTrait.unpack(dm)),
        Effect.flatMap((props) => queryLogic(props as GetProps<DM>, dm)),
      );
    };
  },

  // Create a query function that returns Option instead of Effect
  asQueryOpt: <DM extends DomainModel, R>(
    queryLogic: (props: GetProps<DM>, dm: DM) => Option.Option<R>,
  ): ((dm: DM) => Option.Option<R>) => {
    return (dm: DM) => {
      return pipe(GenericDomainModelTrait.unpack(dm), (props) =>
        queryLogic(props as GetProps<DM>, dm),
      );
    };
  },
};

/**
 * Implementation of asQuery function
 *
 * This function allows creating queries that extract information from domain models
 * in a type-safe way.
 */
export const asQuery = <DM extends DomainModel, R>(
  queryLogic: (
    props: GetProps<DM>,
    dm: DM,
  ) => Effect.Effect<R, BaseException, never>,
): QueryOnModel<DM, R> => {
  return GenericDomainModelTrait.asQuery(queryLogic);
};

/**
 * Implementation of asQueryOpt function
 *
 * This function allows creating queries that extract information from domain models
 * and return Option instead of Effect.
 */

export const asQueryOpt = <DM extends DomainModel, R>(
  queryLogic: (props: GetProps<DM>, dm: DM) => Option.Option<R>,
): ((dm: DM) => Option.Option<R>) => {
  return GenericDomainModelTrait.asQueryOpt(queryLogic);
};

// Helper function to create a domain model trait with schema validation
// export const createDomainModelTraitWithSchema = <
//   I = unknown,
//   N = unknown,
//   P extends ReadonlyRecord<string, unknown> = ReadonlyRecord<string, unknown>,
//   DM extends DomainModel<P> = DomainModel<P>,
// >(
//   schema: Schema.Schema<P>,
//   tag: string,
// ): DomainModelTrait<DM, N, I> => {
//   const propsParser: PropsParser<DM, I> = (raw: I) => {
//     return pipe(
//       Effect.succeed(raw),
//       Effect.flatMap((data) => Schema.decodeUnknown(schema)(data)),
//       Effect.map((validProps) => validProps as DM['props']),
//     );
//   };

//   return GenericDomainModelTrait.createDomainModelTrait<I, N, DM>(
//     propsParser,
//     tag,
//   );
// };

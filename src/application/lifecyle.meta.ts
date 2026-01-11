import { Option, pipe } from 'effect';
import { ReadonlyRecord } from 'effect/Record';
import { v4 as uuidv4 } from 'uuid';

export type LifeCycleContext = Record<string, never>;

export type LifeCycleMeta = {
  createdTimestamp: number;
  /** ID for correlation purposes (for UnitOfWork, for commands that
   *  arrive from other microservices,logs correlation etc). */
  correlationId: string;
  context: ReadonlyRecord<string, never>;
};

export const LifeCycleMetaMod = {
  factory: (
    correlationId: Option.Option<string>,
    context: Option.Option<ReadonlyRecord<string, never>>,
  ): LifeCycleMeta => ({
    createdTimestamp: Date.now(),
    correlationId: pipe(
      correlationId,
      Option.getOrElse(() => uuidv4()),
    ),
    context: pipe(
      context,
      Option.getOrElse(() => ({})),
    ),
  }),
  autoFactory: () => LifeCycleMetaMod.factory(Option.none(), Option.none()),
  correlationId: (meta: LifeCycleMeta) => meta.correlationId,
};

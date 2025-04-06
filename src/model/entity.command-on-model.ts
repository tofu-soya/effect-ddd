import { Either, TE, pipe } from '@logic/fp';
import { Entity } from './entity.base.type';
import {
  BehaviorMonad,
  BehaviorMonadTrait,
} from './domain-model-behavior.monad';
import { DomainEvent } from './event';
import { BaseException } from '@logic/exception.base';
import { GetProps } from 'src/typeclasses';
import { GenericDomainModelTrait } from './domain-model.base';
import { EntityGenericTrait } from './entity.base';
import { IEventBus } from './event/event-bus';

export type CommandOnModelReturn<DM extends Entity> = Either.Either<
  BaseException,
  BehaviorMonad<DM>
>;

export type CommandOnModel<DM extends Entity> = (
  domainModel: DM,
) => CommandOnModelReturn<DM>;

export const fromException: <DM extends Entity>(
  err: BaseException,
) => CommandOnModelReturn<DM> = (err: BaseException) => Either.left(err);

const map: <DM extends Entity>(
  functor: (dm: DM) => Either.Either<BaseException, DM>,
) => (cmdReturn: CommandOnModelReturn<DM>) => CommandOnModelReturn<DM> =
  (functor) => (cmdReturn) =>
    pipe(
      cmdReturn,
      Either.chain((bhv) =>
        pipe(
          functor(bhv.state),
          Either.map((state) => BehaviorMonadTrait.of(state, [...bhv.events])),
        ),
      ),
    );

const chain: <DM extends Entity>(
  functor: CommandOnModel<DM>,
) => (cmdReturn: CommandOnModelReturn<DM>) => CommandOnModelReturn<DM> =
  (functor) => (cmdReturn) =>
    pipe(
      cmdReturn,
      Either.chain((firstBhv) =>
        pipe(
          functor(firstBhv.state),
          Either.map((bhv) =>
            BehaviorMonadTrait.of(bhv.state, [
              ...firstBhv.events,
              ...bhv.events,
            ]),
          ),
        ),
      ),
    );

const chainWithModelProps: <DM extends Entity>(
  functor: (props: GetProps<DM>, dm: DM) => CommandOnModelReturn<DM>,
) => (cmdReturn: CommandOnModelReturn<DM>) => CommandOnModelReturn<DM> =
  (functor) => (cmdReturn) =>
    pipe(
      cmdReturn,
      Either.chain((firstBhv) =>
        pipe(
          functor(
            GenericDomainModelTrait.unpack(firstBhv.state),
            firstBhv.state,
          ),
          Either.map((bhv) =>
            BehaviorMonadTrait.of(bhv.state, [
              ...firstBhv.events,
              ...bhv.events,
            ]),
          ),
        ),
      ),
    );

const mapWithModelProps =
  <DM extends Entity>(
    functor: (
      props: GetProps<DM>,
      dm: DM,
    ) => Either.Either<
      BaseException,
      { props: GetProps<DM>; events: DomainEvent[] }
    >,
  ) =>
  (cmdReturn: CommandOnModelReturn<DM>): CommandOnModelReturn<DM> =>
    pipe(
      cmdReturn,
      Either.chain((firstBhv) =>
        pipe(
          functor(
            GenericDomainModelTrait.unpack(firstBhv.state),
            firstBhv.state,
          ),
          Either.map((bhv) =>
            BehaviorMonadTrait.of(
              pipe(
                firstBhv.state,
                EntityGenericTrait.updateProps<DM>(bhv.props),
              ),
              [...firstBhv.events, ...bhv.events],
            ),
          ),
        ),
      ),
    );

const fold =
  <C, B, ET extends Entity>(
    onError: (error: BaseException) => C,
    onSuccess: (state: ET, events: DomainEvent[]) => B,
  ) =>
  (comReturn: CommandOnModelReturn<ET>) =>
    pipe(
      comReturn,
      Either.foldW(onError, (bh) => {
        return onSuccess(bh.state, bh.events);
      }),
    );

export const fromModel2Events: <DM extends Entity>(
  e: DM,
  events: DomainEvent[],
) => CommandOnModelReturn<DM> = <DM extends Entity>(
  entity: DM,
  events: DomainEvent[],
) => Either.right(BehaviorMonadTrait.of(entity, events));

export type WithEvents<T> = {
  result: T;
  events: DomainEvent[];
};

export const publishEventsAndGetResult = <T>(eventBus: IEventBus) => {
  return (
    taskEither: TE.TaskEither<BaseException, WithEvents<T>>,
  ): TE.TaskEither<BaseException, T> =>
    pipe(
      taskEither,
      TE.tap(({ events }) =>
        TE.tryCatch(
          async () => {
            events.forEach((event) => eventBus.publish(event));
          },
          (error) => error as BaseException,
        ),
      ),
      TE.map(({ result }) => result),
    );
};

export const CommandOnModelTrait = {
  fromException,
  fromModel2Events,
  chain,
  map,
  chainWithModelProps,
  mapWithModelProps,
  fold,
  execute: publishEventsAndGetResult,
};

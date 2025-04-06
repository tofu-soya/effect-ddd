import { IOEither } from '@logic/fp';
import { DomainEvent } from './event/domain-event.base';
import { pipe } from 'fp-ts/lib/function';
import { BaseException } from '@logic/exception.base';
import { Validation } from './invariant-validation';
import { Entity } from './entity.base.type';

export interface IEventDispatcher {
  dispatch(event: DomainEvent): IOEither.IOEither<BaseException, void>;
  multiDispatch(events: DomainEvent[]): IOEither.IOEither<BaseException, void>;
}

export type BehaviorMonad<S> = {
  events: DomainEvent[];
  state: S;
};

const map =
  <A extends Entity, B extends Entity = A>(f: (a: A) => B) =>
  (fa: BehaviorMonad<A>): BehaviorMonad<B> =>
    ({
      state: f(fa.state),
      events: fa.events,
    }) as BehaviorMonad<B>;

const of = <S>(state: S, itsEvent: DomainEvent[]) =>
  ({
    events: itsEvent,
    state,
  }) as BehaviorMonad<S>;

const getState = <S>(behavior: BehaviorMonad<S>) => behavior.state;

const getEvents = <S>(behavior: BehaviorMonad<S>) => behavior.events;

const chain =
  <A extends Entity, B extends Entity = A>(f: (a: A) => BehaviorMonad<B>) =>
  (ma: BehaviorMonad<A>) => {
    const result = f(ma.state);
    return {
      state: result.state,
      events: [...result.events, ...ma.events],
    } as BehaviorMonad<B>;
  };
const run =
  (eD: IEventDispatcher) =>
  <A extends Entity>(behavior: BehaviorMonad<A>, initEvents: DomainEvent[]) => {
    return pipe(
      eD.multiDispatch([...behavior.events, ...initEvents]),
      IOEither.as(behavior.state),
    );
  };

export type AggBehavior<A extends Entity, P, HasParser extends boolean> = (
  p: P,
) => (
  a: A,
) => HasParser extends true ? Validation<BehaviorMonad<A>> : BehaviorMonad<A>;

export const BehaviorMonadTrait = {
  map,
  of,
  chain,
  run,
  getState,
  getEvents,
};

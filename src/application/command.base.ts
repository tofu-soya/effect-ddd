import { Option, pipe } from 'effect';
import { LifeCycleMeta, LifeCycleMetaMod } from './lifecyle.meta';
import {
  GetProps,
  HasProps,
  getRawProps,
  queryOnProps,
} from 'src/typeclasses/has-props';

export type Command<T> = HasProps<T> & {
  readonly lifecycle: LifeCycleMeta;
};

const factory = <Cmd extends Command<unknown>>({
  lifecycle,
  props,
}: {
  lifecycle: Option.Option<LifeCycleMeta>;
  props: GetProps<Cmd>;
}) => {
  return pipe(
    lifecycle,
    Option.getOrElse(() =>
      LifeCycleMetaMod.factory(Option.none(), Option.none()),
    ),
    (lc) => ({
      lifecycle: lc,
      props,
    }),
  );
};

const correlationId = <T>(command: Command<T>) =>
  LifeCycleMetaMod.correlationId(command.lifecycle);

export const CommandTrait = {
  factory,
  queryProps: queryOnProps,
  getProps: getRawProps,
  correlationId,
};

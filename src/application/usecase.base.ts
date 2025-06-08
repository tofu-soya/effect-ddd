import { Query } from './query.base';
import { Command } from './command.base';
import { Effect } from 'effect';
import { BaseException } from '@model/exception';

export type CommandHandler<Cmd extends Command<unknown>, Res> = (
  command: Cmd,
) => Effect.Effect<Res, BaseException>;

export type QueryHandler<Q extends Query<unknown>, Res> = (
  query: Q,
) => Effect.Effect<Res, BaseException>;

export type UsecaseHandler =
  | CommandHandler<Command<unknown>, unknown>
  | QueryHandler<Query<unknown>, unknown>;

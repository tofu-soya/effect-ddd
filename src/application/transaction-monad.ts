import { TE, Either, Task, IOEither } from '@logic/fp';
import { BaseException } from '@model/exception';
import { pipe } from 'fp-ts/lib/function';

export interface IEntityManager {
  begin(): Task.Task<IOEither.IOEither<BaseException, void>>;
  commit(): Task.Task<IOEither.IOEither<BaseException, void>>;
  rollback(): Task.Task<IOEither.IOEither<BaseException, void>>;
}

export type Transaction<EM extends IEntityManager, RT> = {
  op: (em: EM) => Task.Task<IOEither.IOEither<BaseException, RT>>;
};

const ofPrim: <EM extends IEntityManager, A>(a: A) => Transaction<EM, A> = (
  a,
) => ({ op: () => Task.of(IOEither.right(a)) });

const of: <EM extends IEntityManager, A>(
  f: (em: EM) => Task.Task<IOEither.IOEither<BaseException, A>>,
) => Transaction<EM, A> = (f) => ({
  op: f,
});

const ofTask: <EM extends IEntityManager, A>(
  f: (em: EM) => TE.TaskEither<BaseException, A>,
) => Transaction<EM, A> = (f) => ({
  op: (em) =>
    pipe(
      f(em),
      TE.match(
        (e) => IOEither.left(e),
        (a) => IOEither.right(a),
      ),
    ),
});

const map: <A, B>(
  f: (a: A) => B,
) => <EM extends IEntityManager>(
  fa: Transaction<EM, A>,
) => Transaction<EM, B> = (f) => (fa) => ({
  op: (em) => pipe(fa.op(em), Task.map(IOEither.map(f))),
});

const chain: <A, B, EM extends IEntityManager>(
  f: (a: A) => Transaction<EM, B>,
) => (fa: Transaction<EM, A>) => Transaction<EM, B> = (f) => (fa) => ({
  op: (em) =>
    pipe(
      fa.op(em),
      Task.flatMap((aIOE) => {
        const a = aIOE();
        return pipe(
          a,
          Either.match(
            (error) => Task.of(IOEither.left(error)),
            (data) => run(f(data))(em),
          ),
        );
      }),
    ),
});
const run =
  <EM extends IEntityManager, B>(transaction: Transaction<EM, B>) =>
  (em: EM) => {
    const eitherIO = pipe(
      em.begin(),
      Task.chain((ioE) => {
        const task = IOEither.match(
          (e: BaseException) => Task.of(IOEither.left(e)),
          () => transaction.op(em),
        )(ioE)();
        return task;
      }),
      Task.tap(() => em.commit()),
      Task.flatMap((ioE) => {
        const task = pipe(
          ioE,
          IOEither.match(
            (err: BaseException) => {
              console.error('[Transaction Monad Err] ', err);
              return pipe(
                em.rollback(),
                Task.flatMap(() => Task.of(IOEither.left(err))),
              );
            },
            (data: B) => Task.of(IOEither.right(data)),
          ),
        )();
        return task;
      }),
    );
    return eitherIO;
  };

const unsafeRun =
  <EM extends IEntityManager, B>(em: EM) =>
  async (transaction: Transaction<EM, B>) => {
    const result = (await run(transaction)(em)())();
    return pipe(
      result,
      Either.match(
        (err) => Promise.reject(err),
        (data) => Promise.resolve(data),
      ),
    );
  };
export const TransactionMonad = {
  of,
  ofTask,
  ofPrim,
  map,
  chain,
  run,
  unsafeRun,
};

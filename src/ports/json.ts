import { BaseException, CommonExceptionTrait } from '@model/exception';
import { Effect } from 'effect';
import { UnknownRecord } from 'type-fest';

interface JsonUtil {
  parse: <T = UnknownRecord>(s: string) => Effect.Effect<T, BaseException>;
}

export const JsonUtil: JsonUtil = {
  parse: (s) =>
    Effect.try({
      try: () => JSON.parse(s),
      catch: (e) =>
        CommonExceptionTrait.construct(
          'JSON',
          'JSON_PARSE_FAILED',
          (e as Error).message,
        ),
    }),
};

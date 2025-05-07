import * as Schema from '@effect/schema/Schema';
import { BaseException, BaseExceptionTrait } from '@logic/exception.base';

const URLRegex =
  /^(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z]{2,}(\.[a-zA-Z]{2,})(\.[a-zA-Z]{2,})?\/[a-zA-Z0-9]{2,}|^((https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z]{2,}(\.[a-zA-Z]{2,})(\.[a-zA-Z]{2,})?)$|^(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z0-9]{2,}\.[a-zA-Z0-9]{2,}\.[a-zA-Z0-9]{2,}(\.[a-zA-Z0-9]{2,})?$/;

export const URL = Schema.string.pipe(
  Schema.filter((s): s is string => URLRegex.test(s), {
    message: () => BaseExceptionTrait.construct('url is malformed', 'URL_INCORRECT')
  }),
  Schema.brand('URL')
);

export type URL = Schema.Schema.Type<typeof URL>;

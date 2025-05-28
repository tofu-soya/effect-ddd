import { Schema } from 'effect';

export const NonEmptyString = Schema.String.pipe(
  Schema.filter((s) => s.length > 0, {
    message: () => 'Expected non-empty string',
  }),
  Schema.brand('NonEmptyString'),
);

export type NonEmptyString = Schema.Schema.Type<typeof NonEmptyString>;

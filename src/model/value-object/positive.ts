import { Schema } from 'effect';

export const PositiveNumber = Schema.Number.pipe(
  Schema.filter((s) => s > 0, {
    message: () => 'Expected positive number',
  }),
  Schema.brand('PositiveNumber'),
);

export type PositiveNumber = Schema.Schema.Type<typeof PositiveNumber>;

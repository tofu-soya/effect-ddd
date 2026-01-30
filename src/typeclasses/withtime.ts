import * as Option from 'fp-ts/Option';

export type WithTime = {
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
};

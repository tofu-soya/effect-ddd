import { Option } from '@logic/fp';

export type WithTime = {
  readonly createdAt: Option.Option<Date>;
  readonly updatedAt: Option.Option<Date>;
};

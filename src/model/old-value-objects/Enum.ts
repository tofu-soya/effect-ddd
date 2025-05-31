import { BaseException } from '@logic/exception.base';
import { Either } from '@logic/fp';

export const parseEnumItemFromString =
  <T extends { [key: string]: string }>(enumT: T, exception: BaseException) =>
  (raw: string) => {
    const isEnumItem = (r: string): r is T[keyof T] => {
      return enumValues.includes(r);
    };
    const enumValues = Object.values(enumT);

    if (isEnumItem(raw)) {
      return Either.right(raw);
    }
    return Either.left(exception);
  };

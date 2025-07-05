import { CommonExceptionTrait } from '@model/exception';
import R from 'ramda';

export class JsonMediaReader {
  private representation: Record<string, any>;

  constructor(aJson: string) {
    try {
      this.representation = JSON.parse(aJson);
    } catch (error) {
      throw CommonExceptionTrait.construct(
        'MEDIA_NOT_IN_JSON_FORMAT',
        'This media instance is not in json format',
        '',
      );
    }
  }

  getRepresentation() {
    return this.representation;
  }

  static read(aJson: string) {
    return new JsonMediaReader(aJson);
  }
  getValue(path: string) {
    if (!/(^(?:\/[a-zA-Z0-9_]+)+$)/g.test(path)) {
      CommonExceptionTrait.construct(
        'JSON_PATH_ILLGEGAL',
        `Json Path Reader is in illegal ${path}`,
        '',
      );
    }
    return R.path(path.split('/').slice(1), this.representation);
  }

  stringValue(path: string) {
    return this.getValue(path) ? String(this.getValue(path)) : null;
  }

  booleanValue(path: string) {
    const value = this.getValue(path);
    return value === 'true' || value === true;
  }

  dateValue(path: string) {
    return this.getValue(path) ? Date.parse(String(this.getValue(path))) : null;
  }

  numberValue(path: string) {
    return this.getValue(path) ? Number(this.getValue(path)) : null;
  }
}

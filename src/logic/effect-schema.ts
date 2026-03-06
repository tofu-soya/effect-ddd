import { ParseResult, Schema } from 'effect';

export function EnumString<E extends Record<string, string>>(enumObj: E) {
  // 1) get the enum values
  const values = Object.values(enumObj) as readonly string[];

  // 2) create a literal union of allowed strings
  const Enums = Schema.Enums(enumObj);

  // 3) transformOrFail from raw string to enum
  return Schema.transformOrFail(Schema.String, Schema.Enums(enumObj), {
    decode: (raw) => {
      const match = values.find((v) => v === raw);
      return match
        ? ParseResult.succeed(match as E[keyof E])
        : ParseResult.fail(
            new ParseResult.Type(
              Enums.ast,
              raw,
              `Expected one of: ${values.join(', ')}`,
            ),
          );
    },
    encode: (value) => ParseResult.succeed(value as string),
  });
}

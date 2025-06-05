import { Effect, ParseResult, Schema } from 'effect';

export const DateSchema = Schema.transformOrFail(
  Schema.Union(Schema.String, Schema.instanceOf(Date)),
  Schema.instanceOf(Date),
  {
    decode: (input) => {
      try {
        const date = typeof input === 'string' ? new Date(input) : input;
        return isNaN(date.getTime())
          ? ParseResult.fail(
              new ParseResult.Type(
                Schema.Literal('Date').ast,
                input,
                'Invalid date format',
              ),
            )
          : ParseResult.succeed(date);
      } catch {
        return ParseResult.fail(
          new ParseResult.Type(
            Schema.Literal('Date').ast,
            input,
            'Invalid date format',
          ),
        );
      }
    },
    encode: (date) => ParseResult.succeed(date),
  },
);

export type DateVO = Schema.Schema.Type<typeof DateSchema>;

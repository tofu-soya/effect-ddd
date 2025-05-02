import { Schema } from "effect"

export const NonEmptyStringSchema = Schema.String.pipe(
  Schema.nonEmpty({ message: () => "Expected non-empty string" })
)

export type NonEmptyString = Schema.Schema.Type<typeof NonEmptyStringSchema>
)

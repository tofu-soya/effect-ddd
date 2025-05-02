import { Brand, Schema } from "effect"

export type NonEmptyString = Brand.Branded<string, "NonEmptyString">

export const NonEmptyString = Brand.refined<NonEmptyString>(
  (s: string) => s.trim().length > 0,
  (s) => Brand.error(`Expected non-empty string, got "${s}"`)
)

export const NonEmptyStringSchema = Schema.String.pipe(
  Schema.fromBrand(NonEmptyString)
)

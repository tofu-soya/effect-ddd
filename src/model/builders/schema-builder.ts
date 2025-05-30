// src/model/effect/builders/schema-builder.ts

import { Schema, Effect, pipe } from 'effect';
import { ValidationException } from '../exception';

// ===== TYPES =====

export interface StringSchemaState {
  readonly schema: Schema.Schema<string>;
}

export interface NumberSchemaState {
  readonly schema: Schema.Schema<number>;
}

export interface ObjectSchemaState<
  T extends Record<string, Schema.Schema<any>>,
> {
  readonly fields: T;
  readonly validators: Array<
    (obj: any) => Effect.Effect<any, ValidationException, never>
  >;
}

export interface ArraySchemaState<T> {
  readonly schema: Schema.Schema<T[]>;
}

// ===== STRING SCHEMA BUILDERS =====

/**
 * Initialize string schema state
 */
export const initStringSchema = (): StringSchemaState => ({
  schema: Schema.String,
});

/**
 * Add minimum length validation
 */
export const withMinLength =
  (min: number, message?: string) =>
  (state: StringSchemaState): StringSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.minLength(min, {
        message: () =>
          message || `String must be at least ${min} characters long`,
      }),
    ),
  });

/**
 * Add maximum length validation
 */
export const withMaxLength =
  (max: number, message?: string) =>
  (state: StringSchemaState): StringSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.maxLength(max, {
        message: () =>
          message || `String must be at most ${max} characters long`,
      }),
    ),
  });

/**
 * Add pattern validation
 */
export const withPattern =
  (regex: RegExp, message?: string) =>
  (state: StringSchemaState): StringSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.pattern(regex, {
        message: () => message || 'String does not match required pattern',
      }),
    ),
  });

/**
 * Ensure string is not empty
 */
export const withNonEmpty = (message?: string) =>
  withMinLength(1, message || 'String cannot be empty');

/**
 * Add email validation
 */
export const withEmail = (message?: string) =>
  withPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message || 'Invalid email format');

/**
 * Add URL validation
 */
export const withUrl = (message?: string) =>
  withPattern(
    /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$/,
    message || 'Invalid URL format',
  );

/**
 * Add phone number validation
 */
export const withPhoneNumber = (message?: string) =>
  withPattern(/^\+?[\d\s\-\(\)]+$/, message || 'Invalid phone number format');

/**
 * Add custom string validation
 */
export const withStringCustom =
  (predicate: (value: string) => boolean, message: string) =>
  (state: StringSchemaState): StringSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter(predicate, {
        message: () => message,
      }),
    ),
  });

/**
 * Brand the string with a specific type
 */
export const withStringBrand =
  <B extends string>(brand: B) =>
  (state: StringSchemaState) =>
    state.schema.pipe(Schema.brand(brand));

/**
 * Build the final string schema
 */
export const buildStringSchema = (state: StringSchemaState) => state.schema;

// ===== NUMBER SCHEMA BUILDERS =====

/**
 * Initialize number schema state
 */
export const initNumberSchema = (): NumberSchemaState => ({
  schema: Schema.Number,
});

/**
 * Add minimum value validation
 */
export const withMin =
  (min: number, message?: string) =>
  (state: NumberSchemaState): NumberSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter((n) => n >= min, {
        message: () => message || `Number must be at least ${min}`,
      }),
    ),
  });

/**
 * Add maximum value validation
 */
export const withMax =
  (max: number, message?: string) =>
  (state: NumberSchemaState): NumberSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter((n) => n <= max, {
        message: () => message || `Number must be at most ${max}`,
      }),
    ),
  });

/**
 * Ensure number is positive
 */
export const withPositive = (message?: string) =>
  withMin(0.001, message || 'Number must be positive');

/**
 * Ensure number is non-negative
 */
export const withNonNegative = (message?: string) =>
  withMin(0, message || 'Number must be non-negative');

/**
 * Ensure number is an integer
 */
export const withInteger =
  (message?: string) =>
  (state: NumberSchemaState): NumberSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter((n) => Number.isInteger(n), {
        message: () => message || 'Number must be an integer',
      }),
    ),
  });

/**
 * Add custom number validation
 */
export const withNumberCustom =
  (predicate: (value: number) => boolean, message: string) =>
  (state: NumberSchemaState): NumberSchemaState => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter(predicate, {
        message: () => message,
      }),
    ),
  });

/**
 * Brand the number with a specific type
 */
export const withNumberBrand =
  <B extends string>(brand: B) =>
  (state: NumberSchemaState) =>
    state.schema.pipe(Schema.brand(brand));

/**
 * Build the final number schema
 */
export const buildNumberSchema = (state: NumberSchemaState) => state.schema;

// ===== OBJECT SCHEMA BUILDERS =====

/**
 * Initialize object schema state
 */
export const initObjectSchema = <T extends Record<string, Schema.Schema<any>>>(
  fields: T,
): ObjectSchemaState<T> => ({
  fields,
  validators: [],
});

/**
 * Add cross-field validation
 */
export const withCrossFieldValidation =
  <T extends Record<string, Schema.Schema<any>>>(
    predicate: (obj: Schema.Schema.Type<Schema.Struct<T>>) => boolean,
    message: string,
    code?: string,
  ) =>
  (state: ObjectSchemaState<T>): ObjectSchemaState<T> => ({
    ...state,
    validators: [
      ...state.validators,
      (obj) => {
        if (!predicate(obj)) {
          return Effect.fail(
            ValidationException.new(
              code || 'CROSS_FIELD_VALIDATION_FAILED',
              message,
            ),
          );
        }
        return Effect.succeed(obj);
      },
    ],
  });

/**
 * Add conditional field validation
 */
export const withConditionalValidation =
  <T extends Record<string, Schema.Schema<any>>>(
    condition: (obj: any) => boolean,
    thenValidation: (
      obj: any,
    ) => Effect.Effect<any, ValidationException, never>,
  ) =>
  (state: ObjectSchemaState<T>): ObjectSchemaState<T> => ({
    ...state,
    validators: [
      ...state.validators,
      (obj) => {
        if (condition(obj)) {
          return thenValidation(obj);
        }
        return Effect.succeed(obj);
      },
    ],
  });

/**
 * Build the final object schema with custom validations
 */
export const buildObjectSchema = <T extends Record<string, Schema.Schema<any>>>(
  state: ObjectSchemaState<T>,
) => {
  const baseSchema = Schema.Struct(state.fields);

  if (state.validators.length === 0) {
    return baseSchema;
  }

  return baseSchema.pipe(
    Schema.transformOrFail(baseSchema, {
      decode: (obj) =>
        Effect.gen(function* () {
          let result = obj;
          for (const validator of state.validators) {
            result = yield* validator(result);
          }
          return result;
        }),
      encode: Effect.succeed,
    }),
  );
};

// ===== ARRAY SCHEMA BUILDERS =====

/**
 * Initialize array schema state
 */
export const initArraySchema = <T>(
  itemSchema: Schema.Schema<T>,
): ArraySchemaState<T> => ({
  schema: Schema.Array(itemSchema),
});

/**
 * Add minimum items validation
 */
export const withMinItems =
  <T>(min: number, message?: string) =>
  (state: ArraySchemaState<T>): ArraySchemaState<T> => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter((arr) => arr.length >= min, {
        message: () => message || `Array must have at least ${min} items`,
      }),
    ),
  });

/**
 * Add maximum items validation
 */
export const withMaxItems =
  <T>(max: number, message?: string) =>
  (state: ArraySchemaState<T>): ArraySchemaState<T> => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter((arr) => arr.length <= max, {
        message: () => message || `Array must have at most ${max} items`,
      }),
    ),
  });

/**
 * Ensure array is not empty
 */
export const withNonEmptyArray = <T>(message?: string) =>
  withMinItems<T>(1, message || 'Array cannot be empty');

/**
 * Ensure all items are unique
 */
export const withUniqueItems =
  <T>(message?: string, keySelector?: (item: T) => any) =>
  (state: ArraySchemaState<T>): ArraySchemaState<T> => ({
    ...state,
    schema: state.schema.pipe(
      Schema.filter(
        (arr) => {
          const keys = keySelector ? arr.map(keySelector) : arr;
          return new Set(keys).size === keys.length;
        },
        {
          message: () => message || 'Array items must be unique',
        },
      ),
    ),
  });

/**
 * Build the final array schema
 */
export const buildArraySchema = <T>(state: ArraySchemaState<T>) => state.schema;

// ===== HIGH-LEVEL BUILDERS =====

/**
 * String schema builder pipeline starter
 */
export const stringSchema = () => initStringSchema();

/**
 * Number schema builder pipeline starter
 */
export const numberSchema = () => initNumberSchema();

/**
 * Object schema builder pipeline starter
 */
export const objectSchema = <T extends Record<string, Schema.Schema<any>>>(
  fields: T,
) => initObjectSchema(fields);

/**
 * Array schema builder pipeline starter
 */
export const arraySchema = <T>(itemSchema: Schema.Schema<T>) =>
  initArraySchema(itemSchema);

/**
 * Create an optional schema
 */
export const optionalSchema = <T>(schema: Schema.Schema<T>) =>
  Schema.optionalWith(schema, { as: 'Option' });

/**
 * Create a union schema
 */
export const unionSchema = <
  T extends readonly [Schema.Schema<any>, ...Schema.Schema<any>[]],
>(
  ...schemas: T
) => Schema.Union(...schemas);

/**
 * Create an enum schema
 */
export const enumSchema = <T extends Record<string, string | number>>(
  enumObject: T,
) => Schema.Enums(enumObject);

// ===== UTILITY FUNCTIONS =====

/**
 * Create a date schema with future validation
 */
export const createFutureDateSchema = (message?: string) =>
  Schema.Date.pipe(
    Schema.filter((date) => date > new Date(), {
      message: () => message || 'Date must be in the future',
    }),
  );

/**
 * Create a date schema with past validation
 */
export const createPastDateSchema = (message?: string) =>
  Schema.Date.pipe(
    Schema.filter((date) => date < new Date(), {
      message: () => message || 'Date must be in the past',
    }),
  );

/**
 * Create timestamp fields schema
 */
export const createTimestampFields = () =>
  Schema.Struct({
    createdAt: Schema.Date,
    updatedAt: Schema.optionalWith(Schema.Date, { as: 'Option' }),
  });

/**
 * Create audit fields schema
 */
export const createAuditFields = () =>
  Schema.Struct({
    createdAt: Schema.Date,
    updatedAt: Schema.optionalWith(Schema.Date, { as: 'Option' }),
    createdBy: Schema.optionalWith(Schema.UUID, { as: 'Option' }),
    updatedBy: Schema.optionalWith(Schema.UUID, { as: 'Option' }),
  });

// ===== COMMON SCHEMAS =====

/**
 * Pre-built common schemas using functional composition
 */
export const CommonSchemas = {
  // Identity schemas
  UUID: Schema.UUID,

  Email: pipe(stringSchema(), withEmail(), buildStringSchema),

  PhoneNumber: pipe(stringSchema(), withPhoneNumber(), buildStringSchema),

  URL: pipe(stringSchema(), withUrl(), buildStringSchema),

  // String schemas
  NonEmptyString: pipe(stringSchema(), withNonEmpty(), buildStringSchema),

  ShortText: pipe(stringSchema(), withMaxLength(255), buildStringSchema),

  LongText: pipe(stringSchema(), withMaxLength(5000), buildStringSchema),

  // Number schemas
  PositiveNumber: pipe(numberSchema(), withPositive(), buildNumberSchema),

  NonNegativeNumber: pipe(numberSchema(), withNonNegative(), buildNumberSchema),

  PositiveInteger: pipe(
    numberSchema(),
    withPositive(),
    withInteger(),
    buildNumberSchema,
  ),

  Age: pipe(
    numberSchema(),
    withMin(0),
    withMax(150),
    withInteger(),
    buildNumberSchema,
  ),

  // Date schemas
  FutureDate: createFutureDateSchema(),
  PastDate: createPastDateSchema(),

  // Common object patterns
  TimestampFields: createTimestampFields(),
  AuditFields: createAuditFields(),
} as const;

// ===== TRAIT INTERFACE =====

/**
 * Schema builder trait for consistent API
 */
export const SchemaBuilderTrait = {
  // Starters
  string: stringSchema,
  number: numberSchema,
  object: objectSchema,
  array: arraySchema,
  optional: optionalSchema,
  union: unionSchema,
  enum: enumSchema,

  // String builders
  withMinLength,
  withMaxLength,
  withPattern,
  withNonEmpty,
  withEmail,
  withUrl,
  withPhoneNumber,
  withStringCustom,
  withStringBrand,
  buildStringSchema,

  // Number builders
  withMin,
  withMax,
  withPositive,
  withNonNegative,
  withInteger,
  withNumberCustom,
  withNumberBrand,
  buildNumberSchema,

  // Object builders
  withCrossFieldValidation,
  withConditionalValidation,
  buildObjectSchema,

  // Array builders
  withMinItems,
  withMaxItems,
  withNonEmptyArray,
  withUniqueItems,
  buildArraySchema,

  // Utilities
  createFutureDateSchema,
  createPastDateSchema,
  createTimestampFields,
  createAuditFields,

  // Common schemas
  CommonSchemas,
} as const;

// ===== USAGE EXAMPLES =====

/*
// 1. Simple string schema with pipe composition
const UsernameSchema = pipe(
  stringSchema(),
  withNonEmpty(),
  withMinLength(3),
  withMaxLength(20),
  withPattern(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  withStringBrand('Username')
);

// 2. Complex object schema with cross-field validation
const PersonSchema = pipe(
  objectSchema({
    firstName: CommonSchemas.NonEmptyString,
    lastName: CommonSchemas.NonEmptyString,
    email: CommonSchemas.Email,
    age: CommonSchemas.Age,
    startDate: Schema.Date,
    endDate: Schema.optionalWith(Schema.Date, { as: 'Option' }),
  }),
  withCrossFieldValidation(
    (person) => !person.endDate || person.endDate > person.startDate,
    'End date must be after start date'
  ),
  buildObjectSchema
);

// 3. Array schema with constraints
const TagsSchema = pipe(
  arraySchema(CommonSchemas.NonEmptyString),
  withMinItems(1),
  withMaxItems(10),
  withUniqueItems('Tags must be unique'),
  buildArraySchema
);

// 4. Using the trait interface
const EmailSchema = SchemaBuilderTrait.string()
  |> SchemaBuilderTrait.withEmail()
  |> SchemaBuilderTrait.buildStringSchema;

// 5. Complex number schema
const ScoreSchema = pipe(
  numberSchema(),
  withMin(0, 'Score cannot be negative'),
  withMax(100, 'Score cannot exceed 100'),
  withInteger('Score must be a whole number'),
  withNumberBrand('Score')
);

// 6. Conditional validation example
const AccountSchema = pipe(
  objectSchema({
    type: enumSchema({ PERSONAL: 'personal', BUSINESS: 'business' }),
    email: CommonSchemas.Email,
    companyName: optionalSchema(CommonSchemas.NonEmptyString),
    taxId: optionalSchema(CommonSchemas.NonEmptyString),
  }),
  withConditionalValidation(
    (account) => account.type === 'business',
    (account) => {
      if (!account.companyName || !account.taxId) {
        return Effect.fail(
          ValidationException.new(
            'BUSINESS_FIELDS_REQUIRED',
            'Business accounts must have company name and tax ID'
          )
        );
      }
      return Effect.succeed(account);
    }
  ),
  buildObjectSchema
);

// 7. Functional composition with utility functions
const createPersonWithAge = (minAge: number, maxAge: number) =>
  pipe(
    objectSchema({
      name: CommonSchemas.NonEmptyString,
      age: pipe(
        numberSchema(),
        withMin(minAge),
        withMax(maxAge),
        withInteger(),
        buildNumberSchema
      ),
      email: CommonSchemas.Email,
    }),
    buildObjectSchema
  );

const AdultSchema = createPersonWithAge(18, 120);
const ChildSchema = createPersonWithAge(0, 17);
*/

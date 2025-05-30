# Schema Builder

## Overview

The Schema Builder provides a functional approach to creating and composing Effect Schema validations. It offers a fluent, type-safe API for building complex validation schemas with cross-field validation, conditional logic, and custom constraints while maintaining full compatibility with Effect's validation system.

## Key Features

- **Functional Composition**: Pure functions with pipe-friendly API
- **Immutable State**: No side effects, predictable transformations
- **Type Safety**: Full TypeScript support with generic constraints
- **Effect Integration**: Native Effect error handling and validation
- **Cross-Field Validation**: Complex object validation logic
- **Conditional Validation**: Dynamic validation based on field values
- **Common Patterns**: Pre-built schemas for frequent use cases
- **Extensible**: Easy to add custom validation logic

## Core Types

### State Interfaces

```typescript
interface StringSchemaState {
  readonly schema: Schema.Schema<string>;
}

interface NumberSchemaState {
  readonly schema: Schema.Schema<number>;
}

interface ObjectSchemaState<T extends Record<string, Schema.Schema<any>>> {
  readonly fields: T;
  readonly validators: readonly Array<
    (obj: any) => Effect.Effect<any, ValidationException, never>
  >;
}

interface ArraySchemaState<T> {
  readonly schema: Schema.Schema<T[]>;
}
```

## API Reference

### String Schema Functions

#### Pipeline Starters

##### `stringSchema()`

Initializes a new string schema pipeline.

**Returns:** `StringSchemaState`

**Example:**

```typescript
const basicStringSchema = pipe(stringSchema(), buildStringSchema);
```

#### Validation Builders

##### `withMinLength(min: number, message?: string)`

Adds minimum length validation to a string schema.

**Parameters:**

- `min`: Minimum required length
- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

**Example:**

```typescript
const MinLengthSchema = pipe(
  stringSchema(),
  withMinLength(3, 'Must be at least 3 characters'),
  buildStringSchema,
);
```

##### `withMaxLength(max: number, message?: string)`

Adds maximum length validation to a string schema.

**Parameters:**

- `max`: Maximum allowed length
- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

##### `withPattern(regex: RegExp, message?: string)`

Adds regex pattern validation to a string schema.

**Parameters:**

- `regex`: Regular expression pattern
- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

**Example:**

```typescript
const AlphanumericSchema = pipe(
  stringSchema(),
  withPattern(/^[a-zA-Z0-9]+$/, 'Only letters and numbers allowed'),
  buildStringSchema,
);
```

##### `withNonEmpty(message?: string)`

Ensures the string is not empty (minimum length of 1).

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

##### `withEmail(message?: string)`

Adds email format validation.

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

##### `withUrl(message?: string)`

Adds URL format validation.

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

##### `withPhoneNumber(message?: string)`

Adds phone number format validation.

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: StringSchemaState) => StringSchemaState`

##### `withStringCustom(predicate: (value: string) => boolean, message: string)`

Adds custom validation logic to a string schema.

**Parameters:**

- `predicate`: Function that returns true if value is valid
- `message`: Error message for validation failure

**Returns:** `(state: StringSchemaState) => StringSchemaState`

**Example:**

```typescript
const NoSpacesSchema = pipe(
  stringSchema(),
  withStringCustom((value) => !value.includes(' '), 'Spaces are not allowed'),
  buildStringSchema,
);
```

##### `withStringBrand<B extends string>(brand: B)`

Adds a brand to the string type for type safety.

**Parameters:**

- `brand`: Brand identifier string

**Returns:** `(state: StringSchemaState) => Schema.BrandSchema<string, B>`

**Example:**

```typescript
const UsernameSchema = pipe(
  stringSchema(),
  withNonEmpty(),
  withStringBrand('Username'),
);

type Username = Schema.Schema.Type<typeof UsernameSchema>;
```

#### Pipeline Finalizer

##### `buildStringSchema(state: StringSchemaState)`

Finalizes and returns the constructed string schema.

**Parameters:**

- `state`: Current string schema state

**Returns:** `Schema.Schema<string>`

### Number Schema Functions

#### Pipeline Starters

##### `numberSchema()`

Initializes a new number schema pipeline.

**Returns:** `NumberSchemaState`

#### Validation Builders

##### `withMin(min: number, message?: string)`

Adds minimum value validation to a number schema.

**Parameters:**

- `min`: Minimum allowed value
- `message`: Optional custom error message

**Returns:** `(state: NumberSchemaState) => NumberSchemaState`

##### `withMax(max: number, message?: string)`

Adds maximum value validation to a number schema.

**Parameters:**

- `max`: Maximum allowed value
- `message`: Optional custom error message

**Returns:** `(state: NumberSchemaState) => NumberSchemaState`

##### `withPositive(message?: string)`

Ensures the number is positive (greater than 0).

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: NumberSchemaState) => NumberSchemaState`

##### `withNonNegative(message?: string)`

Ensures the number is non-negative (greater than or equal to 0).

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: NumberSchemaState) => NumberSchemaState`

##### `withInteger(message?: string)`

Ensures the number is an integer.

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: NumberSchemaState) => NumberSchemaState`

##### `withNumberCustom(predicate: (value: number) => boolean, message: string)`

Adds custom validation logic to a number schema.

**Parameters:**

- `predicate`: Function that returns true if value is valid
- `message`: Error message for validation failure

**Returns:** `(state: NumberSchemaState) => NumberSchemaState`

**Example:**

```typescript
const EvenNumberSchema = pipe(
  numberSchema(),
  withNumberCustom((value) => value % 2 === 0, 'Number must be even'),
  buildNumberSchema,
);
```

##### `withNumberBrand<B extends string>(brand: B)`

Adds a brand to the number type for type safety.

**Parameters:**

- `brand`: Brand identifier string

**Returns:** `(state: NumberSchemaState) => Schema.BrandSchema<number, B>`

#### Pipeline Finalizer

##### `buildNumberSchema(state: NumberSchemaState)`

Finalizes and returns the constructed number schema.

**Parameters:**

- `state`: Current number schema state

**Returns:** `Schema.Schema<number>`

### Object Schema Functions

#### Pipeline Starters

##### `objectSchema<T extends Record<string, Schema.Schema<any>>>(fields: T)`

Initializes a new object schema pipeline with field definitions.

**Parameters:**

- `fields`: Object defining the schema fields

**Returns:** `ObjectSchemaState<T>`

**Example:**

```typescript
const PersonObjectSchema = pipe(
  objectSchema({
    name: CommonSchemas.NonEmptyString,
    age: CommonSchemas.Age,
    email: CommonSchemas.Email,
  }),
  buildObjectSchema,
);
```

#### Validation Builders

##### `withCrossFieldValidation<T>(predicate: (obj: Schema.Schema.Type<Schema.Struct<T>>) => boolean, message: string, code?: string)`

Adds validation that involves multiple fields of the object.

**Parameters:**

- `predicate`: Function that validates the entire object
- `message`: Error message for validation failure
- `code`: Optional error code

**Returns:** `(state: ObjectSchemaState<T>) => ObjectSchemaState<T>`

**Example:**

```typescript
const DateRangeSchema = pipe(
  objectSchema({
    startDate: Schema.Date,
    endDate: Schema.Date,
  }),
  withCrossFieldValidation(
    (obj) => obj.endDate > obj.startDate,
    'End date must be after start date',
    'INVALID_DATE_RANGE',
  ),
  buildObjectSchema,
);
```

##### `withConditionalValidation<T>(condition: (obj: any) => boolean, thenValidation: (obj: any) => Effect.Effect<any, ValidationException, never>)`

Adds validation that is applied conditionally based on object state.

**Parameters:**

- `condition`: Function that determines if validation should be applied
- `thenValidation`: Validation logic to apply when condition is true

**Returns:** `(state: ObjectSchemaState<T>) => ObjectSchemaState<T>`

**Example:**

```typescript
const AccountSchema = pipe(
  objectSchema({
    type: enumSchema({ PERSONAL: 'personal', BUSINESS: 'business' }),
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
            'Business accounts must have company name and tax ID',
          ),
        );
      }
      return Effect.succeed(account);
    },
  ),
  buildObjectSchema,
);
```

#### Pipeline Finalizer

##### `buildObjectSchema<T>(state: ObjectSchemaState<T>)`

Finalizes and returns the constructed object schema with all validations.

**Parameters:**

- `state`: Current object schema state

**Returns:** `Schema.Schema<Schema.Schema.Type<Schema.Struct<T>>>`

### Array Schema Functions

#### Pipeline Starters

##### `arraySchema<T>(itemSchema: Schema.Schema<T>)`

Initializes a new array schema pipeline with item type definition.

**Parameters:**

- `itemSchema`: Schema for individual array items

**Returns:** `ArraySchemaState<T>`

#### Validation Builders

##### `withMinItems<T>(min: number, message?: string)`

Adds minimum array length validation.

**Parameters:**

- `min`: Minimum required number of items
- `message`: Optional custom error message

**Returns:** `(state: ArraySchemaState<T>) => ArraySchemaState<T>`

##### `withMaxItems<T>(max: number, message?: string)`

Adds maximum array length validation.

**Parameters:**

- `max`: Maximum allowed number of items
- `message`: Optional custom error message

**Returns:** `(state: ArraySchemaState<T>) => ArraySchemaState<T>`

##### `withNonEmptyArray<T>(message?: string)`

Ensures the array is not empty (minimum length of 1).

**Parameters:**

- `message`: Optional custom error message

**Returns:** `(state: ArraySchemaState<T>) => ArraySchemaState<T>`

##### `withUniqueItems<T>(message?: string, keySelector?: (item: T) => any)`

Ensures all array items are unique.

**Parameters:**

- `message`: Optional custom error message
- `keySelector`: Optional function to extract comparison key from items

**Returns:** `(state: ArraySchemaState<T>) => ArraySchemaState<T>`

**Example:**

```typescript
const UniqueEmailsSchema = pipe(
  arraySchema(CommonSchemas.Email),
  withUniqueItems('Email addresses must be unique'),
  buildArraySchema,
);

// With key selector for object uniqueness
const UniqueUsersSchema = pipe(
  arraySchema(UserSchema),
  withUniqueItems('Users must have unique IDs', (user) => user.id),
  buildArraySchema,
);
```

#### Pipeline Finalizer

##### `buildArraySchema<T>(state: ArraySchemaState<T>)`

Finalizes and returns the constructed array schema.

**Parameters:**

- `state`: Current array schema state

**Returns:** `Schema.Schema<T[]>`

### Utility Schema Functions

##### `optionalSchema<T>(schema: Schema.Schema<T>)`

Wraps a schema to make it optional (returns Option<T>).

**Parameters:**

- `schema`: Schema to make optional

**Returns:** `Schema.Schema<Option.Option<T>>`

**Example:**

```typescript
const OptionalEmailSchema = optionalSchema(CommonSchemas.Email);
```

##### `unionSchema<T>(...schemas: T)`

Creates a union schema from multiple schemas.

**Parameters:**

- `schemas`: Array of schemas to union

**Returns:** `Schema.Union<T>`

**Example:**

```typescript
const StringOrNumberSchema = unionSchema(Schema.String, Schema.Number);
```

##### `enumSchema<T>(enumObject: T)`

Creates a schema from an enum object.

**Parameters:**

- `enumObject`: TypeScript enum or object with string/number values

**Returns:** `Schema.Enums<T>`

**Example:**

```typescript
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

const UserRoleSchema = enumSchema(UserRole);
```

## Usage Patterns

### 1. Simple String Validation

For basic string validation with multiple constraints:

```typescript
import { pipe } from 'effect';
import {
  stringSchema,
  withNonEmpty,
  withMinLength,
  withMaxLength,
  withPattern,
  withStringBrand,
  buildStringSchema,
} from './schema-builder';

const UsernameSchema = pipe(
  stringSchema(),
  withNonEmpty('Username is required'),
  withMinLength(3, 'Username must be at least 3 characters'),
  withMaxLength(20, 'Username cannot exceed 20 characters'),
  withPattern(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores',
  ),
  withStringBrand('Username'),
);

type Username = Schema.Schema.Type<typeof UsernameSchema>;

// Usage
const validateUsername = Schema.decode(UsernameSchema);
const result = await Effect.runPromise(validateUsername('john_doe123'));
```

### 2. Complex Number Validation

For numbers with range and type constraints:

```typescript
const ScoreSchema = pipe(
  numberSchema(),
  withMin(0, 'Score cannot be negative'),
  withMax(100, 'Score cannot exceed 100'),
  withInteger('Score must be a whole number'),
  withNumberCustom((score) => score % 5 === 0, 'Score must be divisible by 5'),
  withNumberBrand('Score'),
);

type Score = Schema.Schema.Type<typeof ScoreSchema>;
```

### 3. Object with Cross-Field Validation

For objects requiring validation across multiple fields:

```typescript
const EventSchema = pipe(
  objectSchema({
    title: CommonSchemas.NonEmptyString,
    startDate: Schema.Date,
    endDate: Schema.Date,
    maxAttendees: CommonSchemas.PositiveInteger,
    currentAttendees: CommonSchemas.NonNegativeNumber,
  }),
  withCrossFieldValidation(
    (event) => event.endDate > event.startDate,
    'End date must be after start date',
  ),
  withCrossFieldValidation(
    (event) => event.currentAttendees <= event.maxAttendees,
    'Current attendees cannot exceed maximum capacity',
  ),
  buildObjectSchema,
);
```

### 4. Conditional Validation

For validation that depends on field values:

```typescript
const ShippingSchema = pipe(
  objectSchema({
    method: enumSchema({
      STANDARD: 'standard',
      EXPRESS: 'express',
      PICKUP: 'pickup',
    }),
    address: optionalSchema(AddressSchema),
    pickupLocation: optionalSchema(CommonSchemas.NonEmptyString),
  }),
  withConditionalValidation(
    (shipping) => shipping.method !== 'pickup',
    (shipping) => {
      if (!shipping.address) {
        return Effect.fail(
          ValidationException.new(
            'ADDRESS_REQUIRED',
            'Address is required for delivery methods',
          ),
        );
      }
      return Effect.succeed(shipping);
    },
  ),
  withConditionalValidation(
    (shipping) => shipping.method === 'pickup',
    (shipping) => {
      if (!shipping.pickupLocation) {
        return Effect.fail(
          ValidationException.new(
            'PICKUP_LOCATION_REQUIRED',
            'Pickup location is required for pickup method',
          ),
        );
      }
      return Effect.succeed(shipping);
    },
  ),
  buildObjectSchema,
);
```

### 5. Array Validation with Constraints

For arrays with size and uniqueness constraints:

```typescript
const TagsSchema = pipe(
  arraySchema(
    pipe(
      stringSchema(),
      withNonEmpty(),
      withMaxLength(20),
      withPattern(
        /^[a-zA-Z0-9-]+$/,
        'Tags can only contain letters, numbers, and hyphens',
      ),
      buildStringSchema,
    ),
  ),
  withMinItems(1, 'At least one tag is required'),
  withMaxItems(5, 'Maximum 5 tags allowed'),
  withUniqueItems('Tags must be unique'),
  buildArraySchema,
);

const PlaylistSchema = pipe(
  arraySchema(SongSchema),
  withMinItems(1, 'Playlist must contain at least one song'),
  withMaxItems(100, 'Playlist cannot exceed 100 songs'),
  withUniqueItems('Songs must be unique in playlist', (song) => song.id),
  buildArraySchema,
);
```

### 6. Nested Object Validation

For complex nested structures:

```typescript
const AddressSchema = pipe(
  objectSchema({
    street: CommonSchemas.NonEmptyString,
    city: CommonSchemas.NonEmptyString,
    state: CommonSchemas.NonEmptyString,
    zipCode: pipe(
      stringSchema(),
      withPattern(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
      buildStringSchema,
    ),
    country: CommonSchemas.NonEmptyString,
  }),
  buildObjectSchema,
);

const UserProfileSchema = pipe(
  objectSchema({
    personalInfo: pipe(
      objectSchema({
        firstName: CommonSchemas.NonEmptyString,
        lastName: CommonSchemas.NonEmptyString,
        email: CommonSchemas.Email,
        phone: optionalSchema(CommonSchemas.PhoneNumber),
      }),
      buildObjectSchema,
    ),
    address: AddressSchema,
    preferences: pipe(
      objectSchema({
        newsletter: Schema.Boolean,
        notifications: Schema.Boolean,
        theme: enumSchema({ LIGHT: 'light', DARK: 'dark' }),
      }),
      buildObjectSchema,
    ),
    tags: pipe(
      arraySchema(CommonSchemas.NonEmptyString),
      withMaxItems(10),
      withUniqueItems(),
      buildArraySchema,
    ),
  }),
  buildObjectSchema,
);
```

## Common Schemas

The library provides pre-built schemas for frequent use cases:

### Identity Schemas

```typescript
CommonSchemas.UUID; // UUID validation
CommonSchemas.Email; // Email format validation
CommonSchemas.PhoneNumber; // Phone number format validation
CommonSchemas.URL; // URL format validation
```

### String Schemas

```typescript
CommonSchemas.NonEmptyString; // Non-empty string
CommonSchemas.ShortText; // String with max 255 characters
CommonSchemas.LongText; // String with max 5000 characters
```

### Number Schemas

```typescript
CommonSchemas.PositiveNumber; // Number > 0
CommonSchemas.NonNegativeNumber; // Number >= 0
CommonSchemas.PositiveInteger; // Integer > 0
CommonSchemas.Age; // Integer 0-150
```

### Date Schemas

```typescript
CommonSchemas.FutureDate; // Date in the future
CommonSchemas.PastDate; // Date in the past
```

### Object Patterns

```typescript
CommonSchemas.TimestampFields; // createdAt, updatedAt
CommonSchemas.AuditFields; // timestamp + createdBy, updatedBy
```

## Best Practices

### 1. Schema Composition Strategy

**For Simple Validation:**

```typescript
// Use common schemas and simple builders
const EmailSchema = CommonSchemas.Email;
const NameSchema = CommonSchemas.NonEmptyString;
```

**For Complex Validation:**

```typescript
// Use functional composition with pipe
const ComplexSchema = pipe(
  stringSchema(),
  withNonEmpty(),
  withPattern(/complex-regex/),
  withStringCustom(customValidation, 'Custom message'),
  buildStringSchema,
);
```

### 2. Error Message Strategy

Provide clear, user-friendly error messages:

```typescript
const PasswordSchema = pipe(
  stringSchema(),
  withMinLength(8, 'Password must be at least 8 characters long'),
  withPattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number, and special character',
  ),
  buildStringSchema,
);
```

### 3. Type Safety with Brands

Use brands for domain-specific types:

```typescript
const UserIdSchema = pipe(
  stringSchema(),
  withPattern(/^user_[a-zA-Z0-9]+$/),
  withStringBrand('UserId'),
);

const ProductIdSchema = pipe(
  stringSchema(),
  withPattern(/^prod_[a-zA-Z0-9]+$/),
  withStringBrand('ProductId'),
);

type UserId = Schema.Schema.Type<typeof UserIdSchema>;
type ProductId = Schema.Schema.Type<typeof ProductIdSchema>;

// These are now distinct types that can't be confused
```

### 4. Reusable Schema Factories

Create factory functions for repeated patterns:

```typescript
const createIdSchema = (prefix: string, brand: string) =>
  pipe(
    stringSchema(),
    withPattern(
      new RegExp(`^${prefix}_[a-zA-Z0-9]+$`),
      `Invalid ${brand} format`,
    ),
    withStringBrand(brand),
  );

const UserIdSchema = createIdSchema('user', 'UserId');
const ProductIdSchema = createIdSchema('prod', 'ProductId');
const OrderIdSchema = createIdSchema('order', 'OrderId');
```

### 5. Cross-Field Validation Organization

Group related cross-field validations logically:

```typescript
const RegistrationSchema = pipe(
  objectSchema({
    email: CommonSchemas.Email,
    password: PasswordSchema,
    confirmPassword: CommonSchemas.NonEmptyString,
    termsAccepted: Schema.Boolean,
    age: CommonSchemas.Age,
  }),
  // Password confirmation
  withCrossFieldValidation(
    (data) => data.password === data.confirmPassword,
    'Passwords must match',
  ),
  // Terms acceptance
  withCrossFieldValidation(
    (data) => data.termsAccepted,
    'Terms and conditions must be accepted',
  ),
  // Age requirement
  withCrossFieldValidation(
    (data) => data.age >= 18,
    'Must be 18 or older to register',
  ),
  buildObjectSchema,
);
```

### 6. Conditional Validation Patterns

Use conditional validation for complex business rules:

```typescript
const PaymentSchema = pipe(
  objectSchema({
    method: enumSchema({ CARD: 'card', BANK: 'bank', WALLET: 'wallet' }),
    cardNumber: optionalSchema(CommonSchemas.NonEmptyString),
    bankAccount: optionalSchema(CommonSchemas.NonEmptyString),
    walletId: optionalSchema(CommonSchemas.NonEmptyString),
  }),
  withConditionalValidation(
    (payment) => payment.method === 'card',
    (payment) => validateCardDetails(payment),
  ),
  withConditionalValidation(
    (payment) => payment.method === 'bank',
    (payment) => validateBankDetails(payment),
  ),
  withConditionalValidation(
    (payment) => payment.method === 'wallet',
    (payment) => validateWalletDetails(payment),
  ),
  buildObjectSchema,
);
```

## Advanced Patterns

### 1. Schema Composition with Inheritance

Create base schemas and extend them:

```typescript
const BaseEntitySchema = pipe(
  objectSchema({
    id: CommonSchemas.UUID,
    ...CommonSchemas.TimestampFields.fields,
  }),
  buildObjectSchema,
);

const UserSchema = pipe(
  objectSchema({
    ...BaseEntitySchema.fields,
    name: CommonSchemas.NonEmptyString,
    email: CommonSchemas.Email,
  }),
  buildObjectSchema,
);
```

### 2. Dynamic Schema Generation

Generate schemas based on configuration:

```typescript
const createEntitySchema = <T extends Record<string, Schema.Schema<any>>>(
  fields: T,
  validations: Array<{
    predicate: (obj: any) => boolean;
    message: string;
    code?: string;
  }> = [],
) => {
  let schema = pipe(
    objectSchema({
      id: CommonSchemas.UUID,
      ...CommonSchemas.TimestampFields.fields,
      ...fields,
    }),
  );

  for (const validation of validations) {
    schema = pipe(
      schema,
      withCrossFieldValidation(
        validation.predicate,
        validation.message,
        validation.code,
      ),
    );
  }

  return pipe(schema, buildObjectSchema);
};

// Usage
const ProductSchema = createEntitySchema(
  {
    name: CommonSchemas.NonEmptyString,
    price: CommonSchemas.PositiveNumber,
    category: CommonSchemas.NonEmptyString,
  },
  [
    {
      predicate: (product) => product.price > 0,
      message: 'Price must be greater than zero',
      code: 'INVALID_PRICE',
    },
  ],
);
```

### 3. Schema Middleware

Add cross-cutting concerns to schema validation:

```typescript
const withAuditValidation = <T extends Record<string, Schema.Schema<any>>>(
  schema: ObjectSchemaState<T>,
) =>
  pipe(
    schema,
    withCrossFieldValidation(
      (obj) => obj.createdAt <= new Date(),
      'Created date cannot be in the future',
    ),
    withConditionalValidation(
      (obj) => obj.updatedAt,
      (obj) => {
        if (obj.updatedAt <= obj.createdAt) {
          return Effect.fail(
            ValidationException.new(
              'INVALID_UPDATE_TIME',
              'Updated date must be after created date',
            ),
          );
        }
        return Effect.succeed(obj);
      },
    ),
  );

const EntityWithAuditSchema = pipe(
  objectSchema({
    id: CommonSchemas.UUID,
    name: CommonSchemas.NonEmptyString,
    ...CommonSchemas.TimestampFields.fields,
  }),
  withAuditValidation,
  buildObjectSchema,
);
```

### 4. Recursive Schema Validation

Handle recursive data structures:

```typescript
interface TreeNode {
  id: string;
  value: string;
  children: TreeNode[];
}

const TreeNodeSchema: Schema.Schema<TreeNode> = Schema.lazy(() =>
  pipe(
    objectSchema({
      id: CommonSchemas.UUID,
      value: CommonSchemas.NonEmptyString,
      children: arraySchema(TreeNodeSchema),
    }),
    buildObjectSchema,
  ),
);
```

## Performance Considerations

### 1. Schema Compilation

Compile schemas once and reuse:

```typescript
// Good: Compile once
const CompiledUserSchema = Schema.decode(UserSchema);

const validateUser = (userData: unknown) => CompiledUserSchema(userData);

// Avoid: Compiling on each validation
const validateUserBad = (userData: unknown) =>
  Schema.decode(UserSchema)(userData);
```

### 2. Conditional Validation Optimization

Minimize expensive operations in conditional validations:

```typescript
// Good: Simple condition check first
withConditionalValidation(
  (obj) => obj.type === 'premium', // Fast check
  (obj) => expensiveValidation(obj), // Expensive validation only when needed
);

// Avoid: Expensive condition check
withConditionalValidation(
  (obj) => expensiveConditionCheck(obj), // Runs on every validation
  (obj) => validation(obj),
);
```

### 3. Array Validation Performance

Be mindful of array size for uniqueness checks:

```typescript
// For large arrays, consider custom uniqueness validation
const OptimizedUniqueSchema = pipe(
  arraySchema(ItemSchema),
  withUniqueItems(
    'Items must be unique',
    (item) => item.id, // Use simple key for comparison
  ),
  buildArraySchema,
);
```

## Integration with Effect Context

The Schema Builder integrates seamlessly with Effect validation:

```typescript
// Define schemas
const UserRegistrationSchema = pipe(
  objectSchema({
    email: CommonSchemas.Email,
    password: PasswordSchema,
    profile: UserProfileSchema,
  }),
  withCrossFieldValidation(
    (data) => data.profile.email === data.email,
    'Profile email must match registration email',
  ),
  buildObjectSchema,
);

// Use in Effect pipelines
const registerUser = (userData: unknown) =>
  Effect.gen(function* () {
    // Validate input
    const validatedData = yield* Schema.decode(UserRegistrationSchema)(
      userData,
    );

    // Create user domain object
    const user = yield* UserTrait.new(validatedData);

    // Save to repository
    const userRepo = yield* UserRepositoryTag;
    yield* userRepo.add(user);

    return user;
  }).pipe(
    Effect.mapError((error) =>
      OperationException.new(
        'USER_REGISTRATION_FAILED',
        `Failed to register user: ${error.message}`,
      ),
    ),
  );
```

This functional approach ensures type safety, composability, and maintainability while providing powerful validation capabilities that integrate seamlessly with your Effect-based domain model system.

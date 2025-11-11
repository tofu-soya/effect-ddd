# Value Objects

Value Objects represent descriptive aspects of the domain with no conceptual identity. They are immutable and defined purely by their attributes. Examples include `Email`, `Money`, and `Address`.

## Core Interface

```typescript
export interface ValueObject<Props extends Record<string, unknown> = Record<string, unknown>> {
  readonly props: Readonly<Props>;
}

export interface ValueObjectTrait<
  VO extends ValueObject,
  NewParams = unknown,
  ParseParams = unknown,
> {
  // Core Methods provided by trait
  new(params: NewParams): Effect.Effect<VO, ValidationException>;
  parse(data: ParseParams): Effect.Effect<VO, ValidationException>;
}
```

## Defining Value Objects

**Recommended Pattern** for value objects with many queries (better TypeScript LSP performance):

### Step 1: Define Types
```typescript
type EmailProps = {
  value: string;
};

type EmailInput = string;

export type Email = ValueObject<EmailProps>;
```

### Step 2: Define Schema (or Custom Parser)
```typescript
// Option A: Using Schema
const EmailSchema = Schema.Struct({
  value: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(254),
    Schema.includes('@')
  ),
});

// Option B: Using Custom Parser
const emailParser = (emailString: string) =>
  Effect.gen(function* () {
    const normalized = emailString.toLowerCase().trim();
    if (!validator.isEmail(normalized)) {
      return yield* Effect.fail(
        ValidationException.new('INVALID_EMAIL', 'Invalid email format')
      );
    }
    return { value: normalized };
  });
```

### Step 3: Create Base Trait (using builders as utilities)
```typescript
// Using schema
const BaseEmailTrait = pipe(
  createValueObject<EmailProps, EmailInput>('Email'),
  withSchema(EmailSchema),
  buildValueObject
);

// Or using custom parser
const BaseEmailTrait = pipe(
  createValueObject<EmailProps, EmailInput>('Email'),
  withPropsParser(emailParser),
  buildValueObject
);
```

> **📖 See:** [Value Object Trait Builder Guide](./value-object-trait-builder.md) for detailed builder API documentation

### Step 4: Define Trait Interface
```typescript
export interface IEmailTrait extends ValueObjectTrait<Email, EmailInput, EmailInput> {
  // Queries
  getDomain(email: Email): string;
  getLocalPart(email: Email): string;
  isCommonDomain(email: Email): boolean;
}
```

### Step 5: Implement Domain Logic
```typescript
export const EmailTrait: IEmailTrait = {
  // Inherit basic operations (new, parse)
  ...BaseEmailTrait,
  
  // Implement domain queries
  getDomain: (email) => email.props.value.split('@')[1],
  getLocalPart: (email) => email.props.value.split('@')[0],
  isCommonDomain: (email) => {
    const domain = email.props.value.split('@')[1];
    const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com'];
    return commonDomains.includes(domain.toLowerCase());
  },
};
```

## Usage

```typescript
const email = await Effect.runPromise(EmailTrait.new('john@gmail.com'));
console.log(EmailTrait.getDomain(email)); // "gmail.com"
console.log(EmailTrait.getLocalPart(email)); // "john"
console.log(EmailTrait.isCommonDomain(email)); // true

// Parse from external data
const emailFromAPI = await Effect.runPromise(EmailTrait.parse('USER@EXAMPLE.COM'));
console.log(emailFromAPI.props.value); // "user@example.com" (normalized)
```

## Common Patterns

### Money Value Object
```typescript
type MoneyProps = { amount: number; currency: string };
export type Money = ValueObject<MoneyProps>;

const MoneyTrait = {
  ...pipe(
    createValueObject<MoneyProps, MoneyProps>('Money'),
    withSchema(Schema.Struct({
      amount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
      currency: Schema.String.pipe(Schema.length(3))
    })),
    buildValueObject
  ),
  
  add: (other: Money) => (money: Money) => 
    money.props.currency === other.props.currency
      ? Effect.succeed({ amount: money.props.amount + other.props.amount, currency: money.props.currency })
      : Effect.fail(ValidationException.new('CURRENCY_MISMATCH', 'Cannot add different currencies')),
};
```

### Address Value Object
```typescript
type AddressProps = {
  street: string;
  city: string;
  postalCode: string;
  country: string;
};

export type Address = ValueObject<AddressProps>;

const AddressTrait = {
  ...pipe(
    createValueObject<AddressProps, AddressProps>('Address'),
    withSchema(AddressSchema),
    buildValueObject
  ),
  
  getFullAddress: (address: Address) => 
    `${address.props.street}, ${address.props.city} ${address.props.postalCode}, ${address.props.country}`,
  
  isSameCity: (other: Address) => (address: Address) =>
    address.props.city === other.props.city && address.props.country === other.props.country,
};
```

## Builder Functions as Utilities

- `createValueObject()` / `buildValueObject()` are **trait building utilities**
- They provide basic `new`, `parse` operations and schema validation
- **Not intended** for complex domain logic (use normal methods instead for better LSP performance)

import { ValueObject, ValueObjectTrait } from 'src/model/interfaces/value-object.interface';
import { ValueObjectGenericTrait } from 'src/model/implementations';
import { Effect } from 'effect';

describe('ValueObject Documentation', () => {
  test('All exported types have documentation', () => {
    expect(ValueObject).toHaveDocumentation();
    expect(ValueObjectTrait).toHaveDocumentation();
    expect(ValueObjectGenericTrait).toHaveDocumentation();
  });

  test('Code examples in documentation work', async () => {
    // Example from ValueObject interface docs
    type EmailProps = { value: string };
    type Email = ValueObject<EmailProps>;
    
    const EmailTrait = {
      new: (value: string) => Effect.succeed({ props: { value } })
    };

    const email1 = await Effect.runPromise(EmailTrait.new("test@example.com"));
    const email2 = await Effect.runPromise(EmailTrait.new("test@example.com"));
    
    expect(ValueObjectGenericTrait.isEqual(email1, email2)).toBe(true);
  });
});

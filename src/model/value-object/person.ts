import { Schema } from 'effect';
import validator from 'validator';

export const Username = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(20),
  Schema.pattern(/^(?=.{1,20}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$/, {
    message: () => 'Invalid username format',
    description: `
          no _ or . at the end
          allowed characters alphabet, uppercase alphabet, number from 0-9
          no __ or _. or ._ or .. inside
          no _ or . at the beginning
          username is 1-20 characters long
        `,
  }),
  Schema.brand('Username'),
);

export const FirstLastName = Schema.String.pipe(
  Schema.pattern(/^[\w'-,.][^0-9_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/, {
    message: () => 'Invalid name format',
    description:
      'Name must be at least 2 characters and not contain special symbols',
  }),
  Schema.brand('FirstLastName'),
);

export const Email = Schema.String.pipe(
  Schema.filter((s) => validator.isEmail(s), {
    message: () => 'Invalid email format',
  }),
  Schema.brand('Email'),
);

export const VNPhoneNumber = Schema.String.pipe(
  Schema.filter((s) => validator.isMobilePhone(s, ['vi-VN']), {
    message: () => 'Invalid Vietnam phone number format',
  }),
  Schema.brand('VNPhoneNumber'),
);

export const PhoneNumber = Schema.String.pipe(
  Schema.filter((s) => validator.isMobilePhone(s), {
    message: () => 'Invalid phone number format',
  }),
  Schema.brand('PhoneNumber'),
);

export type Username = Schema.Schema.Type<typeof Username>;
export type FirstLastName = Schema.Schema.Type<typeof FirstLastName>;
export type Email = Schema.Schema.Type<typeof Email>;
export type VNPhoneNumber = Schema.Schema.Type<typeof VNPhoneNumber>;
export type PhoneNumber = Schema.Schema.Type<typeof PhoneNumber>;

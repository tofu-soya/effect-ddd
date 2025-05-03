import * as Optic from '@fp-ts/optic';
import { BaseException, BaseExceptionTrait } from '@logic/exception.base';
import { Either, Eq, S } from '@logic/fp';
import { Parser } from '@model/invariant-validation';
import { PrimitiveVOTrait } from '@model/value-object.base';
import { Brand } from '@type_util/index';
import { v4 as uuidv4 } from 'uuid';

import * as Schema from '@effect/schema/Schema';

export const Identifier = Schema.string.pipe(
  Schema.nonEmpty(),
  Schema.brand('Identifier')
);

export type Identifier = Schema.Schema.Type<typeof Identifier>;

export const parseId = Schema.parse(Identifier);

export const IdEq = Schema.Equivalence(Identifier);

interface IidentifierTrait {
  parse: typeof parseId;
  new: typeof parseId;
  uuid(): Identifier;
}

export const IdentifierTrait: IidentifierTrait = {
  parse: parseId,
  new: parseId,
  uuid: () => uuidv4() as Identifier,
};
export type ObjectWithId = {
  readonly id: Identifier;
};

export const idLens = Optic.id<ObjectWithId>().at('id');

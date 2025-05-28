import * as Optic from '@fp-ts/optic';
import { v4 as uuidv4 } from 'uuid';
import { Schema } from 'effect';

export const Identifier = Schema.UUID;

export type Identifier = Schema.Schema.Type<typeof Identifier>;

export const parseId = Schema.decode(Identifier);

export const IdEq = Schema.equivalence(Identifier);

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

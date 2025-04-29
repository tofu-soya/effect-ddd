import { Either, Option, pipe } from '@logic/fp';
import { apply } from 'fp-ts/lib/function';
import { BooleanFromString } from 'io-ts-types';
import {
  VOLiken,
  ValueObject,
  ValueObjectAuFn,
  ValueObjectTrait,
} from '../value-object.base';
import { GenericDomainModelTrait } from '@model/domain-model.base';
import { optionizeParser } from '@model/parser';
import { GetProps } from 'src/typeclasses/has-props';
import { decodeWithValidationErr } from '@model/io-related-auxiliry-func';
import { parseDate } from '.';
import { Parser } from '@model/invariant-validation';

export type Kyc = ValueObject<{
  isVerified: boolean;
  verifiedAt: Option.Option<Date>;
}>;

const parseProps = (v: VOLiken<Kyc>) =>
  ValueObjectAuFn.structParsing<Kyc>({
    isVerified: pipe(
      decodeWithValidationErr.typeFirst<boolean>,
      apply(BooleanFromString),
      apply({
        code: 'INVALID_VERIFIED_FLAG',
      }),
    )(v.isVerified),
    verifiedAt: pipe(v.verifiedAt, optionizeParser(parseDate({}))),
  });

const parseKyc = (v: unknown) =>
  pipe(
    ValueObjectAuFn.construct<Kyc>,
    apply(parseProps),
    apply('kyc'),
    apply(v),
  );

interface KycTrait extends ValueObjectTrait<Kyc> {
  isVerified: (vo: Kyc) => boolean;
}

const KycTrait: KycTrait = {
  parse: parseKyc,
  new: parseKyc,
  isVerified: GenericDomainModelTrait.simpleQuery<Kyc, boolean>('isVerified'),
};

// PRIMITIVE KYC

export type WithKycPrim<T> = ValueObject<GetProps<Kyc> & { kycInfo: T }>;

type ExtractKycInfoType<WKP> = WKP extends WithKycPrim<infer T> ? T : never;

const parseWithKycpropsForPrim = <T>(voParser: Parser<T>) =>
  ((v: VOLiken<WithKycPrim<T>>) => {
    return pipe(
      v,
      KycTrait.parse,
      Either.bindTo('kyc'),
      Either.bind('kycInfo', () => voParser(v)),
      Either.map(({ kyc, kycInfo }) => ({
        ...GenericDomainModelTrait.unpack(kyc),
        kycInfo,
      })),
    );
  }) as Parser<WithKycPrim<T>['props']>;

interface KycPrimTrait<T extends WithKycPrim<any>>
  extends ValueObjectTrait<T> {}

const parseWithKycPrim =
  <WP extends WithKycPrim<unknown>>(
    tParser: Parser<ExtractKycInfoType<WP>>,
    voTag: string,
  ) =>
  (v: VOLiken<WP>) =>
    pipe(
      ValueObjectAuFn.construct<WP>,
      apply(parseWithKycpropsForPrim<ExtractKycInfoType<WP>>(tParser)),
      apply(voTag),
      apply(v),
    );

export const getKycPrimTrait =
  <WP extends WithKycPrim<unknown>>(tParser: Parser<ExtractKycInfoType<WP>>) =>
  (tag: string) => {
    const parse = parseWithKycPrim<WP>(tParser, tag);
    const kycPrimTrait: KycPrimTrait<WP> = {
      parse,
      new: parse,
    };
    return kycPrimTrait;
  };

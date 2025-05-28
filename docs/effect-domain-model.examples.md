# Example

## ValueObject

```typescript
import { Effect, pipe, Schema } from 'effect';
import {
  NonEmptyString,
  ValueObject,
  ValueObjectGenericTrait,
  ValueObjectTrait,
  URL,
} from 'yl-ddd-ts';

type CVSourcePlatform = ValueObject<{
  name: NonEmptyString;
  webpage: URL;
}>;
type CVSourcePlfParam = { name: string; webpage: string };

export const CVSourcePlatformTrait: ValueObjectTrait<
  CVSourcePlatform,
  CVSourcePlfParam,
  CVSourcePlfParam
> = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    CVSourcePlatform,
    CVSourcePlfParam,
    CVSourcePlfParam
  >((rawInput) => {
    const Props = Schema.Struct({
      name: NonEmptyString,
      webpage: URL,
    });
    return pipe(Schema.decode(Props)(rawInput));
  }, 'CVSourcePlatform'),
};

export type CVSource = ValueObject<{
  platform: CVSourcePlatform;
  url: URL;
}>;

export type CVSourceParam = { platform: CVSourcePlatform; url: string };

export const CVSourceTrait: ValueObjectTrait<
  CVSource,
  CVSourceParam,
  CVSourceParam
> = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    CVSource,
    CVSourceParam,
    CVSourceParam
  >((rawInput) => {
    return pipe(
      rawInput.url,
      Schema.decode(URL),
      Effect.map((url) => ({
        url,
        platform: rawInput.platform,
      })),
    );
  }, 'CVSource'),
};
```

```typescript
import { Schema } from 'effect';
import {
  Identifier,
  NonEmptyString,
  Option,
  ValueObject,
  ValueObjectTrait,
} from 'yl-ddd-ts';

export const EducationRateSchema = Schema.Number.pipe(
  Schema.filter((n) => n > 0 && n <= 4, {
    message: () => 'GPA must be between 0 and 4',
  }),
  Schema.brand('EducationRate'),
);

export const SchoolRankSchema = Schema.Number.pipe(
  Schema.brand('SchoolRank'),
  Schema.filter((n) => n >= 1, {
    message: (n) => `School rank must be >= 1, got ${n}`,
  }),
);

export type EducationRate = Schema.Schema.Type<typeof EducationRateSchema>;

export type Major = ValueObject<{
  name: NonEmptyString;
  parent: Option.Option<NonEmptyString>;
}>;

export enum EducationLevel {
  BS = 'BS',
  MS = 'MS',
  PHD = 'PhD',
}

export type Education = ValueObject<{
  schoolId: Identifier;
  startDate: Date;
  endDate: Date;
  rate: EducationRate;
  level: EducationLevel;
  majors: Major[];
}>;

export type MajorParam = { name: string; majorParent?: string };

export type EducationParam = {
  schoolId: string;
  startDate: Date;
  endDate: Date;
  rate: number;
  level: EducationLevel;
  majors: Major[];
};

export interface EducationTrait
  extends ValueObjectTrait<Education, any, EducationParam> {}

export type SchoolRank = Schema.Schema.Type<typeof SchoolRankSchema>;

export type School = ValueObject<{
  id: Identifier;
  title: NonEmptyString;
  abbr: NonEmptyString;
  rank: SchoolRank;
}>;

export interface SchoolTrait
  extends ValueObjectTrait<School, SchoolParam, SchoolParam> {}

export type SchoolParam = {
  id: string;
  title: string;
  abbr: string;
  rank: SchoolRank;
};
```

```typescript
import {
  Identifier,
  NonEmptyString,
  pipe,
  ValidationException,
  ValueObjectGenericTrait,
} from 'yl-ddd-ts';
import {
  Education,
  EducationLevel,
  EducationParam,
  EducationRateSchema,
  Major,
  MajorParam,
  School,
  SchoolParam,
  SchoolRankSchema,
  SchoolTrait,
} from './main';
import { Effect, Schema } from 'effect';

export * from './main';

export const majorTrait = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    Major,
    MajorParam,
    MajorParam
  >((params) => {
    const MajorSchema = Schema.Struct({
      name: NonEmptyString,
      parent: Schema.optionalWith(NonEmptyString, { as: 'Option' }),
    });

    return Schema.decode(MajorSchema)({
      name: params.name,
      parent: params.majorParent,
    });
  }, 'Major'),
};

export const educationTrait = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    Education,
    EducationParam,
    EducationParam
  >((p) => {
    const EducationSchema = Schema.Struct({
      schoolId: Identifier,
      rate: EducationRateSchema,
      level: Schema.Enums(EducationLevel),
    });

    if (p.startDate && p.endDate && p.startDate > p.endDate) {
      return Effect.fail(
        ValidationException.new(
          'BEFORE_DATE_CANNOT_>_END_DATE',
          'Start date must be before end date',
        ),
      );
    }
    return pipe(
      Schema.decode(EducationSchema)({
        schoolId: p.schoolId,
        rate: p.rate,
        level: p.level,
      }),
      Effect.map((parseResult) => ({
        ...parseResult,
        startDate: p.startDate,
        endDate: p.endDate,
        majors: p.majors,
      })),
    );
  }, 'Education'),
};

export const schoolTrait: SchoolTrait = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    School,
    SchoolParam,
    SchoolParam
  >((p) => {
    const SchoolSchema = Schema.Struct({
      id: Identifier,
      title: NonEmptyString,
      abbr: NonEmptyString,
      rank: SchoolRankSchema,
    });

    return Schema.decode(SchoolSchema)({
      id: p.id,
      title: p.title,
      abbr: p.abbr,
      rank: p.rank,
    });
  }, 'School'),
};
```

### Entity

```
cv
├── linkedin.ts
├── main.ts
├── index.ts
├── language.ts
├── github.ts
├── cv-source.ts
├── portfolio.ts
├── project.ts
├── impl.ts
├── reference.ts
└── skill.ts

```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/linkedin.ts`:

```ts
import { Schema } from 'effect';

const linkedInPattern = new RegExp(
  '^(?:http(?:s?)://)?(?:www.)?linkedin.(?:[a-z]+)/in/([A-Za-z0-9-]+)',
);

export const LinkedInId = Schema.String.pipe(
  Schema.pattern(linkedInPattern, {
    message: () => 'Invalid LinkedIn URL',
  }),
  Schema.brand('LinkedInId'),
);

export type LinkedInId = Schema.Schema.Type<typeof LinkedInId>;
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/main.ts`:

```ts
import {
  CommandOnModel,
  Entity,
  EntityTrait,
  NonEmptyString,
  PositiveNumber,
} from 'yl-ddd-ts';
import { CompanyExp } from '../company-exp';
import { Education } from '../education';
import { CVSource } from './cv-source';
import { ProjectExp } from './project';
import { Skill } from './skill';
import { LanguageSkill } from './language';
import { Reference } from './reference';
import { Option } from 'effect';

export type CV = Entity<{
  version: PositiveNumber;
  summary: NonEmptyString;
  companies: CompanyExp[];
  educations: Education[];
  languages: LanguageSkill[];
  references: Reference[];
  skills: Skill[];
  cvSource: Option.Option<CVSource>;
  projects: ProjectExp[];
}>;

export type CVParam = {
  version: number;
  summary: string;
  companies: CompanyExp[];
  educations: Education[];
  languageSkills: LanguageSkill[];
  references: Reference[];
  skills: Skill[];
  cvSource: Option.Option<CVSource>;
  projects: ProjectExp[];
};

export type UpdateParam = {
  summary: Option.Option<NonEmptyString>;
  companies: Option.Option<CompanyExp[]>;
  educations: Option.Option<Education[]>;
  languageSkills: Option.Option<LanguageSkill[]>;
  references: Option.Option<Reference[]>;
  skills: Option.Option<Skill[]>;
  cvSource: Option.Option<CVSource>;
  projects: Option.Option<ProjectExp[]>;
};

export interface CVTrait extends EntityTrait<CV, any, CVParam> {
  update: (params: UpdateParam) => CommandOnModel<CV>;
}
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/index.ts`:

```ts
export * as CVSource from './cv-source';
export * as Github from './github';
export * as Language from './language';
export * as LinkedIn from './linkedin';
export * as Portfolio from './portfolio';
export * as Project from './project';
export * as Reference from './reference';
export * as Skill from './skill';

export * from './main';
export * from './impl';
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/language.ts`:

```ts
import { Effect, Schema } from 'effect';
import {
  ValueObject,
  ValueObjectGenericTrait,
  ValueObjectTrait,
} from 'yl-ddd-ts';

export enum LanguageLevel {
  Beginner = 'Beginner',
  Elementary = 'Elementary',
  Intermediate = 'Intermediate',
  UpperIntermediate = 'Upper Intermediate',
  Advanced = 'Advanced',
  Proficient = 'Proficient',
  Native = 'Native',
}

export enum LanguageNames {
  AF = 'af', // Afrikaans
  SQ = 'sq', // Albanian
  AM = 'am', // Amharic
  AR = 'ar', // Arabic
  HY = 'hy', // Armenian
  AZ = 'az', // Azerbaijani
  EU = 'eu', // Basque
  BE = 'be', // Belarusian
  BN = 'bn', // Bengali
  BS = 'bs', // Bosnian
  BG = 'bg', // Bulgarian
  CA = 'ca', // Catalan
  ZH = 'zh', // Chinese
  HR = 'hr', // Croatian
  CS = 'cs', // Czech
  DA = 'da', // Danish
  NL = 'nl', // Dutch
  EN = 'en', // English
  EO = 'eo', // Esperanto
  ET = 'et', // Estonian
  FI = 'fi', // Finnish
  FR = 'fr', // French
  GL = 'gl', // Galician
  KA = 'ka', // Georgian
  DE = 'de', // German
  EL = 'el', // Greek
  GU = 'gu', // Gujarati
  HE = 'he', // Hebrew
  HI = 'hi', // Hindi
  HU = 'hu', // Hungarian
  IS = 'is', // Icelandic
  ID = 'id', // Indonesian
  GA = 'ga', // Irish
  IT = 'it', // Italian
  JA = 'ja', // Japanese
  KN = 'kn', // Kannada
  KK = 'kk', // Kazakh
  KM = 'km', // Khmer
  KO = 'ko', // Korean
  KY = 'ky', // Kyrgyz
  LV = 'lv', // Latvian
  LT = 'lt', // Lithuanian
  MK = 'mk', // Macedonian
  MS = 'ms', // Malay
  ML = 'ml', // Malayalam
  MT = 'mt', // Maltese
  MR = 'mr', // Marathi
  MN = 'mn', // Mongolian
  NE = 'ne', // Nepali
  NO = 'no', // Norwegian
  OR = 'or', // Odia
  FA = 'fa', // Persian
  PL = 'pl', // Polish
  PT = 'pt', // Portuguese
  PA = 'pa', // Punjabi
  RO = 'ro', // Romanian
  RU = 'ru', // Russian
  SR = 'sr', // Serbian
  SI = 'si', // Sinhala
  SK = 'sk', // Slovak
  SL = 'sl', // Slovenian
  ES = 'es', // Spanish
  SW = 'sw', // Swahili
  SV = 'sv', // Swedish
  TA = 'ta', // Tamil
  TE = 'te', // Telugu
  TH = 'th', // Thai
  TR = 'tr', // Turkish
  UK = 'uk', // Ukrainian
  UR = 'ur', // Urdu
  UZ = 'uz', // Uzbek
  VI = 'vi', // Vietnamese
  CY = 'cy', // Welsh
  XH = 'xh', // Xhosa
  YO = 'yo', // Yoruba
  ZU = 'zu', // Zulu
}

export type LanguageSkill = ValueObject<{
  language: LanguageNames;
  fluency: LanguageLevel;
}>;

export type LanguageParams = {
  language: LanguageNames;
  fluency: LanguageLevel;
};

type LanguageSkillTrait = ValueObjectTrait<
  LanguageSkill,
  LanguageParams,
  LanguageParams
>;

const LanguageNamesSchema = Schema.Enums(LanguageNames);
const LanguageLevelSchema = Schema.Enums(LanguageLevel);

export const languageSkillTrait: LanguageSkillTrait = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    LanguageSkill,
    { language: string; fluency: string },
    { language: string; fluency: string }
  >(
    (params) =>
      Effect.all({
        language: Schema.decodeUnknown(LanguageNamesSchema)(params.language),
        fluency: Schema.decodeUnknown(LanguageLevelSchema)(params.fluency),
      }),
    'LanguageSkill',
  ),
};
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/github.ts`:

```ts
import { Schema } from 'effect';

const githubPattern = new RegExp(
  '^(?:http(?:s?)://)?(?:www.)?github.com/([A-Za-z0-9-]+)',
);

export const GithubId = Schema.String.pipe(
  Schema.pattern(githubPattern, {
    message: () => 'Invalid GitHub URL',
  }),
  Schema.brand('GithubId'),
);

export type GithubId = Schema.Schema.Type<typeof GithubId>;
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/cv-source.ts`:

```ts
import { Effect, pipe, Schema } from 'effect';
import {
  NonEmptyString,
  ValueObject,
  ValueObjectGenericTrait,
  ValueObjectTrait,
  URL,
} from 'yl-ddd-ts';

type CVSourcePlatform = ValueObject<{
  name: NonEmptyString;
  webpage: URL;
}>;
type CVSourcePlfParam = { name: string; webpage: string };

export const CVSourcePlatformTrait: ValueObjectTrait<
  CVSourcePlatform,
  CVSourcePlfParam,
  CVSourcePlfParam
> = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    CVSourcePlatform,
    CVSourcePlfParam,
    CVSourcePlfParam
  >((rawInput) => {
    const Props = Schema.Struct({
      name: NonEmptyString,
      webpage: URL,
    });
    return pipe(Schema.decode(Props)(rawInput));
  }, 'CVSourcePlatform'),
};

export type CVSource = ValueObject<{
  platform: CVSourcePlatform;
  url: URL;
}>;

export type CVSourceParam = { platform: CVSourcePlatform; url: string };

export const CVSourceTrait: ValueObjectTrait<
  CVSource,
  CVSourceParam,
  CVSourceParam
> = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    CVSource,
    CVSourceParam,
    CVSourceParam
  >((rawInput) => {
    return pipe(
      rawInput.url,
      Schema.decode(URL),
      Effect.map((url) => ({
        url,
        platform: rawInput.platform,
      })),
    );
  }, 'CVSource'),
};
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/portfolio.ts`:

```ts
import { Schema } from 'effect';

const pattern = new RegExp(
  '^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR IP (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', // fragment locator
  'i',
);
export const PortfolioWebsite = Schema.String.pipe(
  Schema.pattern(pattern, {
    message: () => 'Invalid portfolio url',
  }),
  Schema.brand('PortfolioWebsite'),
);

export type PortfolioWebsite = Schema.Schema.Type<typeof PortfolioWebsite>;
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/project.ts`:

```ts
import {
  GetProps,
  Identifier,
  NonEmptyString,
  Option,
  ValueObject,
  ValueObjectGenericTrait,
  ValueObjectTrait,
} from 'yl-ddd-ts';
import { SkillName } from './skill';
import { Effect, Schema } from 'effect';

export type Project = ValueObject<{
  name: NonEmptyString;
  companyId: Identifier;
}>;

export type ProjectExp = ValueObject<{
  project: Project;
  description: NonEmptyString[];
  skills: SkillName[];
  startTime: Option.Option<Date>;
  endTime: Option.Option<Date>;
}>;

type Param = {
  name: string;
  companyId: string;
};

type ProjectTrait = ValueObjectTrait<Project, Param, Param>;

export const projectTrait: ProjectTrait = {
  ...ValueObjectGenericTrait.createValueObjectTrait<Project, Param, Param>(
    (params) => {
      const Props = Schema.Struct({
        name: NonEmptyString,
        companyId: Identifier,
      });
      return Schema.decode(Props)(params);
    },
    'Project',
  ),
};

export type ProjectExpParam = Omit<GetProps<ProjectExp>, 'description'> & {
  description: string[];
};

// type ProjectTrait = ValueObjectTrait<
//   ProjectExp,
//   ProjectLiken,
//   ProjectLiken
// >

export const projectExpTrait: ValueObjectTrait<
  ProjectExp,
  ProjectExpParam,
  ProjectExpParam
> = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    ProjectExp,
    ProjectExpParam,
    ProjectExpParam
  >(
    (p) =>
      Effect.all({
        project: Effect.succeed(p.project),
        description: Effect.forEach(p.description, (desc) =>
          Schema.decodeUnknown(NonEmptyString)(desc),
        ),
        skills: Effect.succeed(p.skills),
        startTime: Effect.succeed(p.startTime),
        endTime: Effect.succeed(p.endTime),
      }),
    'Project',
  ),
};
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/impl.ts`:

```ts
import {
  EntityGenericTrait,
  GetProps,
  NonEmptyString,
  PositiveNumber,
} from 'yl-ddd-ts';
import { CV, CVParam, CVTrait, UpdateParam } from './main';
import { Effect, pipe, Schema, Option } from 'effect';

const validateInvariant = (props: GetProps<CV>) => {
  return Effect.succeed(props);
};

export const cvTrait: CVTrait = {
  ...EntityGenericTrait.createEntityTrait<CV, CVParam, CVParam>(
    (p: CVParam) =>
      pipe(
        Effect.all({
          version: Schema.decodeUnknown(PositiveNumber)(p.version),
          summary: Schema.decodeUnknown(NonEmptyString)(p.summary),
        }),
        Effect.map(({ version, summary }) => ({
          companies: p.companies,
          educations: p.educations,
          references: p.references,
          cvSource: p.cvSource,
          skills: p.skills,
          languages: p.languageSkills,
          projects: p.projects,
          version,
          summary,
        })),
        Effect.flatMap(validateInvariant),
      ),
    'Candidate',
  ),
  update: EntityGenericTrait.asCommand<CV, UpdateParam>((params, props) => {
    const updatedProps: GetProps<CV> = {
      ...props,
      summary: Option.getOrElse(() => props.summary)(params.summary),
      companies: Option.getOrElse(() => props.companies)(params.companies),
      educations: Option.getOrElse(() => props.educations)(params.educations),
      languages: Option.getOrElse(() => props.languages)(params.languageSkills),
      references: Option.getOrElse(() => props.references)(params.references),
      skills: Option.getOrElse(() => props.skills)(params.skills),
      cvSource: Option.isSome(params.cvSource)
        ? params.cvSource
        : props.cvSource,
      projects: Option.getOrElse(() => props.projects)(params.projects),
    };

    return pipe(
      validateInvariant(updatedProps),
      Effect.map((props) => ({ props })),
    );
  }),
};
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/reference.ts`:

```ts
import {
  getBaseVOTrait,
  NonEmptyString,
  NonEmptyStringTrait,
  Option,
  optionizeParser,
  ValueObject,
  ValueObjectTrait,
  VOGenericTrait,
} from 'yl-ddd-ts';

export type Reference = ValueObject<{
  name: NonEmptyString;
  title: NonEmptyString;
  email: Option.Option<NonEmptyString>;
  phone: Option.Option<NonEmptyString>;
}>;

export interface ReferenceTrait extends ValueObjectTrait<Reference> {}

export const referenceTrait: ReferenceTrait = {
  ...getBaseVOTrait<Reference>({
    parseProps: (params) =>
      VOGenericTrait.structParsingProps<Reference>({
        name: NonEmptyStringTrait.parse(params.name),
        title: NonEmptyStringTrait.parse(params.title),
        email: optionizeParser(NonEmptyStringTrait.parse)(params.email),
        phone: optionizeParser(NonEmptyStringTrait.parse)(params.phone),
      }),
    tag: 'Reference',
  }),
};
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/cv/skill.ts`:

```ts
import {
  BaseExceptionTrait,
  NonEmptyString,
  ValueObject,
  ValueObjectTrait,
  Option,
} from 'yl-ddd-ts';

export enum SkillLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
  Expert = 'Expert',
}

export type SkillName = NonEmptyString;

export type Skill = ValueObject<{
  name: SkillName;
  level: Option.Option<SkillLevel>;
  keywords: NonEmptyString[];
}>;

export type SkillLiken = {
  name: string;
  level: Option.Option<string>;
  keywords: string[];
};

interface SkillTrait extends ValueObjectTrait<Skill, SkillLiken, SkillLiken> {}

export const skillTrait: SkillTrait = {
  ...getBaseVOTrait<Skill, SkillLiken>({
    parseProps: (params: SkillLiken) =>
      VOGenericTrait.structParsingProps<Skill>({
        name: NonEmptyStringTrait.parse(params.name),
        level: optionizeParser(
          parseEnumItemFromString(
            SkillLevel,
            BaseExceptionTrait.construct(
              'NOT_CORRECT_SKILL_LEVEL',
              `not correct skill level: ${params.level}`,
            ),
          ),
        )(params.level),
        keywords: arrayParser(NonEmptyStringTrait.parse)(params.keywords),
      }),
    tag: 'skill',
  }),
};
```

### Aggregate

```
candidate
├── main.ts
├── index.ts
└── impl.ts

```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/candidate/main.ts`:

```ts
import {
  AggregateRoot,
  AggregateRootTrait,
  CommandOnModel,
  Email,
  Entity,
  EntityTrait,
  PhoneNumber,
  ValueObject,
  ValueObjectTrait,
  NonEmptyString,
} from 'yl-ddd-ts';
import { CV, CVParam, LinkedIn, UpdateParam } from '../cv';
import { GithubId } from '../cv/github';
import { PortfolioWebsite } from '../cv/portfolio';
import { Option } from 'effect';

export type Location = ValueObject<{
  name: NonEmptyString;
}>;

export type LocationParam = {
  name: string;
};

export interface LocationTrait
  extends ValueObjectTrait<Location, LocationParam, LocationParam> {}

export type Person = Entity<{
  name: NonEmptyString;
  email: Option.Option<Email>;
  phone: Option.Option<PhoneNumber>;
  location: Option.Option<Location>;
}>;

export type PersonParam = {
  name: string;
  email: Option.Option<string>;
  phone: Option.Option<string>;
  location: Option.Option<Location>;
};

export interface PersonTrait extends EntityTrait<Person, any, PersonParam> {}

export type Candidate = AggregateRoot<{
  person: Person;
  linkedInId: Option.Option<LinkedIn.LinkedInId>;
  githubId: Option.Option<GithubId>;
  portfolioWebsite: Option.Option<PortfolioWebsite>;
  cvs: CV[];
}>;

export type CandidateParam = {
  name: string;
  email: Option.Option<string>;
  phone: Option.Option<string>;
  location: Option.Option<Location>;
  linkedInId: Option.Option<LinkedIn.LinkedInId>;
  githubId: Option.Option<GithubId>;
  portfolioWebsite: Option.Option<string>;
  cvs: CV[];
  createdAt: Option.Option<Date>;
  updatedAt: Option.Option<Date>;
};

export interface CandidateTrait
  extends AggregateRootTrait<Candidate, CandidateParam, CandidateParam> {
  addCV: (cvParam: CVParam) => CommandOnModel<Candidate>;
  updateCV: (params: {
    cvId: string;
    updates: UpdateParam;
  }) => CommandOnModel<Candidate>;
  getLatestCV: (candidate: Candidate) => Option.Option<CV>;
}
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/candidate/index.ts`:

```ts
export * from './main';
export * from './impl';
```

`/home/p77u4n/Documents/project/carie-service/packages/cv-warehouse/core/models/candidate/impl.ts`:

```ts
import {
  AggGenericTrait,
  BaseExceptionTrait,
  DomainEventTrait,
  Email,
  EntityGenericTrait,
  GenericDomainModelTrait,
  GetProps,
  IdentifierTrait,
  IDomainEvent,
  NonEmptyString,
  NotFoundException,
  OperationException,
  PhoneNumber,
  pipe,
  ValueObjectGenericTrait,
} from 'yl-ddd-ts';
import {
  Candidate,
  CandidateParam,
  CandidateTrait,
  Location,
  LocationParam,
  LocationTrait,
  Person,
  PersonParam,
  PersonTrait,
} from './main';
import { PortfolioWebsite } from '../cv/portfolio';
import { CVParam, cvTrait, UpdateParam as CvUpdateParam } from '../cv';
import { Effect, Schema, Option } from 'effect';
import { mergeLeft } from 'ramda';

export const personTrait: PersonTrait = {
  ...EntityGenericTrait.createEntityTrait<Person, PersonParam, PersonParam>(
    (p: PersonParam) => {
      const PersonData = Schema.Struct({
        name: NonEmptyString,
        email: Schema.optionalWith(Email, { as: 'Option' }),
        phone: Schema.optionalWith(PhoneNumber, { as: 'Option' }),
      });

      return pipe(
        Schema.decode(PersonData)({
          name: p.name,
          email: Option.getOrUndefined(p.email),
          phone: Option.getOrUndefined(p.phone),
        }),
        Effect.map(mergeLeft({ location: p.location })),
      );
    },
    'person',
  ),
};
export const candidateTrait: CandidateTrait = {
  ...AggGenericTrait.createAggregateRootTrait<
    Candidate,
    CandidateParam,
    CandidateParam
  >(
    (p) =>
      Effect.gen(function* () {
        const person = yield* personTrait.parse({
          name: p.name,
          email: p.email,
          phone: p.phone,
          location: p.location,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        });
        const portfolioWebsite = yield* pipe(
          p.portfolioWebsite,
          Option.match({
            onNone: () => Effect.succeed(null),
            onSome: (pW) => {
              return Schema.decode(PortfolioWebsite)(pW);
            },
          }),
        );
        return {
          linkedInId: p.linkedInId,
          githubId: p.githubId,
          portfolioWebsite: Option.fromNullable(portfolioWebsite),
          cvs: p.cvs,
          person,
        };
      }),
    'candidate',
  ),

  addCV: AggGenericTrait.asCommand<Candidate, CVParam>(
    (cvParam, props, candidate) => {
      const cvValidation = cvTrait.new(cvParam);

      return pipe(
        cvValidation,
        Effect.map((newCV) => {
          const updatedProps: GetProps<Candidate> = {
            ...props,
            cvs: [...props.cvs, newCV],
          };

          const events: IDomainEvent[] = [
            DomainEventTrait.create({
              aggregate: candidate,
              payload: {
                cvId: newCV.id,
              },
              correlationId: IdentifierTrait.uuid(),
              name: 'CV_ADDED',
            }),
          ];

          return { props: updatedProps, domainEvents: events };
        }),
      );
    },
  ),
  // Additional methods specific to Candidate
  getLatestCV: GenericDomainModelTrait.asQueryOpt((props) => {
    return pipe(
      props.cvs,
      Option.liftPredicate((cvs) => cvs.length > 0),
      Option.map((cvs) =>
        cvs.reduce((latest, current) =>
          current.props.version > latest.props.version ? current : latest,
        ),
      ),
    );
  }),
  updateCV: AggGenericTrait.asCommand<
    Candidate,
    {
      cvId: string;
      updates: CvUpdateParam;
    }
  >((params, props, candidate, correlationId) => {
    const cvIndex = props.cvs.findIndex((cv) => cv.id === params.cvId);

    if (cvIndex === -1) {
      return Effect.fail(NotFoundException.new('CV_NOT_FOUND', 'CV not found'));
    }

    const cvUpdateResult = cvTrait.update(params.updates)(props.cvs[cvIndex]);

    return pipe(
      cvUpdateResult,
      Effect.map((cvCmdResult) => {
        const updatedCVs = [...props.cvs];
        updatedCVs[cvIndex] = cvCmdResult;
        const updatedProps: GetProps<Candidate> = {
          ...props,
          cvs: updatedCVs,
        };
        const events: IDomainEvent[] = [
          DomainEventTrait.create({
            aggregate: candidate,
            payload: {
              cvId: params.cvId,
            },
            correlationId,
            name: 'CANDIDATE_CV_UPDATED',
          }),
        ];

        return { props: updatedProps, domainEvents: events };
      }),
      Effect.mapError((error) =>
        OperationException.new('CV_UPDATE_FAILED', 'Failed to update CV', {
          details: [error.toString()],
        }),
      ),
    );
  }),
};

export const locationTrait: LocationTrait = {
  ...ValueObjectGenericTrait.createValueObjectTrait<
    Location,
    LocationParam,
    LocationParam
  >((p) => {
    const Props = Schema.Struct({
      name: NonEmptyString,
    });
    return Schema.decode(Props)({
      name: p.name,
    });
  }, 'Location'),
};
```

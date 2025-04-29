import { Brand } from '@type_util/index';
import {
  PrimitiveVOTrait,
  VOGenericTrait,
  VOLiken,
  ValueObject,
  ValueObjectTrait,
  getBaseVOTrait,
  getPrimitiveVOTrait,
} from '../value-object.base';
import { isString } from 'fp-ts/lib/string';
import { NEStringAuFn } from './NoneEmptyString';

export type FileType = Brand<string, 'FileType'>;

export enum FileTypeEnum {
  PNG = 'png',
  JPEG = 'jpeg',
  JPG = 'jpg',
  PDF = 'pdf',
  DOC = 'doc',
  DOCX = 'docx',
}

interface IFileTypeTrait extends PrimitiveVOTrait<FileType> {}

const FileTypeTrait: IFileTypeTrait = {
  ...getPrimitiveVOTrait<FileType>({
    predicate: (v: unknown) =>
      isString(v) && v in [Object.values(FileTypeEnum)],
  }),
};

export type FileURLPath = Brand<string, 'FileURLToPath'>;

const FileURLTrait = getPrimitiveVOTrait<FileURLPath>({
  predicate: (v: unknown) =>
    isString(v) &&
    new RegExp(
      `(http(s?):)([/|.|\w|\s|-])*\.(?:${Object.values(FileTypeEnum).join(
        '|',
      )})`,
    ).test(v),
});

type FileName = Brand<string, 'FileName'>;

const FileNameTrait = NEStringAuFn.getTrait<FileName>({
  max: 300,
  message: 'File name not be empty and not too long than 300 characters',
  exceptionCode: 'INVALID_FILENAME',
});

export interface FileProps {
  type: FileType;
  url: FileURLPath;
  name: FileName;
}

export type File = ValueObject<FileProps>;

export const FileTrait: ValueObjectTrait<File> = getBaseVOTrait<File>({
  parseProps: (fileLiken: VOLiken<File>) =>
    VOGenericTrait.structParsingProps<File>({
      type: FileTypeTrait.parse(fileLiken.type),
      url: FileURLTrait.parse(fileLiken.url),
      name: FileNameTrait.parse(fileLiken.name),
    }),
  tag: 'File',
});

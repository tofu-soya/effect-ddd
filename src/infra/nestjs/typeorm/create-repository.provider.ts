import { Provider } from '@nestjs/common';
import { DataSource, ObjectLiteral } from 'typeorm';
import BaseRepository from './base.repository';

export default function createRepositoryProvider<T extends ObjectLiteral>(
  entity: new () => T,
): Provider {
  console.log(`create repository provider ${entity.name}TransRepository`);
  return {
    provide: `${entity.name}TransRepository`,
    useFactory: (dataSource: DataSource) => {
      return new BaseRepository<T>(dataSource, entity);
    },
    inject: [DataSource],
  };
}

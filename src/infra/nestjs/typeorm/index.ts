// Base repository pattern
export { default as TypeOrmBaseRepository } from './base.repository';
export { default as createTypeOrmRepositoryProvider } from './create-repository.provider';

// Unit of Work pattern
export { UnitOfWork } from './unit-of-work.service';
export type { UnitOfWorkContext as UnitOfWorkContextType } from './unit-of-work.service';

// Transactional decorator
export { Transactional } from './transactional.decorator';
export type { TransactionalOptions } from './transactional.decorator';

// Utilities
export {
  getCurrentEntityManager,
  isInTransaction,
  requireEntityManager,
  hasUnitOfWork,
} from './transactional.utils';

// Effect integration
export {
  UnitOfWorkContext,
  EntityManagerContext,
  createUnitOfWorkLayer,
  beginUnitOfWork,
  commitUnitOfWork,
  rollbackUnitOfWork,
  withUnitOfWork,
  executeInUnitOfWork,
  isUnitOfWorkActive,
  getEntityManagerOrFail,
  EffectUnitOfWorkTrait,
} from './effect-integration';

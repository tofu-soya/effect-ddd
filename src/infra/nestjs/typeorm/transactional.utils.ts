import { EntityManager } from 'typeorm';
import { ENTITY_MANAGER_KEY, getNamespaceInstance } from '../cls.middleware';

/**
 * Utility functions for working with transactional context
 */

/**
 * Get the current transactional EntityManager from CLS context.
 * Returns undefined if not in a transactional context.
 *
 * Usage in repositories or services:
 * ```typescript
 * const em = getCurrentEntityManager();
 * if (em) {
 *   // Use transactional EntityManager
 * } else {
 *   // Use default EntityManager
 * }
 * ```
 */
export function getCurrentEntityManager(): EntityManager | undefined {
  const namespace = getNamespaceInstance();
  return namespace.get(ENTITY_MANAGER_KEY);
}

/**
 * Check if currently executing within a transactional context.
 *
 * Usage:
 * ```typescript
 * if (isInTransaction()) {
 *   // Transactional logic
 * }
 * ```
 */
export function isInTransaction(): boolean {
  return getCurrentEntityManager() !== undefined;
}

/**
 * Get the current EntityManager or throw an error if not in transactional context.
 * Use this when your code MUST run within a transaction.
 *
 * Usage:
 * ```typescript
 * const em = requireEntityManager();
 * // Guaranteed to have EntityManager or error thrown
 * ```
 */
export function requireEntityManager(): EntityManager {
  const em = getCurrentEntityManager();
  if (!em) {
    throw new Error(
      'EntityManager not found in context. Ensure code is running within a @Transactional handler or UnitOfWork.execute()',
    );
  }
  return em;
}

/**
 * Type guard to check if an object has the unitOfWork property
 */
export function hasUnitOfWork(obj: any): obj is { unitOfWork: any } {
  return obj && typeof obj === 'object' && 'unitOfWork' in obj;
}

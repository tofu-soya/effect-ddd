import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createNamespace, getNamespace, Namespace } from 'cls-hooked';

const NAMESPACE_NAME = 'TransactionalNamespace';
const namespace = createNamespace(NAMESPACE_NAME);

export const getNamespaceInstance = (): Namespace => {
  return getNamespace(NAMESPACE_NAME) || namespace;
};

export const ENTITY_MANAGER_KEY = 'ENTITY_MANAGER';

@Injectable()
export class ClsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const namespace = getNamespaceInstance();
    namespace.run(() => {
      next();
    });
  }
}

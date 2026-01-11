import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use = (req: Request, res: Response, next: NextFunction): void => {
    const { method, originalUrl } = req;
    const msg = `Incoming Request: ${method} ${originalUrl}`;

    // If the URL includes healthz or metrics, then don't log it
    if (originalUrl.includes('healthz') || originalUrl.includes('metrics')) {
      return next();
    }

    // In future, need to obfuscate sensitive data
    this.logger.log(
      `${msg}, Body: ${JSON.stringify(req.body)}, Headers: ${JSON.stringify(
        req.headers,
      )}`,
    );
    next();
  };
}

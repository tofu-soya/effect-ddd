import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ResponseLoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const startTime = Date.now();
    const chunks: Buffer[] = [];
    // Save original methods to call them later
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    // Override res.write
    res.write = (...args: any[]): boolean => {
      chunks.push(Buffer.from(args[0]));
      return originalWrite(args[0], args[1]);
    };

    // Override res.end
    res.end = (...args: any[]) => {
      if (args[0]) {
        chunks.push(Buffer.from(args[0]));
      }
      const responseBody = Buffer.concat(chunks).toString('utf8');

      // If the URL includes healthz or metrics, then don't log it
      if (originalUrl.includes('healthz') || originalUrl.includes('metrics')) {
        return originalEnd(...args);
      }

      // Log the response here
      const endTime = Date.now();
      this.logger.log(
        `Response: ${method} ${originalUrl}, Response Body: ${responseBody}, Duration: ${
          endTime - startTime
        }ms`,
      );

      return originalEnd(...args);
    };

    next();
  }
}

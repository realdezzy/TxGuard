import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? crypto.randomUUID();
  const start = Date.now();

  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'request',
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      }),
    );
  });

  next();
}

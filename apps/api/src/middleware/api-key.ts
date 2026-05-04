import type { NextFunction, Request, Response } from 'express';
import type { ApiConfig } from '../services/config.js';

import crypto from 'node:crypto';

// Constant-time string comparison to prevent timing attacks on the key.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function apiKeyAuth(config: Pick<ApiConfig, 'apiKey'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!config.apiKey) {
      next();
      return;
    }

    const provided = req.header('x-api-key') ?? '';
    if (!safeEqual(provided, config.apiKey)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}

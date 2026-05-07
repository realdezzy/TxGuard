import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { getRedisClient } from '../services/cache.js';

interface RateLimitOptions {
  windowMs: number;
  perIpMaxRequests: number;
  perKeyMaxRequests: number;
  perPayloadMaxRequests?: number;
}

interface ClientBucket {
  count: number;
  resetAt: number;
}

export function rateLimit(options: RateLimitOptions) {
  // In-memory fallback for cases where Redis is unavailable
  const ipBuckets = new Map<string, ClientBucket>();
  const keyBuckets = new Map<string, ClientBucket>();
  const hashBuckets = new Map<string, ClientBucket>();

  function getInMemoryBucket(buckets: Map<string, ClientBucket>, key: string, now: number): ClientBucket {
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    return bucket;
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const windowSeconds = Math.ceil(options.windowMs / 1000);
    
    const ip = req.ip ?? req.header('x-forwarded-for') ?? 'unknown';
    const apiKey = req.header('x-api-key');
    const transaction = req.body?.transaction;
    const payloadHash = transaction && typeof transaction === 'string' 
      ? createHash('sha256').update(transaction).digest('hex').slice(0, 16)
      : null;

    try {
      const redis = await getRedisClient();
      
      const ipKey = `rl:ip:${ip}`;
      const authKey = apiKey ? `rl:key:${apiKey}` : null;
      const hashKey = payloadHash ? `rl:hash:${payloadHash}` : null;

      const ATOMIC_INCR_SCRIPT = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return count
      `;

      const getCount = async (k: string) => {
        const raw = await redis.eval(ATOMIC_INCR_SCRIPT, {
          keys: [k],
          arguments: [String(windowSeconds)],
        });
        return Number(raw);
      };

      const ipCount = await getCount(ipKey);
      const keyCount = authKey ? await getCount(authKey) : 0;
      const hashCount = hashKey ? await getCount(hashKey) : 0;

      const payloadLimit = options.perPayloadMaxRequests ?? 10;
      const ipRemaining = Math.max(0, options.perIpMaxRequests - ipCount);
      const keyRemaining = authKey ? Math.max(0, options.perKeyMaxRequests - keyCount) : Infinity;
      const hashRemaining = hashKey ? Math.max(0, payloadLimit - hashCount) : Infinity;

      const remaining = Math.min(ipRemaining, keyRemaining, hashRemaining);
      const limit = apiKey ? options.perKeyMaxRequests : options.perIpMaxRequests;

      res.setHeader('x-ratelimit-limit', String(limit));
      res.setHeader('x-ratelimit-remaining', String(remaining));

      if (
        ipCount > options.perIpMaxRequests || 
        (authKey && keyCount > options.perKeyMaxRequests) ||
        (hashKey && hashCount > payloadLimit)
      ) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfterSeconds: windowSeconds, // Simplified reset
        });
        return;
      }

    } catch (err) {
      console.warn('Redis rate limit failed, falling back to in-memory:', err instanceof Error ? err.message : 'Unknown error');
      
      // Fallback logic
      const ipBucket = getInMemoryBucket(ipBuckets, ip, now);
      const keyBucket = apiKey ? getInMemoryBucket(keyBuckets, apiKey, now) : null;
      const hashBucket = payloadHash ? getInMemoryBucket(hashBuckets, payloadHash, now) : null;

      const payloadLimit = options.perPayloadMaxRequests ?? 10;
      const ipRemaining = Math.max(0, options.perIpMaxRequests - ipBucket.count);
      const keyRemaining = keyBucket ? Math.max(0, options.perKeyMaxRequests - keyBucket.count) : Infinity;
      const hashRemaining = hashBucket ? Math.max(0, payloadLimit - hashBucket.count) : Infinity;

      const remaining = Math.min(ipRemaining, keyRemaining, hashRemaining);
      const limit = apiKey ? options.perKeyMaxRequests : options.perIpMaxRequests;

      res.setHeader('x-ratelimit-limit', String(limit));
      res.setHeader('x-ratelimit-remaining', String(remaining));

      if (
        ipBucket.count > options.perIpMaxRequests || 
        (keyBucket && keyBucket.count > options.perKeyMaxRequests) ||
        (hashBucket && hashBucket.count > payloadLimit)
      ) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }
    }

    next();
  };
}


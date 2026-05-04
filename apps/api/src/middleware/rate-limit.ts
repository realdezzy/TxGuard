import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';

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
  const ipBuckets = new Map<string, ClientBucket>();
  const keyBuckets = new Map<string, ClientBucket>();
  const hashBuckets = new Map<string, ClientBucket>();

  function getBucket(buckets: Map<string, ClientBucket>, key: string, now: number): ClientBucket {
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    return bucket;
  }

  function cleanup(buckets: Map<string, ClientBucket>, now: number) {
    if (buckets.size > 10_000) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    
    // IP Bucket
    const ip = req.ip ?? req.header('x-forwarded-for') ?? 'unknown';
    const ipBucket = getBucket(ipBuckets, ip, now);
    const ipRemaining = Math.max(0, options.perIpMaxRequests - ipBucket.count);

    // Key Bucket
    const apiKey = req.header('x-api-key');
    let keyRemaining = Infinity;
    let keyBucket: ClientBucket | null = null;
    
    if (apiKey) {
      keyBucket = getBucket(keyBuckets, apiKey, now);
      keyRemaining = Math.max(0, options.perKeyMaxRequests - keyBucket.count);
    }

    // Payload Hash Bucket (Behavioral Dedup)
    let hashBucket: ClientBucket | null = null;
    let hashRemaining = Infinity;
    const payloadLimit = options.perPayloadMaxRequests ?? 10;
    
    if (req.body?.transaction && typeof req.body.transaction === 'string') {
      const payloadHash = createHash('sha256').update(req.body.transaction).digest('hex');
      hashBucket = getBucket(hashBuckets, payloadHash, now);
      hashRemaining = Math.max(0, payloadLimit - hashBucket.count);
    }

    const remaining = Math.min(ipRemaining, keyRemaining, hashRemaining);
    const limit = apiKey ? options.perKeyMaxRequests : options.perIpMaxRequests;
    const reset = apiKey && keyBucket ? keyBucket.resetAt : ipBucket.resetAt;

    res.setHeader('x-ratelimit-limit', String(limit));
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil(reset / 1000)));

    if (
      ipBucket.count > options.perIpMaxRequests || 
      (keyBucket && keyBucket.count > options.perKeyMaxRequests) ||
      (hashBucket && hashBucket.count > payloadLimit)
    ) {
      const retryAfter = Math.ceil((reset - now) / 1000);
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    cleanup(ipBuckets, now);
    cleanup(keyBuckets, now);
    cleanup(hashBuckets, now);

    next();
  };
}


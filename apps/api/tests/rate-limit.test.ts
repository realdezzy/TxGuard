import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

interface ClientBucket {
  count: number;
  resetAt: number;
}

function createRateLimit(options: {
  windowMs: number;
  perIpMaxRequests: number;
  perKeyMaxRequests: number;
}) {
  const ipBuckets = new Map<string, ClientBucket>();
  const keyBuckets = new Map<string, ClientBucket>();

  function getInMemoryBucket(
    buckets: Map<string, ClientBucket>,
    key: string,
    now: number,
  ): ClientBucket {
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    return bucket;
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const ip = req.ip ?? '127.0.0.1';
    const apiKey = req.header('x-api-key');

    const ipBucket = getInMemoryBucket(ipBuckets, ip, now);
    const keyBucket = apiKey ? getInMemoryBucket(keyBuckets, apiKey, now) : null;

    const ipRemaining = Math.max(0, options.perIpMaxRequests - ipBucket.count);
    const keyRemaining = keyBucket
      ? Math.max(0, options.perKeyMaxRequests - keyBucket.count)
      : Infinity;

    const remaining = Math.min(ipRemaining, keyRemaining);
    const limit = apiKey ? options.perKeyMaxRequests : options.perIpMaxRequests;

    res.setHeader('x-ratelimit-limit', String(limit));
    res.setHeader('x-ratelimit-remaining', String(remaining));

    if (
      ipBucket.count > options.perIpMaxRequests ||
      (keyBucket && keyBucket.count > options.perKeyMaxRequests)
    ) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    next();
  };
}

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '127.0.0.1',
    header: vi.fn().mockReturnValue(undefined),
    body: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    headersSent: false,
  };
  return res as Response;
}

describe('rate-limit middleware (in-memory)', () => {
  let middleware: ReturnType<typeof createRateLimit>;

  beforeEach(() => {
    middleware = createRateLimit({
      windowMs: 60_000,
      perIpMaxRequests: 5,
      perKeyMaxRequests: 50,
    });
  });

  it('allows requests within limit', async () => {
    const req = createMockReq({ ip: '10.0.0.1' });
    const res = createMockRes();
    const next = vi.fn();

    for (let i = 0; i < 5; i++) {
      await middleware(req as Request, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.setHeader).toHaveBeenCalledWith('x-ratelimit-limit', '5');
  });

  it('blocks requests exceeding IP limit', async () => {
    const req = createMockReq({ ip: '10.0.0.2' });
    const res = createMockRes();
    const next = vi.fn();

    for (let i = 0; i < 5; i++) {
      await middleware(req as Request, res, next);
    }

    await middleware(req as Request, res, next);

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('sets remaining header correctly', async () => {
    const req = createMockReq({ ip: '10.0.0.3' });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req as Request, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-ratelimit-remaining', '4');

    await middleware(req as Request, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-ratelimit-remaining', '3');
  });

  it('uses per-key limit when API key is present', async () => {
    const req = createMockReq({
      ip: '10.0.0.4',
      header: vi.fn((name: string) =>
        name === 'x-api-key' ? 'test-api-key' : undefined,
      ),
    });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req as Request, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-ratelimit-limit', '50');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('tracks different IPs independently', async () => {
    const req1 = createMockReq({ ip: '10.0.0.5' });
    const req2 = createMockReq({ ip: '10.0.0.6' });
    const res = createMockRes();
    const next = vi.fn();

    for (let i = 0; i < 6; i++) {
      await middleware(req1 as Request, res, next);
    }
    await middleware(req2 as Request, res, next);

    expect(res.setHeader).toHaveBeenLastCalledWith('x-ratelimit-remaining', '4');
  });
});

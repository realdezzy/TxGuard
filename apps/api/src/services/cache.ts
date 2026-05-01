import { createClient } from 'redis';
import crypto from 'crypto';
import { config } from './config.js';

const CACHE_TTL = 300; // 5 minutes

interface CacheClient {
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX: number }): Promise<unknown>;
  on(event: 'error', listener: (err: Error) => void): unknown;
}

let client: CacheClient | null = null;

export async function getRedisClient(): Promise<CacheClient> {
  if (!client) {
    client = createClient({
      url: config.redisUrl,
      socket: {
        connectTimeout: 5000,
      },
    });
    client.on('error', (err: Error) => console.error('Redis Client Error', err));
    await client.connect();
  }
  return client;
}

export function generateTxHash(tx: string): string {
  return crypto.createHash('sha256').update(tx).digest('hex');
}

export async function getCachedAnalysis(txHash: string): Promise<any | null> {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(`tx:${txHash}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err: unknown) {
    console.warn('Redis cache get failed:', err instanceof Error ? err.message : 'Unknown error');
    return null;
  }
}

export async function setCachedAnalysis(txHash: string, analysis: any): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(`tx:${txHash}`, JSON.stringify(analysis), {
      EX: CACHE_TTL,
    });
  } catch (err: unknown) {
    console.warn('Redis cache set failed:', err instanceof Error ? err.message : 'Unknown error');
  }
}

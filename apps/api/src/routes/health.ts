import { Router } from 'express';
import { getRedisClient } from '../services/cache.js';
import { getSolanaConnection } from '../services/solana.js';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'live', timestamp: Date.now() });
});

healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {
    api: 'ok',
    redis: 'ok',
    solanaRpc: 'ok',
  };

  try {
    await getRedisClient();
  } catch {
    checks.redis = 'error';
  }

  try {
    await getSolanaConnection().getLatestBlockhash('confirmed');
  } catch {
    checks.solanaRpc = 'error';
  }

  const ready = Object.values(checks).every((status) => status === 'ok');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    timestamp: Date.now(),
  });
});

import { Router } from 'express';
import { z } from 'zod';
import { analyzeTransaction } from '@txguard/core';
import { buildProviderChain } from '../services/providers.js';
import { getSolanaConnection } from '../services/solana.js';
import { generateTxHash, getCachedAnalysis, setCachedAnalysis } from '../services/cache.js';
import { config } from '../services/config.js';

export const analyzeRouter: Router = Router();

const analyzeSchema = z.object({
  transaction: z.string().min(1),
  addressHistory: z.array(z.string()).optional().default([]),
});

analyzeRouter.post('/', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { transaction, addressHistory } = parsed.data;
  const txHash = generateTxHash(transaction);

  try {
    const cached = await getCachedAnalysis(txHash);
    if (cached) {
      console.log(`[Cache Hit] Serving tx:${txHash}`);
      res.json(cached);
      return;
    }

    const analysis = await analyzeTransaction(transaction, {
      rpcUrl: config.solanaRpcUrl,
      connection: getSolanaConnection(),
      aiProviders: buildProviderChain(),
      addressHistory,
    });

    await setCachedAnalysis(txHash, analysis);

    res.json(analysis);
  } catch (err) {
    const requestId = (req as any).id ?? 'unknown';
    const message = err instanceof Error ? err.message : 'Unknown error';
    const category = message.includes('RPC') || message.includes('simulation')
      ? 'rpc_error'
      : message.includes('timeout') || message.includes('Timeout')
        ? 'timeout'
        : message.includes('parse') || message.includes('deserialize')
          ? 'parse_error'
          : 'internal_error';
    console.error(JSON.stringify({ requestId, event: 'analysis_failed', category, message }));
    res.status(500).json({ error: 'Analysis failed', category });
  }
});

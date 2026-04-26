import { Router } from 'express';
import { z } from 'zod';
import { analyzeTransaction } from '@txguard/core';
import { buildProviderChain } from '../services/providers.js';
import { getSolanaConnection } from '../services/solana.js';
import { generateTxHash, getCachedAnalysis, setCachedAnalysis } from '../services/cache.js';

export const analyzeRouter: Router = Router();

const analyzeSchema = z.object({
  transaction: z.string().min(1),
  addressHistory: z.array(z.string()).optional().default([]),
  rpcUrl: z.string().url().optional(),
});

analyzeRouter.post('/', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { transaction, addressHistory, rpcUrl } = parsed.data;
  const txHash = generateTxHash(transaction);

  try {
    const cached = await getCachedAnalysis(txHash);
    if (cached) {
      console.log(`[Cache Hit] Serving tx:${txHash}`);
      res.json(cached);
      return;
    }

    const analysis = await analyzeTransaction(transaction, {
      rpcUrl: rpcUrl ?? process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com',
      connection: getSolanaConnection(),
      aiProviders: buildProviderChain(),
      addressHistory,
    });

    await setCachedAnalysis(txHash, analysis);

    res.json(analysis);
  } catch (err) {
    console.error('Analysis failed:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

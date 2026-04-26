import { Router } from 'express';
import { z } from 'zod';
import { analyzeBlinkUrl, fetchBlinkPayload, analyzeTransaction } from '@txguard/core';
import { buildProviderChain } from '../services/providers.js';

export const blinkRouter: Router = Router();

const blinkSchema = z.object({
  url: z.string().url(),
  account: z.string().min(32).max(44),
});

blinkRouter.post('/preview', async (req, res) => {
  const parsed = blinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { url, account } = parsed.data;
  const blinkAnalysis = analyzeBlinkUrl(url);

  if (!blinkAnalysis.isBlink) {
    res.status(400).json({ error: 'URL is not a recognized Solana Action / Blink' });
    return;
  }

  const payload = await fetchBlinkPayload(url, account);

  if (!payload.transaction) {
    res.json({
      blink: blinkAnalysis,
      transaction: null,
      error: payload.error,
    });
    return;
  }

  try {
    const analysis = await analyzeTransaction(payload.transaction, {
      rpcUrl: process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com',
      aiProviders: buildProviderChain(),
    });

    if (blinkAnalysis.signal) {
      analysis.signals.unshift(blinkAnalysis.signal);
    }

    res.json({ blink: blinkAnalysis, analysis });
  } catch (err) {
    console.error('Blink analysis failed:', err);
    res.status(500).json({ error: 'Blink analysis failed' });
  }
});

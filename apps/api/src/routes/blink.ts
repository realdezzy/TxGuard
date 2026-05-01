import { Router } from 'express';
import { z } from 'zod';
import { analyzeBlinkUrl, fetchBlinkPayload, analyzeTransaction } from '@txguard/core';
import { buildProviderChain } from '../services/providers.js';
import { config } from '../services/config.js';

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

  // Wrap fetchBlinkPayload with a timeout
  const payloadPromise = fetchBlinkPayload(url, account);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Blink payload fetch timed out')), 5000),
  );

  let payload;
  try {
    payload = await Promise.race([payloadPromise, timeoutPromise]);
  } catch (err: any) {
    res.status(504).json({ error: err.message });
    return;
  }

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
      rpcUrl: config.solanaRpcUrl,
      aiProviders: buildProviderChain(),
    });

    if (blinkAnalysis.signal) {
      analysis.signals.unshift(blinkAnalysis.signal);
    }

    res.json({ blink: blinkAnalysis, analysis });
  } catch (err) {
    const requestId = (req as any).id ?? 'unknown';
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'blink_analysis_failed', message }));
    res.status(500).json({ error: 'Blink analysis failed' });
  }
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('@txguard/core', () => ({
  analyzeBlinkUrl: vi.fn(),
  fetchBlinkPayload: vi.fn(),
  analyzeTransaction: vi.fn(),
}));

vi.mock('../src/services/config.js', () => ({
  config: {
    nodeEnv: 'test',
    port: 3001,
    corsOriginList: ['*'],
    solanaRpcUrl: 'https://api.devnet.solana.com',
    redisUrl: 'redis://localhost:6379',
    requestBodyLimit: '1mb',
    rateLimitWindowMs: 60_000,
    rateLimitPerIpMaxRequests: 1000,
    rateLimitPerKeyMaxRequests: 10000,
    requestTimeoutMs: 30_000,
    trustedBlinkDomainsList: [],
    trustedMarketProgramsList: [],
  },
}));

vi.mock('../src/services/providers.js', () => ({
  buildProviderChain: vi.fn(() => []),
}));

import { analyzeBlinkUrl, fetchBlinkPayload, analyzeTransaction } from '@txguard/core';
import { blinkRouter } from '../src/routes/blink.js';

describe('POST /blink/preview', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(blinkRouter);
  });

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/preview')
      .send({})
      .expect(400);

    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 for invalid URL', async () => {
    const res = await request(app)
      .post('/preview')
      .send({ url: 'not-a-url', account: 'a'.repeat(32) })
      .expect(400);

    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 for short account', async () => {
    const res = await request(app)
      .post('/preview')
      .send({ url: 'https://example.com', account: 'short' })
      .expect(400);

    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 when URL is not a blink', async () => {
    vi.mocked(analyzeBlinkUrl).mockReturnValue({
      isBlink: false,
      trusted: false,
      signal: null,
    });

    const res = await request(app)
      .post('/preview')
      .send({ url: 'https://example.com', account: 'a'.repeat(32) })
      .expect(400);

    expect(res.body.error).toBe('URL is not a recognized Solana Action / Blink');
  });

  it('returns blink analysis without transaction when payload has no transaction', async () => {
    vi.mocked(analyzeBlinkUrl).mockReturnValue({
      isBlink: true,
      url: 'https://jup.ag/api/actions/swap',
      domain: 'jup.ag',
      trusted: true,
      signal: null,
    });

    vi.mocked(fetchBlinkPayload).mockResolvedValue({
      transaction: null,
    });

    const res = await request(app)
      .post('/preview')
      .send({ url: 'https://jup.ag/api/actions/swap', account: 'a'.repeat(32) })
      .expect(200);

    expect(res.body.blink.isBlink).toBe(true);
    expect(res.body.transaction).toBeNull();
  });

  it('returns full analysis when payload has a transaction', async () => {
    vi.mocked(analyzeBlinkUrl).mockReturnValue({
      isBlink: true,
      url: 'https://jup.ag/api/actions/swap',
      domain: 'jup.ag',
      trusted: true,
      signal: null,
    });

    vi.mocked(fetchBlinkPayload).mockResolvedValue({
      transaction: 'base64tx',
    });

    vi.mocked(analyzeTransaction).mockResolvedValue({
      instructions: [],
      signals: [],
      simulation: null,
      riskScore: 0,
      riskLevel: 'SAFE',
      recommendation: 'APPROVE',
      explanation: 'Safe transaction',
      timestamp: Date.now(),
      whyScore: [],
      scoreVarianceHint: 'LOW',
    });

    const res = await request(app)
      .post('/preview')
      .send({ url: 'https://jup.ag/api/actions/swap', account: 'a'.repeat(32) })
      .expect(200);

    expect(res.body.blink.isBlink).toBe(true);
    expect(res.body.analysis.riskLevel).toBe('SAFE');
    expect(res.body.analysis.recommendation).toBe('APPROVE');
  });

  it('prepends blink signal when blink analysis has a signal', async () => {
    const blinkSignal = {
      type: 'BLINK_PHISHING',
      level: 'HIGH',
      title: 'Untrusted',
      message: 'Not trusted',
    };

    vi.mocked(analyzeBlinkUrl).mockReturnValue({
      isBlink: true,
      url: 'https://malicious.com/api/actions/phish',
      domain: 'malicious.com',
      trusted: false,
      signal: blinkSignal,
    });

    vi.mocked(fetchBlinkPayload).mockResolvedValue({
      transaction: 'base64tx',
    });

    vi.mocked(analyzeTransaction).mockResolvedValue({
      instructions: [],
      signals: [{ type: 'UNKNOWN_PROGRAM', level: 'LOW', title: 'Unknown', message: 'unknown' }],
      simulation: null,
      riskScore: 10,
      riskLevel: 'LOW',
      recommendation: 'CAUTION',
      explanation: 'Unknown program',
      timestamp: Date.now(),
      whyScore: [],
      scoreVarianceHint: 'LOW',
    });

    const res = await request(app)
      .post('/preview')
      .send({ url: 'https://malicious.com/api/actions/phish', account: 'a'.repeat(32) })
      .expect(200);

    expect(res.body.analysis.signals[0].type).toBe('BLINK_PHISHING');
  });

  it('returns 504 when fetchBlinkPayload times out', async () => {
    vi.mocked(analyzeBlinkUrl).mockReturnValue({
      isBlink: true,
      url: 'https://jup.ag/api/actions/swap',
      domain: 'jup.ag',
      trusted: true,
      signal: null,
    });

    vi.mocked(fetchBlinkPayload).mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('Blink payload fetch timed out')), 100)),
    );

    const res = await request(app)
      .post('/preview')
      .send({ url: 'https://jup.ag/api/actions/swap', account: 'a'.repeat(32) })
      .expect(504);

    expect(res.body.error).toBe('Blink payload fetch timed out');
  }, 10000);
});

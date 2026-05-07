import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('@txguard/core', () => ({
  analyzeTransaction: vi.fn(),
}));

vi.mock('../src/services/providers.js', () => ({
  buildProviderChain: vi.fn(() => []),
}));

vi.mock('../src/services/solana.js', () => ({
  getSolanaConnection: vi.fn(() => ({
    rpcEndpoint: 'https://api.devnet.solana.com',
  })),
}));

vi.mock('../src/services/cache.js', () => ({
  generateTxHash: vi.fn((tx: string) => `hash:${tx.slice(0, 8)}`),
  getCachedAnalysis: vi.fn(),
  setCachedAnalysis: vi.fn(),
}));

import { analyzeTransaction } from '@txguard/core';
import { getCachedAnalysis, setCachedAnalysis } from '../src/services/cache.js';
import { analyzeRouter } from '../src/routes/analyze.js';

describe('POST /analyze', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(analyzeRouter);
  });

  it('returns 400 for missing transaction', async () => {
    const res = await request(app)
      .post('/')
      .send({})
      .expect(400);

    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 for empty transaction', async () => {
    const res = await request(app)
      .post('/')
      .send({ transaction: '' })
      .expect(400);

    expect(res.body.error).toBe('Invalid request');
  });

  it('returns cached analysis on cache hit', async () => {
    vi.mocked(getCachedAnalysis).mockResolvedValue({
      riskLevel: 'SAFE',
      recommendation: 'APPROVE',
      cached: true,
    });

    const res = await request(app)
      .post('/')
      .send({ transaction: 'dGVzdA==' })
      .expect(200);

    expect(res.body.cached).toBe(true);
    expect(res.body.riskLevel).toBe('SAFE');
    expect(analyzeTransaction).not.toHaveBeenCalled();
  });

  it('analyzes transaction on cache miss', async () => {
    vi.mocked(getCachedAnalysis).mockResolvedValue(null);
    vi.mocked(analyzeTransaction).mockResolvedValue({
      instructions: [],
      signals: [],
      simulation: null,
      riskScore: 25,
      riskLevel: 'LOW',
      recommendation: 'CAUTION',
      explanation: 'Test analysis',
      timestamp: Date.now(),
      whyScore: [],
      scoreVarianceHint: 'LOW',
    });

    const res = await request(app)
      .post('/')
      .send({ transaction: 'dGVzdA==' })
      .expect(200);

    expect(res.body.riskLevel).toBe('LOW');
    expect(res.body.recommendation).toBe('CAUTION');
    expect(analyzeTransaction).toHaveBeenCalledTimes(1);
    expect(setCachedAnalysis).toHaveBeenCalledTimes(1);
  });

  it('accepts cluster parameter', async () => {
    vi.mocked(getCachedAnalysis).mockResolvedValue(null);
    vi.mocked(analyzeTransaction).mockResolvedValue({
      instructions: [],
      signals: [],
      simulation: null,
      riskScore: 0,
      riskLevel: 'SAFE',
      recommendation: 'APPROVE',
      explanation: '',
      timestamp: Date.now(),
      whyScore: [],
      scoreVarianceHint: 'LOW',
    });

    await request(app)
      .post('/')
      .send({ transaction: 'dGVzdA==', cluster: 'mainnet-beta' })
      .expect(200);
  });

  it('rejects invalid cluster', async () => {
    const res = await request(app)
      .post('/')
      .send({ transaction: 'dGVzdA==', cluster: 'invalid' })
      .expect(400);

    expect(res.body.error).toBe('Invalid request');
  });

  it('accepts addressHistory parameter', async () => {
    vi.mocked(getCachedAnalysis).mockResolvedValue(null);
    vi.mocked(analyzeTransaction).mockResolvedValue({
      instructions: [],
      signals: [],
      simulation: null,
      riskScore: 0,
      riskLevel: 'SAFE',
      recommendation: 'APPROVE',
      explanation: '',
      timestamp: Date.now(),
      whyScore: [],
      scoreVarianceHint: 'LOW',
    });

    await request(app)
      .post('/')
      .send({
        transaction: 'dGVzdA==',
        addressHistory: ['addr1', 'addr2'],
      })
      .expect(200);
  });
});

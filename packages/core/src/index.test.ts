import { describe, expect, it } from 'vitest';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { analyzeTransaction } from './index.js';
import { RiskLevel, SignalType } from './types/index.js';

function serializeUnsigned(transaction: Transaction): string {
  transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
  transaction.feePayer = Keypair.generate().publicKey;
  return transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
}

describe('analyzeTransaction', () => {
  it('emits an explicit signal when RPC simulation is unavailable', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: 1_000_000,
      }),
    );

    const analysis = await analyzeTransaction(serializeUnsigned(transaction), {
      rpcUrl: 'https://api.devnet.solana.com',
      connection: {
        simulateTransaction: async () => {
          throw new Error('network timeout');
        },
      } as never,
      aiProviders: [],
    });

    expect(analysis.simulation).toBeNull();
    expect(analysis.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: SignalType.SIMULATION_UNAVAILABLE,
          level: RiskLevel.MEDIUM,
          metadata: { error: 'RPC simulation unavailable: network timeout' },
        }),
      ]),
    );
    expect(analysis.recommendation).toBe('APPROVE');
  });
});

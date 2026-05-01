import { describe, expect, it, vi } from 'vitest';
import type { Connection } from '@solana/web3.js';
import { simulateTransaction, simulationToSignal, simulationUnavailableToSignal } from './index.js';
import { SignalType, RiskLevel } from '../types/index.js';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';

function serializeUnsigned(transaction: Transaction): string {
  transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
  transaction.feePayer = Keypair.generate().publicKey;
  return transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
}

function mockConnection(overrides: Partial<{
  simulateTransaction: Connection['simulateTransaction'];
  getMultipleAccountsInfo: Connection['getMultipleAccountsInfo'];
}>): Connection {
  return {
    simulateTransaction: overrides.simulateTransaction ?? vi.fn(),
    getMultipleAccountsInfo: overrides.getMultipleAccountsInfo ?? vi.fn().mockResolvedValue([]),
  } as unknown as Connection;
}

function makeTx(): string {
  const from = Keypair.generate().publicKey;
  const to = Keypair.generate().publicKey;
  return serializeUnsigned(
    new Transaction().add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 1_000 })),
  );
}

describe('simulateTransaction', () => {
  it('returns success with sol balance deltas when pre and post lamports differ', async () => {
    const rawTx = makeTx();
    const preAccountInfo = [{ lamports: 5_000_000_000, data: Buffer.alloc(0), owner: SystemProgram.programId, executable: false, rentEpoch: 0 }];

    const connection = mockConnection({
      getMultipleAccountsInfo: vi.fn().mockResolvedValue(preAccountInfo),
      simulateTransaction: vi.fn().mockResolvedValue({
        context: { slot: 100 },
        value: {
          err: null,
          logs: [],
          unitsConsumed: 5000,
          accounts: [{ lamports: 4_999_000_000 }],
        },
      }),
    });

    const result = await simulateTransaction(connection, rawTx);

    expect(result.success).toBe(true);
    expect(result.slot).toBe(100);
    expect(result.unitsConsumed).toBe(5000);
    expect(result.balanceChanges).toHaveLength(1);
    expect(result.balanceChanges[0]!.delta).toBeCloseTo(-0.001, 5);
    expect(result.balanceChanges[0]!.before).toBeCloseTo(5, 5);
    expect(result.balanceChanges[0]!.after).toBeCloseTo(4.999, 5);
  });

  it('returns success with empty balance changes when accounts response is absent', async () => {
    const rawTx = makeTx();
    const connection = mockConnection({
      simulateTransaction: vi.fn().mockResolvedValue({
        context: { slot: 50 },
        value: { err: null, logs: ['log line'], unitsConsumed: 100, accounts: null },
      }),
    });

    const result = await simulateTransaction(connection, rawTx);

    expect(result.success).toBe(true);
    expect(result.balanceChanges).toHaveLength(0);
  });

  it('returns failure result when simulation reports an error', async () => {
    const rawTx = makeTx();
    const connection = mockConnection({
      simulateTransaction: vi.fn().mockResolvedValue({
        context: { slot: 10 },
        value: { err: { InstructionError: [0, 'InvalidAccountData'] }, logs: ['error'], unitsConsumed: 0, accounts: null },
      }),
    });

    const result = await simulateTransaction(connection, rawTx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('InstructionError');
    expect(result.slot).toBe(10);
  });

  it('throws when simulateTransaction call throws so caller emits SIMULATION_UNAVAILABLE', async () => {
    const rawTx = makeTx();
    const connection = mockConnection({
      simulateTransaction: vi.fn().mockRejectedValue(new Error('network timeout')),
    });

    await expect(simulateTransaction(connection, rawTx)).rejects.toThrow(
      'RPC simulation unavailable: network timeout',
    );
  });

  it('throws when timeout fires before simulation responds', async () => {
    const rawTx = makeTx();
    const connection = mockConnection({
      simulateTransaction: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5_000)),
      ),
    });

    await expect(
      simulateTransaction(connection, rawTx, { timeoutMs: 10 }),
    ).rejects.toThrow('Simulation timed out after 10ms');
  });

  it('continues when getMultipleAccountsInfo fails and simulation succeeds', async () => {
    const rawTx = makeTx();
    const connection = mockConnection({
      getMultipleAccountsInfo: vi.fn().mockRejectedValue(new Error('rpc fail')),
      simulateTransaction: vi.fn().mockResolvedValue({
        context: { slot: 1 },
        value: { err: null, logs: [], unitsConsumed: 1, accounts: null },
      }),
    });

    const result = await simulateTransaction(connection, rawTx);
    expect(result.success).toBe(true);
  });
});

describe('simulationToSignal', () => {
  it('returns SIMULATION_FAILURE for failed simulation', () => {
    const signal = simulationToSignal({ success: false, error: 'err', logs: [], balanceChanges: [], unitsConsumed: 0 });
    expect(signal?.type).toBe(SignalType.SIMULATION_FAILURE);
    expect(signal?.level).toBe(RiskLevel.HIGH);
  });

  it('returns LARGE_TRANSFER when delta exceeds threshold', () => {
    const signal = simulationToSignal({
      success: true,
      logs: [],
      unitsConsumed: 0,
      balanceChanges: [{ account: 'abc', before: 100, after: 85, delta: -15 }],
    });
    expect(signal?.type).toBe(SignalType.LARGE_TRANSFER);
  });

  it('returns null for safe small transfer', () => {
    const signal = simulationToSignal({
      success: true,
      logs: [],
      unitsConsumed: 0,
      balanceChanges: [{ account: 'abc', before: 1, after: 0.999, delta: -0.001 }],
    });
    expect(signal).toBeNull();
  });

  it('respects a custom threshold', () => {
    const signal = simulationToSignal(
      { success: true, logs: [], unitsConsumed: 0, balanceChanges: [{ account: 'abc', before: 5, after: 2, delta: -3 }] },
      2,
    );
    expect(signal?.type).toBe(SignalType.LARGE_TRANSFER);
  });
});

describe('simulationUnavailableToSignal', () => {
  it('emits SIMULATION_UNAVAILABLE with error message', () => {
    const signal = simulationUnavailableToSignal(new Error('timeout'));
    expect(signal.type).toBe(SignalType.SIMULATION_UNAVAILABLE);
    expect(signal.level).toBe(RiskLevel.MEDIUM);
    expect(signal.metadata?.error).toBe('timeout');
  });
});

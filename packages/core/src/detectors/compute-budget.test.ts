import { describe, expect, it } from 'vitest';
import { SignalType, RiskLevel } from '../types/index.js';
import { detectComputeBudgetManipulation } from './compute-budget.js';
import type { ParsedInstruction, RiskSignal } from '../types/index.js';

function makeCbPriceIx(): ParsedInstruction {
  return {
    programId: 'ComputeBudget111111111111111111111111111111',
    programName: 'Compute Budget',
    type: 'setComputeUnitPrice',
    accounts: [],
    accountMeta: [],
    data: { microLamports: 1_000_000 },
  };
}

function makeCbLimitIx(): ParsedInstruction {
  return {
    programId: 'ComputeBudget111111111111111111111111111111',
    programName: 'Compute Budget',
    type: 'setComputeUnitLimit',
    accounts: [],
    accountMeta: [],
    data: { units: 200_000 },
  };
}

function makeHighSignal(level: RiskSignal['level'] = RiskLevel.HIGH): RiskSignal {
  return {
    type: SignalType.TOKEN_APPROVAL,
    level,
    title: 'Token Delegate Approval',
    message: 'test',
  };
}

describe('detectComputeBudgetManipulation', () => {
  it('returns no signal when there is no setComputeUnitPrice instruction', () => {
    const { signal } = detectComputeBudgetManipulation([makeCbLimitIx()], [makeHighSignal()]);
    expect(signal).toBeNull();
  });

  it('returns no signal when price is set but no high-risk signals exist', () => {
    const lowSignal: RiskSignal = { type: SignalType.TOKEN_REVOCATION, level: RiskLevel.LOW, title: '', message: '' };
    const { signal } = detectComputeBudgetManipulation([makeCbPriceIx()], [lowSignal]);
    expect(signal).toBeNull();
  });

  it('returns no signal when no signals exist at all', () => {
    const { signal } = detectComputeBudgetManipulation([makeCbPriceIx()], []);
    expect(signal).toBeNull();
  });

  it('returns COMPUTE_BUDGET_MANIPULATION MEDIUM when price + HIGH signal are present', () => {
    const { signal } = detectComputeBudgetManipulation([makeCbPriceIx()], [makeHighSignal(RiskLevel.HIGH)]);
    expect(signal?.type).toBe(SignalType.COMPUTE_BUDGET_MANIPULATION);
    expect(signal?.level).toBe(RiskLevel.MEDIUM);
    expect(signal?.metadata?.microLamports).toBe(1_000_000);
  });

  it('returns COMPUTE_BUDGET_MANIPULATION MEDIUM when price + CRITICAL signal are present', () => {
    const { signal } = detectComputeBudgetManipulation([makeCbPriceIx()], [makeHighSignal(RiskLevel.CRITICAL)]);
    expect(signal?.type).toBe(SignalType.COMPUTE_BUDGET_MANIPULATION);
    expect(signal?.level).toBe(RiskLevel.MEDIUM);
  });
});

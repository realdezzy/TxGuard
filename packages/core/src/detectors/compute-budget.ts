import { RiskLevel, SignalType, type RiskSignal, type ParsedInstruction } from '../types/index.js';

const HIGH_RISK_LEVELS: Set<RiskLevel> = new Set([RiskLevel.CRITICAL, RiskLevel.HIGH]);

export interface ComputeBudgetResult {
  signal: RiskSignal | null;
}

export function detectComputeBudgetManipulation(
  instructions: ParsedInstruction[],
  existingSignals: RiskSignal[],
): ComputeBudgetResult {
  const hasComputeUnitPrice = instructions.some((ix) => ix.type === 'setComputeUnitPrice');
  if (!hasComputeUnitPrice) return { signal: null };

  const hasHighRiskSignal = existingSignals.some((s) => HIGH_RISK_LEVELS.has(s.level));
  if (!hasHighRiskSignal) return { signal: null };

  const priceIx = instructions.find((ix) => ix.type === 'setComputeUnitPrice');
  const microLamports = priceIx?.data?.microLamports;

  return {
    signal: {
      type: SignalType.COMPUTE_BUDGET_MANIPULATION,
      level: RiskLevel.MEDIUM,
      title: 'Elevated Priority Fee with High-Risk Operation',
      message:
        'This transaction sets a high-priority fee alongside a high-risk operation. ' +
        'Drainer scripts often do this to ensure execution before the user can react.',
      metadata: { microLamports },
    },
  };
}

import { RiskLevel, SignalType, type RiskSignal } from '../types/index.js';

export const SCORING_VERSION = '1.0.0';

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  [SignalType.ADDRESS_POISONING]: 40,
  [SignalType.DURABLE_NONCE]: 30,
  [SignalType.AUTHORITY_CHANGE]: 20,
  [SignalType.UNKNOWN_PROGRAM]: 10,
  [SignalType.BLINK_PHISHING]: 35,
  [SignalType.LARGE_TRANSFER]: 5,
  // SIMULATION_FAILURE means the tx will likely revert — lower severity than unavailability
  // which leaves the analysis completely blind.
  [SignalType.SIMULATION_FAILURE]: 25,
  [SignalType.SIMULATION_UNAVAILABLE]: 35,
  [SignalType.TOKEN_APPROVAL]: 30,
  [SignalType.TOKEN_REVOCATION]: 5,
  [SignalType.TOKEN_ACCOUNT_CLOSURE]: 25,
  [SignalType.TOKEN_ACCOUNT_FREEZE]: 25,
  [SignalType.CLICKJACKING]: 45,
  [SignalType.WALLET_SPOOFING]: 35,
  [SignalType.COMPUTE_BUDGET_MANIPULATION]: 15,
};

const LEVEL_MULTIPLIERS: Record<RiskLevel, number> = {
  [RiskLevel.SAFE]: 0,
  [RiskLevel.LOW]: 0.25,
  [RiskLevel.MEDIUM]: 0.5,
  [RiskLevel.HIGH]: 0.75,
  [RiskLevel.CRITICAL]: 1.0,
};

export function calculateRiskScore(signals: RiskSignal[]): number {
  if (signals.length === 0) return 0;

  let score = 0;
  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.type] ?? 10;
    const multiplier = LEVEL_MULTIPLIERS[signal.level] ?? 0.5;
    score += weight * multiplier;
  }

  return Math.min(100, Math.round(score));
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return RiskLevel.CRITICAL;
  if (score >= 60) return RiskLevel.HIGH;
  if (score >= 35) return RiskLevel.MEDIUM;
  if (score >= 15) return RiskLevel.LOW;
  return RiskLevel.SAFE;
}

export function scoreToRecommendation(score: number): 'APPROVE' | 'CAUTION' | 'REJECT' {
  if (score >= 60) return 'REJECT';
  if (score >= 25) return 'CAUTION';
  return 'APPROVE';
}

import { RiskLevel, SignalType, type RiskSignal, type WhyScoreReason, type ScoreVarianceHint } from '../types/index.js';

export const SCORING_VERSION = '1.1.0';

export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
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
  [SignalType.INTENT_ANOMALY]: 30,
};

export const LEVEL_MULTIPLIERS: Record<RiskLevel, number> = {
  [RiskLevel.SAFE]: 0,
  [RiskLevel.LOW]: 0.25,
  [RiskLevel.MEDIUM]: 0.5,
  [RiskLevel.HIGH]: 0.75,
  [RiskLevel.CRITICAL]: 1.0,
};

const SIMULATION_SIGNAL_TYPES = new Set<SignalType>([
  SignalType.SIMULATION_FAILURE,
  SignalType.SIMULATION_UNAVAILABLE,
  SignalType.LARGE_TRANSFER,
]);

const BROWSER_SIGNAL_TYPES = new Set<SignalType>([
  SignalType.CLICKJACKING,
  SignalType.WALLET_SPOOFING,
]);

const CONFIDENCE_MULTIPLIERS: Record<string, number> = {
  HIGH: 1.0,
  MEDIUM: 0.7,
  LOW: 0.4,
};

export interface CalculateRiskScoreResult {
  riskScore: number;
  whyScore: WhyScoreReason[];
  scoreVarianceHint: ScoreVarianceHint;
}

export function calculateRiskScore(signals: RiskSignal[]): CalculateRiskScoreResult {
  if (signals.length === 0) return { riskScore: 0, whyScore: [], scoreVarianceHint: 'LOW' };

  let score = 0;
  let txScore = 0;
  let browserScore = 0;
  const whyScore: WhyScoreReason[] = [];

  let hasStaleSimulation = false;
  let hasMissingData = false;

  for (const signal of signals) {
    const isBrowser = BROWSER_SIGNAL_TYPES.has(signal.type);
    const weight = SIGNAL_WEIGHTS[signal.type] ?? 10;
    const multiplier = LEVEL_MULTIPLIERS[signal.level] ?? 0.5;
    let signalScore = weight * multiplier;

    if (SIMULATION_SIGNAL_TYPES.has(signal.type) && signal.metadata?.simulationConfidence) {
      const confMultiplier = CONFIDENCE_MULTIPLIERS[signal.metadata.simulationConfidence as string] ?? 1.0;
      signalScore *= confMultiplier;

      if (signal.metadata.stateConsistencyHint === 'stale' || signal.metadata.stateConsistencyHint === 'slightly_stale') {
        hasStaleSimulation = true;
        signalScore *= 1.2; // Increase penalty when stale, do not reward when recent
      }
    }

    if (signal.type === SignalType.SIMULATION_UNAVAILABLE || signal.type === SignalType.UNKNOWN_PROGRAM) {
      hasMissingData = true;
    }

    signalScore = Math.round(signalScore);

    if (signalScore > 0) {
      whyScore.push({
        code: signal.type,
        label: signal.title,
        points: signalScore,
        source: isBrowser ? 'browser' : SIMULATION_SIGNAL_TYPES.has(signal.type) ? 'simulation' : 'detector',
      });

      if (isBrowser) {
        browserScore += signalScore;
      } else {
        txScore += signalScore;
      }
    }
  }

  // Browser signal conditional amplification
  const currentTxLevel = scoreToRiskLevel(txScore);

  let appliedBrowserScore = 0;
  if (browserScore > 0) {
    if (currentTxLevel === RiskLevel.SAFE || currentTxLevel === RiskLevel.LOW) {
      appliedBrowserScore = Math.min(browserScore, 20);
    } else if (currentTxLevel === RiskLevel.MEDIUM) {
      appliedBrowserScore = Math.min(browserScore, 40);
    } else {
      appliedBrowserScore = browserScore;
    }
    score = txScore + appliedBrowserScore;
  } else {
    score = txScore;
  }

  // Rule-based escalation for high-severity browser signals
  if (currentTxLevel !== RiskLevel.SAFE && currentTxLevel !== RiskLevel.LOW) {
    if (signals.some((s) => s.type === SignalType.WALLET_SPOOFING)) {
      score = Math.max(score, 60);
    }
  }

  let scoreVarianceHint: ScoreVarianceHint = 'LOW';
  if (hasMissingData || hasStaleSimulation) {
    scoreVarianceHint = 'HIGH';
  } else if (signals.some((s) => SIMULATION_SIGNAL_TYPES.has(s.type) && s.metadata?.simulationConfidence === 'LOW')) {
    scoreVarianceHint = 'MEDIUM';
  }

  return {
    riskScore: Math.min(100, Math.round(score)),
    whyScore,
    scoreVarianceHint,
  };
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

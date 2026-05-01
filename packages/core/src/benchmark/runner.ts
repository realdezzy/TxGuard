import { parseTransaction } from '../parser/index.js';
import { runDetectors } from '../index.js';
import { buildCorpus } from './corpus.js';
import { SignalType, RiskLevel } from '../types/index.js';

const RISK_LEVEL_VALUES: Record<RiskLevel, number> = {
  [RiskLevel.SAFE]: 1,
  [RiskLevel.LOW]: 2,
  [RiskLevel.MEDIUM]: 3,
  [RiskLevel.HIGH]: 4,
  [RiskLevel.CRITICAL]: 5,
};

export interface MetricResult {
  total: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export async function runBenchmark(): Promise<{ [signalType: string]: MetricResult }> {
  const corpus = buildCorpus();
  const results: { [key: string]: { expected: boolean; actual: boolean }[] } = {};

  // Initialize tracking for all relevant signal types
  const trackedSignals = [
    SignalType.TOKEN_APPROVAL,
    SignalType.DURABLE_NONCE,
    SignalType.UNKNOWN_PROGRAM,
  ];

  for (const type of trackedSignals) {
    results[type] = [];
  }

  for (const tx of corpus) {
    const instructions = await parseTransaction(tx.rawTransaction);
    const actualSignals = runDetectors(instructions);

    for (const type of trackedSignals) {
      const expectedSignal = tx.expectedSignals.find((s) => s.type === type);
      const actualSignal = actualSignals.find((s) => s.type === type);

      const expected = expectedSignal !== undefined;
      const actual = actualSignal !== undefined &&
        (!expectedSignal || RISK_LEVEL_VALUES[actualSignal.level] >= RISK_LEVEL_VALUES[expectedSignal.minLevel]);

      results[type]!.push({ expected, actual });
    }
  }

  const metrics: { [key: string]: MetricResult } = {};

  for (const [type, evals] of Object.entries(results)) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const e of evals) {
      if (e.expected && e.actual) tp++;
      if (!e.expected && e.actual) fp++;
      if (!e.expected && !e.actual) tn++;
      if (e.expected && !e.actual) fn++;
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1Score = precision + recall === 0 ? 0 : 2 * (precision * recall) / (precision + recall);

    metrics[type] = {
      total: evals.length,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      precision,
      recall,
      f1Score,
    };
  }

  return metrics;
}

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

export interface BenchmarkResult {
  metrics: { [signalType: string]: MetricResult };
  fprPerIntent: { [intent: string]: { [signalType: string]: number } };
  negativeViolations: { txId: string; signal: string }[];
  summary: {
    totalTransactions: number;
    realTransactions: number;
    syntheticTransactions: number;
    overallF1: number;
  };
}

export async function runBenchmark(): Promise<BenchmarkResult> {
  const corpus = buildCorpus();
  const results: { [key: string]: { expected: boolean; actual: boolean }[] } = {};
  const negativeViolations: { txId: string; signal: string }[] = [];

  const allSignalTypes = Object.values(SignalType);
  for (const type of allSignalTypes) {
    results[type] = [];
  }

  const intentResults: { [intent: string]: { [type: string]: { expected: boolean; actual: boolean }[] } } = {};

  for (const tx of corpus) {
    const instructions = await parseTransaction(tx.rawTransaction);
    const actualSignals = runDetectors(instructions);

    if (!intentResults[tx.intent]) intentResults[tx.intent] = {};

    for (const type of allSignalTypes) {
      const expectedSignal = tx.expectedSignals.find((s) => s.type === type);
      const actualSignal = actualSignals.find((s) => s.type === type);

      const expected = expectedSignal !== undefined;
      const actual = actualSignal !== undefined &&
        (!expectedSignal || RISK_LEVEL_VALUES[actualSignal.level] >= RISK_LEVEL_VALUES[expectedSignal.minLevel]);

      results[type]!.push({ expected, actual });

      let intentObj = intentResults[tx.intent];
      if (!intentObj) {
        intentObj = {};
        intentResults[tx.intent] = intentObj;
      }
      let typeArr = intentObj[type];
      if (!typeArr) {
        typeArr = [];
        intentObj[type] = typeArr;
      }
      typeArr.push({ expected, actual });
    }

    if (tx.negativeSignals) {
      for (const negType of tx.negativeSignals) {
        if (actualSignals.some((s) => s.type === negType)) {
          negativeViolations.push({ txId: tx.id, signal: negType });
        }
      }
    }
  }

  const metrics: { [key: string]: MetricResult } = {};
  let totalF1Sum = 0;
  let metricsWithData = 0;

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

    if (tp + fp + fn > 0) {
      totalF1Sum += f1Score;
      metricsWithData++;
    }

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

  const overallF1 = metricsWithData === 0 ? 0 : totalF1Sum / metricsWithData;
  const realCount = corpus.filter((t) => t.source === 'real').length;

  const fprPerIntent: { [intent: string]: { [type: string]: number } } = {};
  for (const [intent, types] of Object.entries(intentResults)) {
    fprPerIntent[intent] = {};
    for (const [type, evals] of Object.entries(types)) {
      let fp = 0, tn = 0;
      for (const e of evals) {
        if (!e.expected && e.actual) fp++;
        if (!e.expected && !e.actual) tn++;
      }
      if (fp + tn > 0) {
        fprPerIntent[intent][type] = fp / (fp + tn);
      }
    }
  }

  return {
    metrics,
    fprPerIntent,
    negativeViolations,
    summary: {
      totalTransactions: corpus.length,
      realTransactions: realCount,
      syntheticTransactions: corpus.length - realCount,
      overallF1,
    },
  };
}

export function formatBenchmarkReport(result: BenchmarkResult): string {
  const lines: string[] = [];
  lines.push('=== TxGuard Benchmark Report ===');
  lines.push('');
  lines.push(`Transactions: ${result.summary.totalTransactions} (${result.summary.realTransactions} real, ${result.summary.syntheticTransactions} synthetic)`);
  lines.push(`Overall F1: ${result.summary.overallF1.toFixed(3)}`);
  lines.push('');

  lines.push('Signal Type                     | TP | FP | TN | FN | Prec  | Rec   | F1');
  lines.push('---                             | -- | -- | -- | -- | ----- | ----- | --');

  for (const [type, m] of Object.entries(result.metrics)) {
    if (m.truePositives + m.falsePositives + m.falseNegatives === 0) continue;
    const name = type.padEnd(32);
    lines.push(
      `${name}| ${String(m.truePositives).padStart(2)} | ${String(m.falsePositives).padStart(2)} | ${String(m.trueNegatives).padStart(2)} | ${String(m.falseNegatives).padStart(2)} | ${m.precision.toFixed(3)} | ${m.recall.toFixed(3)} | ${m.f1Score.toFixed(3)}`,
    );
  }

  if (result.negativeViolations.length > 0) {
    lines.push('');
    lines.push('FALSE POSITIVE VIOLATIONS (negative signal constraints):');
    for (const v of result.negativeViolations) {
      lines.push(`  ${v.txId}: unexpected ${v.signal}`);
    }
  }

  return lines.join('\n');
}

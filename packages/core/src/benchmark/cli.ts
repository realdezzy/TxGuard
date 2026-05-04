import { runBenchmark, formatBenchmarkReport } from './runner.js';

import { SignalType } from '../types/index.js';

const F1_THRESHOLD = 0.80;

const PRECISION_THRESHOLDS: Partial<Record<SignalType, number>> = {
  [SignalType.AUTHORITY_CHANGE]: 0.9,
  [SignalType.TOKEN_APPROVAL]: 0.85,
};

const FPR_THRESHOLDS: Record<string, Partial<Record<SignalType, number>>> = {
  'swap': {
    [SignalType.AUTHORITY_CHANGE]: 0.05,
    [SignalType.INTENT_ANOMALY]: 0.10,
  }
};

async function main() {
  const result = await runBenchmark();
  console.log(formatBenchmarkReport(result));
  console.log('');

  if (result.negativeViolations.length > 0) {
    console.error(`FAIL: ${result.negativeViolations.length} negative signal violation(s)`);
    process.exit(1);
  }

  if (result.summary.overallF1 < F1_THRESHOLD) {
    console.error(`FAIL: Overall F1 ${result.summary.overallF1.toFixed(3)} < threshold ${F1_THRESHOLD}`);
    process.exit(1);
  }

  let failed = false;

  for (const [type, threshold] of Object.entries(PRECISION_THRESHOLDS)) {
    const metric = result.metrics[type];
    if (metric && metric.precision < threshold) {
      console.error(`FAIL: Precision for ${type} is ${metric.precision.toFixed(3)} < threshold ${threshold}`);
      failed = true;
    }
  }

  for (const [intent, thresholds] of Object.entries(FPR_THRESHOLDS)) {
    for (const [type, threshold] of Object.entries(thresholds)) {
      const fpr = result.fprPerIntent[intent]?.[type];
      if (fpr !== undefined && fpr > threshold) {
        console.error(`FAIL: FPR for ${type} in intent '${intent}' is ${fpr.toFixed(3)} > threshold ${threshold}`);
        failed = true;
      }
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log(`PASS: F1 ${result.summary.overallF1.toFixed(3)} >= ${F1_THRESHOLD} and all precision/FPR thresholds met.`);
}

main().catch((err) => {
  console.error('Benchmark crashed:', err);
  process.exit(1);
});

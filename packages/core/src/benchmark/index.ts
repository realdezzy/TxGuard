import { runBenchmark } from './runner.js';
import { SCORING_VERSION } from '../risk/scoring.js';

async function main() {
  console.log(`=========================================`);
  console.log(`TxGuard Core Benchmark`);
  console.log(`Scoring Version: ${SCORING_VERSION}`);
  console.log(`=========================================\n`);

  const metrics = await runBenchmark();

  let totalTp = 0, totalFp = 0, totalTn = 0, totalFn = 0;

  for (const [type, m] of Object.entries(metrics)) {
    console.log(`Signal: ${type}`);
    console.log(`  Precision: ${(m.precision * 100).toFixed(2)}%`);
    console.log(`  Recall:    ${(m.recall * 100).toFixed(2)}%`);
    console.log(`  F1-Score:  ${(m.f1Score * 100).toFixed(2)}%`);
    console.log(`  (TP: ${m.truePositives}, FP: ${m.falsePositives}, TN: ${m.trueNegatives}, FN: ${m.falseNegatives})\n`);

    totalTp += m.truePositives;
    totalFp += m.falsePositives;
    totalTn += m.trueNegatives;
    totalFn += m.falseNegatives;
  }

  const overallPrecision = totalTp + totalFp === 0 ? 0 : totalTp / (totalTp + totalFp);
  const overallRecall = totalTp + totalFn === 0 ? 0 : totalTp / (totalTp + totalFn);

  console.log(`-----------------------------------------`);
  console.log(`OVERALL AGGREGATES`);
  console.log(`  Precision: ${(overallPrecision * 100).toFixed(2)}%`);
  console.log(`  Recall:    ${(overallRecall * 100).toFixed(2)}%`);
  console.log(`-----------------------------------------`);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

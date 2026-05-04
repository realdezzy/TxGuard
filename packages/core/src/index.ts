import { Connection } from '@solana/web3.js';
import {
  SignalType,
  type TransactionAnalysis,
  type GuardianConfig,
  type RiskSignal,
  type SimulationResult,
} from './types/index.js';
import { parseTransaction } from './parser/index.js';
import {
  detectAddressPoisoning,
  detectDurableNonce,
  detectAuthorityChanges,
  detectComputeBudgetManipulation,
  detectWritablePatterns,
  detectUnknownPrograms,
  classifyIntent,
} from './detectors/index.js';
import {
  simulateTransaction,
  simulationToSignal,
  simulationUnavailableToSignal,
} from './simulation/index.js';
import { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation, SCORING_VERSION } from './risk/scoring.js';
import { explainTransaction } from './ai/explainer.js';

export function runDetectors(
  instructions: import('./types/index.js').ParsedInstruction[],
  addressHistory: string[] = [],
  similarityThreshold = 0.85,
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const recipients = instructions
    .filter((ix) => ix.type === 'transfer' && ix.data)
    .map((ix) => (ix.data as Record<string, string>).to)
    .filter((addr): addr is string => typeof addr === 'string');

  for (const recipient of recipients) {
    const result = detectAddressPoisoning(
      recipient,
      addressHistory,
      similarityThreshold,
    );
    if (result.signal) signals.push(result.signal);
  }

  const nonceResult = detectDurableNonce(instructions);
  if (nonceResult.signal) signals.push(nonceResult.signal);

  const authorityResult = detectAuthorityChanges(instructions);
  signals.push(...authorityResult.signals);

  const writableResult = detectWritablePatterns(instructions);
  signals.push(...writableResult.signals);

  const budgetResult = detectComputeBudgetManipulation(instructions, signals);
  if (budgetResult.signal) signals.push(budgetResult.signal);

  const programResult = detectUnknownPrograms(instructions, signals);
  signals.push(...programResult.signals);

  return signals;
}

export async function analyzeTransaction(
  rawTx: string | Uint8Array,
  config: GuardianConfig,
): Promise<TransactionAnalysis> {
  const connection = config.connection || new Connection(config.rpcUrl, 'confirmed');
  const instructions = await parseTransaction(rawTx, connection);

  const runSimulation = async (): Promise<{ simulation: SimulationResult | null; signal: RiskSignal | null }> => {
    try {
      const simulation = await simulateTransaction(connection, rawTx, {
        timeoutMs: config.simulationTimeoutMs,
      });
      const simSignal = simulationToSignal(simulation);
      return { simulation, signal: simSignal };
    } catch (err) {
      return { simulation: null, signal: simulationUnavailableToSignal(err) };
    }
  };

  const [detectorSignals, simResult] = await Promise.all([
    Promise.resolve(runDetectors(instructions, config.addressHistory, config.similarityThreshold)),
    runSimulation(),
  ]);

  const signals: RiskSignal[] = [...detectorSignals];
  if (simResult.signal) signals.push(simResult.signal);

  const { primaryIntent, anomalies } = classifyIntent(instructions);
  
  if (anomalies && anomalies.length > 0) {
    for (const anomaly of anomalies) {
      signals.push({
        type: SignalType.INTENT_ANOMALY,
        level: anomaly.severity,
        title: 'Unexpected Transaction Intent',
        message: `An unexpected instruction pattern (${anomaly.type}) was found for a ${primaryIntent} transaction.`,
        metadata: { anomaly, primaryIntent },
      });
    }
  }

  const { riskScore, whyScore, scoreVarianceHint } = calculateRiskScore(signals);
  const riskLevel = scoreToRiskLevel(riskScore);
  const recommendation = scoreToRecommendation(riskScore);

  const partialAnalysis: Omit<TransactionAnalysis, 'explanation'> = {
    instructions,
    signals,
    simulation: simResult.simulation,
    riskScore,
    whyScore,
    scoreVarianceHint,
    riskLevel,
    recommendation,
    intent: primaryIntent,
    anomalies,
    timestamp: Date.now(),
    scoringVersion: SCORING_VERSION,
  };

  const explanation = await explainTransaction(partialAnalysis, config.aiProviders);

  return { ...partialAnalysis, explanation };
}

export * from './types/index.js';
export * from './parser/index.js';
export * from './detectors/index.js';
export {
  simulateTransaction,
  simulationToSignal,
  simulationUnavailableToSignal,
} from './simulation/index.js';
export { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation, SCORING_VERSION } from './risk/scoring.js';
export { explainTransaction, buildPrompt, templateExplanation } from './ai/explainer.js';
export {
  OpenAIProvider,
  AnthropicProvider,
  GroqProvider,
  OllamaProvider,
} from './ai/providers.js';
export { analyzeBlinkUrl, detectBlinkUrl, fetchBlinkPayload } from './blink/index.js';

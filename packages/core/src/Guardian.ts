import { Connection } from '@solana/web3.js';
import {
  RiskLevel,
  SignalType,
  type TransactionAnalysis,
  type GuardianConfig,
  type RiskSignal,
  type SimulationResult,
  type ParsedInstruction,
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
  detectSolPhish,
} from './detectors/index.js';
import {
  simulateTransaction,
  simulationToSignal,
  simulationUnavailableToSignal,
} from './simulation/index.js';
import { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation, SCORING_VERSION } from './risk/scoring.js';
import { explainTransaction } from './ai/explainer.js';

export function runDetectors(
  instructions: ParsedInstruction[],
  addressHistory: string[] = [],
  similarityThreshold = 0.85,
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const unresolvedInstructions = instructions.filter((ix) =>
    Array.isArray(ix.data?.parseWarnings) &&
    ix.data.parseWarnings.includes('ADDRESS_LOOKUP_TABLE_UNRESOLVED'),
  );
  if (unresolvedInstructions.length > 0) {
    signals.push({
      type: SignalType.ACCOUNT_METADATA_UNAVAILABLE,
      level: RiskLevel.MEDIUM,
      title: 'Account Metadata Unavailable',
      message:
        'TxGuard could not resolve all address lookup table accounts for this versioned transaction. The analysis is incomplete.',
      metadata: {
        instructionCount: unresolvedInstructions.length,
        unresolvedAccountIndexes: unresolvedInstructions.flatMap((ix) =>
          Array.isArray(ix.data?.unresolvedAccountIndexes) ? ix.data.unresolvedAccountIndexes : [],
        ),
      },
    });
  }

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

  const { anomalies, primaryIntent } = classifyIntent(instructions);
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

  return signals;
}

export async function analyzeTransaction(
  rawTx: string | Uint8Array,
  config: GuardianConfig,
): Promise<TransactionAnalysis> {
  const instructions = await parseTransaction(rawTx, config.connection);

  const runSimulation = async (): Promise<{
    simulation: SimulationResult | null;
    signal: RiskSignal | null;
  }> => {
    try {
      const connection = config.connection instanceof Connection
        ? config.connection
        : config.connection ?? (config.rpcUrl ? new Connection(config.rpcUrl) : null);

      if (!connection) return { simulation: null, signal: null };

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

  const simAwarePhish = detectSolPhish(instructions, simResult.simulation, config.trustedMarketPrograms);
  signals.push(...simAwarePhish.signals);

  const { primaryIntent, anomalies } = classifyIntent(instructions);
  
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

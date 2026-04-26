import { Connection } from '@solana/web3.js';
import type {
  TransactionAnalysis,
  GuardianConfig,
  RiskSignal,
  SimulationResult,
} from './types/index.js';
import { parseTransaction } from './parser/index.js';
import {
  detectAddressPoisoning,
  detectDurableNonce,
  detectAuthorityChanges,
} from './detectors/index.js';
import { simulateTransaction, simulationToSignal } from './simulation/index.js';
import { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation } from './risk/scoring.js';
import { explainTransaction } from './ai/explainer.js';

export async function analyzeTransaction(
  rawTx: string | Uint8Array,
  config: GuardianConfig,
): Promise<TransactionAnalysis> {
  const instructions = parseTransaction(rawTx);
  const signals: RiskSignal[] = [];

  const runDetectors = async (): Promise<RiskSignal[]> => {
    const localSignals: RiskSignal[] = [];
    
    const recipients = instructions
      .filter((ix) => ix.type === 'transfer' && ix.data)
      .map((ix) => (ix.data as Record<string, string>).to)
      .filter((addr): addr is string => typeof addr === 'string');

    for (const recipient of recipients) {
      const result = detectAddressPoisoning(
        recipient,
        config.addressHistory ?? [],
        config.similarityThreshold,
      );
      if (result.signal) localSignals.push(result.signal);
    }

    const nonceResult = detectDurableNonce(instructions);
    if (nonceResult.signal) localSignals.push(nonceResult.signal);

    const authorityResult = detectAuthorityChanges(instructions);
    localSignals.push(...authorityResult.signals);

    return localSignals;
  };

  const runSimulation = async (): Promise<{ simulation: SimulationResult | null; signal: RiskSignal | null }> => {
    const connection = config.connection || new Connection(config.rpcUrl, 'confirmed');
    try {
      const simulation = await simulateTransaction(connection, rawTx);
      const simSignal = simulationToSignal(simulation);
      return { simulation, signal: simSignal };
    } catch {
      return { simulation: null, signal: null };
    }
  };

  const [detectorSignals, simResult] = await Promise.all([
    runDetectors(),
    runSimulation()
  ]);

  signals.push(...detectorSignals);
  if (simResult.signal) signals.push(simResult.signal);

  const riskScore = calculateRiskScore(signals);
  const riskLevel = scoreToRiskLevel(riskScore);
  const recommendation = scoreToRecommendation(riskScore);

  const partialAnalysis: Omit<TransactionAnalysis, 'explanation'> = {
    instructions,
    signals,
    simulation: simResult.simulation,
    riskScore,
    riskLevel,
    recommendation,
    timestamp: Date.now(),
  };

  const explanation = await explainTransaction(partialAnalysis, config.aiProviders);

  return { ...partialAnalysis, explanation };
}

export * from './types/index.js';
export * from './parser/index.js';
export * from './detectors/index.js';
export { simulateTransaction, simulationToSignal } from './simulation/index.js';
export { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation } from './risk/scoring.js';
export { explainTransaction, buildPrompt, templateExplanation } from './ai/explainer.js';
export {
  OpenAIProvider,
  AnthropicProvider,
  GroqProvider,
  OllamaProvider,
} from './ai/providers.js';
export { analyzeBlinkUrl, detectBlinkUrl, fetchBlinkPayload } from './blink/index.js';

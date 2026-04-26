import { RiskLevel, SignalType, type RiskSignal, type ParsedInstruction } from '../types/index.js';
import { isNonceAdvanceInstruction } from '../parser/index.js';

export interface DurableNonceResult {
  detected: boolean;
  signal: RiskSignal | null;
  nonceAccount?: string;
}

export function detectDurableNonce(instructions: ParsedInstruction[]): DurableNonceResult {
  const firstInstruction = instructions[0];
  if (!firstInstruction) return { detected: false, signal: null };

  if (!isNonceAdvanceInstruction(firstInstruction)) {
    return { detected: false, signal: null };
  }

  const nonceAccount = (firstInstruction.data as Record<string, string> | undefined)?.nonceAccount;

  return {
    detected: true,
    nonceAccount,
    signal: {
      type: SignalType.DURABLE_NONCE,
      level: RiskLevel.HIGH,
      title: 'Durable Nonce Transaction',
      message:
        'This transaction uses a durable nonce, meaning it can be submitted at any future time. ' +
        'The signer has no control over when execution occurs once signed.',
      metadata: { nonceAccount },
    },
  };
}

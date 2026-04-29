import type { Connection } from '@solana/web3.js';

export const RiskLevel = {
  SAFE: 'SAFE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const SignalType = {
  ADDRESS_POISONING: 'ADDRESS_POISONING',
  DURABLE_NONCE: 'DURABLE_NONCE',
  AUTHORITY_CHANGE: 'AUTHORITY_CHANGE',
  UNKNOWN_PROGRAM: 'UNKNOWN_PROGRAM',
  BLINK_PHISHING: 'BLINK_PHISHING',
  LARGE_TRANSFER: 'LARGE_TRANSFER',
  SIMULATION_FAILURE: 'SIMULATION_FAILURE',
  TOKEN_APPROVAL: 'TOKEN_APPROVAL',
  CLICKJACKING: 'CLICKJACKING',
  WALLET_SPOOFING: 'WALLET_SPOOFING',
} as const;

export type SignalType = (typeof SignalType)[keyof typeof SignalType];

export interface RiskSignal {
  type: SignalType;
  level: RiskLevel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedInstruction {
  programId: string;
  programName: string;
  type: string;
  accounts: string[];
  data?: Record<string, unknown>;
}

export interface BalanceChange {
  account: string;
  before: number;
  after: number;
  delta: number;
  token?: string;
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  logs: string[];
  balanceChanges: BalanceChange[];
  unitsConsumed: number;
}

export interface TransactionAnalysis {
  instructions: ParsedInstruction[];
  signals: RiskSignal[];
  simulation: SimulationResult | null;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendation: 'APPROVE' | 'CAUTION' | 'REJECT';
  explanation: string;
  timestamp: number;
}

export interface AIProvider {
  name: string;
  explain(analysis: Omit<TransactionAnalysis, 'explanation'>): Promise<string>;
}

export interface GuardianConfig {
  rpcUrl: string;
  connection?: Connection;
  aiProviders: AIProvider[];
  addressHistory?: string[];
  knownContacts?: Map<string, string>;
  similarityThreshold?: number;
}

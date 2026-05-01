import type { Connection } from '@solana/web3.js';

// u64 max value for token amount comparisons. JS cannot represent this exactly as a number.
export const U64_MAX = 18_446_744_073_709_551_615n;

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
  SIMULATION_UNAVAILABLE: 'SIMULATION_UNAVAILABLE',
  TOKEN_APPROVAL: 'TOKEN_APPROVAL',
  TOKEN_REVOCATION: 'TOKEN_REVOCATION',
  TOKEN_ACCOUNT_CLOSURE: 'TOKEN_ACCOUNT_CLOSURE',
  TOKEN_ACCOUNT_FREEZE: 'TOKEN_ACCOUNT_FREEZE',
  CLICKJACKING: 'CLICKJACKING',
  WALLET_SPOOFING: 'WALLET_SPOOFING',
  COMPUTE_BUDGET_MANIPULATION: 'COMPUTE_BUDGET_MANIPULATION',
} as const;

export type SignalType = (typeof SignalType)[keyof typeof SignalType];

export interface RiskSignal {
  type: SignalType;
  level: RiskLevel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AccountMeta {
  address: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface ParsedInstruction {
  programId: string;
  programName: string;
  type: string;
  accounts: string[];
  accountMeta: AccountMeta[];
  data?: Record<string, unknown>;
}

export interface BalanceChange {
  account: string;
  before: number;
  after: number;
  delta: number;
  token?: string;
  mint?: string;
  owner?: string;
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  logs: string[];
  balanceChanges: BalanceChange[];
  unitsConsumed: number;
  slot?: number;
  replaceRecentBlockhash?: boolean;
  cluster?: string;
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
  scoringVersion?: string;
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
  simulationTimeoutMs?: number;
}

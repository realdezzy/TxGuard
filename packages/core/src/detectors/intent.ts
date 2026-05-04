import type { ParsedInstruction } from '../types/index.js';
import { RiskLevel } from '../types/index.js';

export const TransactionIntent = {
  TRANSFER: 'transfer',
  SWAP: 'swap',
  APPROVAL: 'approval',
  REVOCATION: 'revocation',
  NFT_MINT: 'nft_mint',
  ACCOUNT_MANAGEMENT: 'account_management',
  UNKNOWN: 'unknown',
} as const;

export type TransactionIntent = (typeof TransactionIntent)[keyof typeof TransactionIntent];

export interface IntentAnomaly {
  type: 'UNEXPECTED_INSTRUCTION' | 'SUSPICIOUS_AUTHORITY' | 'EXTRA_WRITE';
  severity: RiskLevel;
}

export interface ClassifyIntentResult {
  primaryIntent: TransactionIntent;
  anomalies: IntentAnomaly[];
}

const DEX_PROGRAMS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
]);

const METAPLEX_METADATA = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

const TRANSFER_TYPES = new Set(['transfer', 'transferToken', 'transferChecked']);
const APPROVAL_TYPES = new Set(['approve', 'approveChecked']);
const MANAGEMENT_TYPES = new Set([
  'closeAccount', 'freezeAccount', 'thawAccount',
  'createAccount', 'createAccountWithSeed',
  'createAssociatedTokenAccount', 'createAssociatedTokenAccountIdempotent',
]);

// Instruction types that are scaffolding and don't affect intent classification
const NOISE_TYPES = new Set([
  'setComputeUnitLimit', 'setComputeUnitPrice', 'requestHeapFrame',
  'syncNative',
]);

export function classifyIntent(instructions: ParsedInstruction[]): ClassifyIntentResult {
  const meaningful = instructions.filter((ix) => !NOISE_TYPES.has(ix.type));
  if (meaningful.length === 0) return { primaryIntent: TransactionIntent.UNKNOWN, anomalies: [] };

  const types = new Set(meaningful.map((ix) => ix.type));
  const programIds = new Set(meaningful.map((ix) => ix.programId));

  const hasDex = [...programIds].some((p) => DEX_PROGRAMS.has(p));
  const hasMetaplex = programIds.has(METAPLEX_METADATA);
  const hasApproval = [...types].some((t) => APPROVAL_TYPES.has(t));
  const hasTransfer = [...types].some((t) => TRANSFER_TYPES.has(t));
  const hasMint = types.has('mintTo') || types.has('mintToChecked');
  const hasRevoke = types.has('revoke');
  const hasManagement = [...types].some((t) => MANAGEMENT_TYPES.has(t));

  let primaryIntent: TransactionIntent = TransactionIntent.UNKNOWN;
  const anomalies: IntentAnomaly[] = [];

  // Determine Primary Intent
  if (hasRevoke && meaningful.every((ix) => ix.type === 'revoke' || NOISE_TYPES.has(ix.type))) {
    primaryIntent = TransactionIntent.REVOCATION;
  } else if (hasDex) {
    primaryIntent = TransactionIntent.SWAP;
  } else if (hasApproval && !hasDex) {
    primaryIntent = TransactionIntent.APPROVAL;
  } else if (hasMetaplex && hasMint) {
    primaryIntent = TransactionIntent.NFT_MINT;
  } else if (hasTransfer && !hasManagement && !hasApproval && !hasDex) {
    primaryIntent = TransactionIntent.TRANSFER;
  } else if (hasManagement && !hasTransfer && !hasApproval && !hasDex) {
    primaryIntent = TransactionIntent.ACCOUNT_MANAGEMENT;
  }

  // Detect Anomalies based on Intent
  if (primaryIntent === TransactionIntent.SWAP) {
    if (hasApproval) {
      anomalies.push({ type: 'SUSPICIOUS_AUTHORITY', severity: RiskLevel.HIGH });
    }
  } else if (primaryIntent === TransactionIntent.TRANSFER) {
    if (types.has('setAuthority')) {
      anomalies.push({ type: 'SUSPICIOUS_AUTHORITY', severity: RiskLevel.CRITICAL });
    }
    if (hasManagement) {
      anomalies.push({ type: 'EXTRA_WRITE', severity: RiskLevel.MEDIUM });
    }
  } else if (primaryIntent === TransactionIntent.APPROVAL) {
    if (types.has('closeAccount')) {
      anomalies.push({ type: 'EXTRA_WRITE', severity: RiskLevel.HIGH });
    }
  } else if (primaryIntent === TransactionIntent.NFT_MINT) {
    if (hasApproval) {
      anomalies.push({ type: 'SUSPICIOUS_AUTHORITY', severity: RiskLevel.HIGH });
    }
  }

  return { primaryIntent, anomalies };
}

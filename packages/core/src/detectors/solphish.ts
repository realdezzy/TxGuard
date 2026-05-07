import { RiskLevel, SignalType, type ParsedInstruction, type RiskSignal, type SimulationResult } from '../types/index.js';

export type SolPhishKind = 'STMT' | 'AAT' | 'ISA';

export interface SolPhishResult {
  signals: RiskSignal[];
}

const OFFICIAL_SYSTEM_ACCOUNTS = new Set([
  '11111111111111111111111111111111',
  'ComputeBudget111111111111111111111111111111',
  'NativeLoader1111111111111111111111111111111',
  'BPFLoader1111111111111111111111111111111111',
  'BPFLoaderUpgradeab1e11111111111111111111111',
]);

import { MARKET_PROGRAMS } from '../constants/programs.js';

const TRANSFER_TYPES = new Set(['transfer', 'transferToken', 'transferChecked']);

function isTransfer(ix: ParsedInstruction): boolean {
  return TRANSFER_TYPES.has(ix.type);
}

function isAccountOwnerSetAuthority(ix: ParsedInstruction): boolean {
  return ix.type === 'setAuthority' && ix.data?.authorityType === 2;
}

function transferRecipient(ix: ParsedInstruction): string | undefined {
  if (ix.type === 'transfer') {
    const to = ix.data?.to;
    return typeof to === 'string' ? to : ix.accounts[1];
  }
  if (ix.type === 'transferToken') return ix.accounts[1];
  if (ix.type === 'transferChecked') return ix.accounts[2];
  return undefined;
}

function looksLikeSystemImpersonator(address: string): boolean {
  if (OFFICIAL_SYSTEM_ACCOUNTS.has(address)) return false;
  
  // Mimicking System Program (1111...)
  if (address.startsWith('1111') && address.length >= 32) return true;
  
  // Mimicking Compute Budget or other named system programs
  if (address.startsWith('Compu') || address.startsWith('Config') || address.startsWith('Stake') || address.startsWith('Vote')) {
    return true;
  }
  
  return false;
}

function hasMarketContext(instructions: ParsedInstruction[], simulation: SimulationResult | null | undefined, marketPrograms: Set<string>): boolean {
  if (instructions.some((ix) => marketPrograms.has(ix.programId))) return true;
  const logs = simulation?.logs.join(' ').toLowerCase() ?? '';
  return /\b(buy|sell|purchase)\b/.test(logs);
}

function drainedAssetCount(simulation?: SimulationResult | null): number {
  if (!simulation?.success) return 0;
  return simulation.balanceChanges.filter((change) => {
    if (change.before <= 0) return false;
    if (change.after === 0) return true;
    return change.delta < 0 && Math.abs(change.delta + change.before) < 0.000001;
  }).length;
}

function emitSignal(kind: SolPhishKind, level: RiskLevel, title: string, message: string, metadata: Record<string, unknown>): RiskSignal {
  return {
    type: SignalType.SOLPHISH_PATTERN,
    level,
    title,
    message,
    metadata: { solphishKind: kind, ...metadata },
  };
}

export function detectSolPhish(
  instructions: ParsedInstruction[],
  simulation?: SimulationResult | null,
  trustedMarketPrograms?: string[],
): SolPhishResult {
  const signals: RiskSignal[] = [];
  const effectiveMarketPrograms = trustedMarketPrograms && trustedMarketPrograms.length > 0
    ? new Set(trustedMarketPrograms)
    : MARKET_PROGRAMS;
  const hasMarketContextResult = hasMarketContext(instructions, simulation, effectiveMarketPrograms);
  const marketContext = hasMarketContextResult;
  const transferInstructions = instructions.filter(isTransfer);

  const authorityTransfers = instructions.filter((ix) => ix.type === 'assign' || isAccountOwnerSetAuthority(ix));
  for (const ix of authorityTransfers) {
    const newAuthority = ix.type === 'setAuthority'
      ? ix.accounts[2]
      : ix.data?.owner ?? ix.accounts[1];

    signals.push(emitSignal(
      'AAT',
      RiskLevel.CRITICAL,
      'SolPhish Account Authority Transfer',
      'This transaction transfers account ownership or token-account ownership. This is a known Solana phishing pattern.',
      {
        instructionType: ix.type,
        programId: ix.programId,
        account: ix.accounts[0],
        currentAuthority: ix.accounts[1],
        newAuthority,
        marketContext,
      },
    ));
  }

  const suspiciousRecipients = transferInstructions
    .map((ix) => ({ instructionType: ix.type, recipient: transferRecipient(ix), programId: ix.programId }))
    .filter((item): item is { instructionType: string; recipient: string; programId: string } =>
      typeof item.recipient === 'string' && 
      item.recipient !== simulation?.feePayer &&
      looksLikeSystemImpersonator(item.recipient),
    );

  for (const item of suspiciousRecipients) {
    signals.push(emitSignal(
      'ISA',
      RiskLevel.HIGH,
      'SolPhish System Account Impersonation',
      'This transaction transfers assets to an address that resembles an official Solana system account. Verify the full recipient address.',
      {
        recipient: item.recipient,
        instructionType: item.instructionType,
        programId: item.programId,
        marketContext,
      },
    ));
  }

  if (transferInstructions.length > 2 && !marketContext) {
    const drainedAssets = drainedAssetCount(simulation);
    const hasBalanceEvidence = simulation?.success === true && simulation.balanceChanges.length > 0;
    const level = (drainedAssets >= 2 || transferInstructions.length > 3) ? RiskLevel.HIGH : RiskLevel.LOW;

    signals.push(emitSignal(
      'STMT',
      level,
      drainedAssets >= 2
        ? 'SolPhish Multi-Asset Drain Pattern'
        : 'Multiple Transfers Need Balance Review',
      drainedAssets >= 2
        ? 'This transaction contains multiple transfer instructions and appears to fully drain multiple assets.'
        : 'This transaction contains multiple transfer instructions. Balance evidence is incomplete, so TxGuard is not classifying it as a confirmed drain.',
      {
        transferInstructionCount: transferInstructions.length,
        drainedAssetCount: drainedAssets,
        balanceEvidenceComplete: hasBalanceEvidence,
      },
    ));
  }

  return { signals };
}

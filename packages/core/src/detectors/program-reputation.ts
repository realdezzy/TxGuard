import { RiskLevel, SignalType, type RiskSignal, type ParsedInstruction, type ProgramTrustLevel, type ProgramUpgradeable } from '../types/index.js';

// Static allowlist of known, trusted Solana programs.
// v1: manually curated. v2: user-submitted additions via extension settings.
const TRUSTED_PROGRAMS: ReadonlyMap<string, string> = new Map([
  ['11111111111111111111111111111111', 'System Program'],
  ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'SPL Token'],
  ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', 'Token-2022'],
  ['ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'Associated Token Account'],
  ['ComputeBudget111111111111111111111111111111', 'Compute Budget'],
  ['MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', 'Memo Program'],
  ['Memo1UhkJBfCR961jRFkhY6UXen1PhA5Kpo9dZSEqGKR', 'Memo Program (v1)'],
  ['Stake11111111111111111111111111111111111111', 'Stake Program'],
  ['Vote111111111111111111111111111111111111111', 'Vote Program'],
  ['SysvarRent111111111111111111111111111111111', 'Sysvar Rent'],
  ['SysvarC1ock11111111111111111111111111111111', 'Sysvar Clock'],
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter v6'],
  ['JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', 'Jupiter v4'],
  ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca Whirlpool'],
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium AMM v4'],
  ['CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', 'Raydium CLMM'],
  ['MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', 'Marinade Finance'],
  ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', 'Metaplex Token Metadata'],
  ['9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', 'Serum DEX v3'],
  ['srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 'Serum DEX v4 (OpenBook)'],
  ['LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', 'Meteora DLMM'],
  ['Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', 'Meteora Pools'],
]);

export function isTrustedProgram(programId: string): boolean {
  return TRUSTED_PROGRAMS.has(programId);
}

export function getProgramTrustLevel(
  programId: string,
  context?: { knownPrograms?: Set<string> }
): ProgramTrustLevel {
  if (TRUSTED_PROGRAMS.has(programId)) {
    return 'VERIFIED';
  }
  if (context?.knownPrograms?.has(programId)) {
    return 'KNOWN';
  }
  return 'NEW';
}

export function getTrustedProgramName(programId: string): string | undefined {
  return TRUSTED_PROGRAMS.get(programId);
}

export interface ProgramReputationResult {
  signals: RiskSignal[];
  unknownPrograms: string[];
  programDetails: Array<{
    programId: string;
    trustLevel: ProgramTrustLevel;
    upgradeable: ProgramUpgradeable;
  }>;
}

export function detectUnknownPrograms(
  instructions: ParsedInstruction[],
  existingSignals: RiskSignal[] = [],
  context?: { knownPrograms?: Set<string> }
): ProgramReputationResult {
  const unknownPrograms: string[] = [];
  const programDetails: ProgramReputationResult['programDetails'] = [];
  const seen = new Set<string>();

  for (const ix of instructions) {
    if (seen.has(ix.programId)) continue;
    seen.add(ix.programId);

    const trustLevel = getProgramTrustLevel(ix.programId, context);
    const upgradeable: ProgramUpgradeable = 'unknown'; // Defaults to unknown without on-chain fetch

    programDetails.push({
      programId: ix.programId,
      trustLevel,
      upgradeable,
    });

    if (trustLevel === 'NEW') {
      unknownPrograms.push(ix.programId);
    }
  }

  if (unknownPrograms.length === 0) {
    return { signals: [], unknownPrograms, programDetails };
  }

  const hasAuthorityChange = existingSignals.some(
    (s) => s.type === SignalType.AUTHORITY_CHANGE,
  );
  const hasWritableRisk = existingSignals.some(
    (s) => s.type === SignalType.AUTHORITY_CHANGE && s.metadata?.count,
  );

  let level: RiskLevel;
  if (unknownPrograms.length >= 3 || (unknownPrograms.length >= 1 && hasAuthorityChange)) {
    level = RiskLevel.HIGH;
  } else if (unknownPrograms.length >= 2 || hasWritableRisk) {
    level = RiskLevel.MEDIUM;
  } else {
    level = RiskLevel.LOW; // Baseline risk for NEW programs is now LOW instead of MEDIUM
  }

  const signals: RiskSignal[] = [{
    type: SignalType.UNKNOWN_PROGRAM,
    level,
    title: unknownPrograms.length === 1
      ? 'Unknown Program Interaction'
      : `${unknownPrograms.length} Unknown Program Interactions`,
    message: unknownPrograms.length === 1
      ? `Transaction interacts with unrecognized program ${unknownPrograms[0]!.slice(0, 8)}...${unknownPrograms[0]!.slice(-4)}. Verify this program before signing.`
      : `Transaction interacts with ${unknownPrograms.length} unrecognized programs. Verify all programs before signing.`,
    metadata: {
      programs: unknownPrograms.map((p) => ({
        programId: p,
        truncated: `${p.slice(0, 8)}...${p.slice(-4)}`,
        trustLevel: 'NEW',
      })),
      escalatedByAuthority: hasAuthorityChange,
    },
  }];

  return { signals, unknownPrograms, programDetails };
}

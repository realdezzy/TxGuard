import { RiskLevel, SignalType, type RiskSignal, type ParsedInstruction, type ProgramTrustLevel, type ProgramUpgradeable } from '../types/index.js';

import { TRUSTED_PROGRAMS } from '../constants/programs.js';

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
    level = RiskLevel.MEDIUM;
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

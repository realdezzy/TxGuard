import { RiskLevel, SignalType, type RiskSignal, type ParsedInstruction } from '../types/index.js';

const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];

const SET_AUTHORITY_IX_INDEX = 6;

export interface AuthorityChangeResult {
  signals: RiskSignal[];
}

export function detectAuthorityChanges(instructions: ParsedInstruction[]): AuthorityChangeResult {
  const signals: RiskSignal[] = [];

  for (const ix of instructions) {
    if (!TOKEN_PROGRAMS.includes(ix.programId)) continue;

    const isSetAuthority =
      ix.type === 'setAuthority' ||
      (ix.data && (ix.data as Record<string, unknown>)['instructionIndex'] === SET_AUTHORITY_IX_INDEX);

    if (isSetAuthority) {
      signals.push({
        type: SignalType.AUTHORITY_CHANGE,
        level: RiskLevel.HIGH,
        title: 'Token Authority Change',
        message:
          'This transaction modifies token authority. ' +
          'This could grant a third party mint, freeze, or transfer control over your tokens.',
        metadata: {
          programId: ix.programId,
          accounts: ix.accounts,
        },
      });
    }
  }

  for (const ix of instructions) {
    const programName = ix.programName;
    if (programName === 'Unknown Program') {
      signals.push({
        type: SignalType.UNKNOWN_PROGRAM,
        level: RiskLevel.MEDIUM,
        title: 'Unknown Program Interaction',
        message: `Transaction interacts with unrecognized program ${ix.programId.slice(0, 8)}...${ix.programId.slice(-4)}.`,
        metadata: { programId: ix.programId },
      });
    }
  }

  return { signals };
}

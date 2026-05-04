import { describe, it, expect } from 'vitest';
import { detectUnknownPrograms, isTrustedProgram, getTrustedProgramName } from './program-reputation.js';
import { SignalType, RiskLevel } from '../types/index.js';
import type { ParsedInstruction, RiskSignal } from '../types/index.js';

function makeIx(programId: string, type = 'unknown'): ParsedInstruction {
  return {
    programId,
    programName: 'Test',
    type,
    accounts: [],
    accountMeta: [],
  };
}

describe('isTrustedProgram', () => {
  it('recognizes System Program', () => {
    expect(isTrustedProgram('11111111111111111111111111111111')).toBe(true);
  });

  it('recognizes Jupiter v6', () => {
    expect(isTrustedProgram('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')).toBe(true);
  });

  it('rejects unknown programs', () => {
    expect(isTrustedProgram('RandomUnknownProgram111111111111')).toBe(false);
  });
});

describe('getTrustedProgramName', () => {
  it('returns name for known program', () => {
    expect(getTrustedProgramName('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe('SPL Token');
  });

  it('returns undefined for unknown', () => {
    expect(getTrustedProgramName('RandomUnknownProgram111111111111')).toBeUndefined();
  });
});

describe('detectUnknownPrograms', () => {
  it('produces no signals when all programs are trusted', () => {
    const instructions = [
      makeIx('11111111111111111111111111111111', 'transfer'),
      makeIx('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'approve'),
      makeIx('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'route'),
    ];
    const result = detectUnknownPrograms(instructions);
    expect(result.signals).toHaveLength(0);
    expect(result.unknownPrograms).toHaveLength(0);
  });

  it('detects a single unknown program as MEDIUM', () => {
    const unknown = 'UnknownProgramXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const instructions = [
      makeIx('11111111111111111111111111111111', 'transfer'),
      makeIx(unknown, 'unknown'),
    ];
    const result = detectUnknownPrograms(instructions);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]!.type).toBe(SignalType.UNKNOWN_PROGRAM);
    expect(result.signals[0]!.level).toBe(RiskLevel.LOW);
    expect(result.unknownPrograms).toEqual([unknown]);
  });

  it('escalates to HIGH when 3+ unknown programs', () => {
    const instructions = [
      makeIx('Unknown1111111111111111111111111111111111111'),
      makeIx('Unknown2222222222222222222222222222222222222'),
      makeIx('Unknown3333333333333333333333333333333333333'),
    ];
    const result = detectUnknownPrograms(instructions);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]!.level).toBe(RiskLevel.HIGH);
  });

  it('escalates to HIGH when unknown program co-occurs with authority change signal', () => {
    const instructions = [
      makeIx('Unknown1111111111111111111111111111111111111'),
    ];
    const existingSignals: RiskSignal[] = [{
      type: SignalType.AUTHORITY_CHANGE,
      level: RiskLevel.HIGH,
      title: 'Test',
      message: 'Test authority change',
    }];
    const result = detectUnknownPrograms(instructions, existingSignals);
    expect(result.signals[0]!.level).toBe(RiskLevel.HIGH);
  });

  it('deduplicates repeated program IDs', () => {
    const unknownId = 'Unknown1111111111111111111111111111111111111';
    const instructions = [
      makeIx(unknownId),
      makeIx(unknownId),
      makeIx(unknownId),
    ];
    const result = detectUnknownPrograms(instructions);
    expect(result.unknownPrograms).toHaveLength(1);
    expect(result.signals).toHaveLength(1);
  });
});

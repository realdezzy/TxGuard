import { describe, expect, it } from 'vitest';
import { SignalType, RiskLevel } from '../types/index.js';
import { detectWritablePatterns } from './writable-pattern.js';
import type { ParsedInstruction } from '../types/index.js';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function makeIx(overrides: Partial<ParsedInstruction>): ParsedInstruction {
  return {
    programId: TOKEN_PROGRAM,
    programName: 'Token Program',
    type: 'transferToken',
    accounts: [],
    accountMeta: [],
    ...overrides,
  };
}

describe('detectWritablePatterns', () => {
  it('returns no signal for a benign swap with signer-controlled writable accounts', () => {
    const signer = 'SIGNER_ADDR';
    const ix = makeIx({
      type: 'transferToken',
      accounts: [signer, 'dest1'],
      accountMeta: [
        { address: signer, isSigner: true, isWritable: true },
        { address: 'dest1', isSigner: false, isWritable: true },
      ],
      data: { owner: signer },
    });
    const { signals } = detectWritablePatterns([ix]);
    expect(signals).toHaveLength(0);
  });

  it('returns no signal when fewer than 3 third-party writable accounts exist', () => {
    const signer = 'SIGNER_ADDR';
    const ix = makeIx({
      accounts: [signer, 'third1', 'third2'],
      accountMeta: [
        { address: signer, isSigner: true, isWritable: true },
        { address: 'third1', isSigner: false, isWritable: true },
        { address: 'third2', isSigner: false, isWritable: true },
      ],
    });
    const { signals } = detectWritablePatterns([ix]);
    expect(signals).toHaveLength(0);
  });

  it('emits AUTHORITY_CHANGE HIGH when 3+ third-party writable token accounts are present', () => {
    const signer = 'SIGNER_ADDR';
    const instructions: ParsedInstruction[] = [
      makeIx({
        accounts: [signer, 'victim1', 'victim2'],
        accountMeta: [
          { address: signer, isSigner: true, isWritable: true },
          { address: 'victim1', isSigner: false, isWritable: true },
          { address: 'victim2', isSigner: false, isWritable: true },
        ],
      }),
      makeIx({
        accounts: ['victim3'],
        accountMeta: [
          { address: 'victim3', isSigner: false, isWritable: true },
        ],
      }),
    ];
    const { signals } = detectWritablePatterns(instructions);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      type: SignalType.AUTHORITY_CHANGE,
      level: RiskLevel.HIGH,
    });
    expect(signals[0]!.metadata?.count).toBe(3);
  });

  it('excludes writable accounts whose owner is the signer', () => {
    const signer = 'SIGNER_ADDR';
    const instructions: ParsedInstruction[] = [
      makeIx({
        accounts: [signer, 'acct1', 'acct2', 'acct3'],
        accountMeta: [
          { address: signer, isSigner: true, isWritable: true },
          { address: 'acct1', isSigner: false, isWritable: true },
          { address: 'acct2', isSigner: false, isWritable: true },
          { address: 'acct3', isSigner: false, isWritable: true },
        ],
        data: { owner: signer },
      }),
    ];
    const { signals } = detectWritablePatterns(instructions);
    expect(signals).toHaveLength(0);
  });
});

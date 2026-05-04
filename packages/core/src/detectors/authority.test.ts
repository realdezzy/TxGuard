import { describe, expect, it } from 'vitest';
import { SignalType, RiskLevel, U64_MAX } from '../types/index.js';
import { detectAuthorityChanges } from './authority.js';
import type { ParsedInstruction } from '../types/index.js';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function makeIx(overrides: Partial<ParsedInstruction>): ParsedInstruction {
  return {
    programId: TOKEN_PROGRAM,
    programName: 'Token Program',
    type: 'unknown',
    accounts: ['acct1', 'acct2', 'acct3', 'acct4'],
    accountMeta: [
      { address: 'acct1', isSigner: false, isWritable: true },
      { address: 'acct2', isSigner: true, isWritable: true },
      { address: 'acct3', isSigner: true, isWritable: false },
      { address: 'acct4', isSigner: false, isWritable: false },
    ],
    ...overrides,
  };
}

describe('detectAuthorityChanges', () => {
  describe('approve', () => {
    it('emits TOKEN_APPROVAL HIGH for normal amount', () => {
      const ix = makeIx({ type: 'approve', data: { instructionIndex: 4, amount: 500_000n } });
      const { signals } = detectAuthorityChanges([ix]);
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: SignalType.TOKEN_APPROVAL, level: RiskLevel.HIGH }),
        ]),
      );
    });

    it('emits TOKEN_APPROVAL CRITICAL for U64_MAX (unlimited) amount', () => {
      const ix = makeIx({ type: 'approve', data: { instructionIndex: 4, amount: U64_MAX } });
      const { signals } = detectAuthorityChanges([ix]);
      const approval = signals.find((s) => s.type === SignalType.TOKEN_APPROVAL);
      expect(approval?.level).toBe(RiskLevel.CRITICAL);
      expect(approval?.metadata?.unlimited).toBe(true);
    });

    it('emits TOKEN_APPROVAL CRITICAL when amount is undefined', () => {
      const ix = makeIx({ type: 'approve', data: { instructionIndex: 4, amount: undefined } });
      const { signals } = detectAuthorityChanges([ix]);
      const approval = signals.find((s) => s.type === SignalType.TOKEN_APPROVAL);
      expect(approval?.level).toBe(RiskLevel.CRITICAL);
    });
  });

  describe('approveChecked', () => {
    it('emits TOKEN_APPROVAL for approveChecked with normal amount', () => {
      const ix = makeIx({ type: 'approveChecked', data: { instructionIndex: 13, amount: 1000n, decimals: 6 } });
      const { signals } = detectAuthorityChanges([ix]);
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: SignalType.TOKEN_APPROVAL }),
        ]),
      );
    });
  });

  describe('revoke', () => {
    it('emits TOKEN_REVOCATION LOW', () => {
      const ix = makeIx({ type: 'revoke', data: { instructionIndex: 5 } });
      const { signals } = detectAuthorityChanges([ix]);
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: SignalType.TOKEN_REVOCATION, level: RiskLevel.LOW }),
        ]),
      );
    });
  });

  describe('closeAccount', () => {
    it('emits TOKEN_ACCOUNT_CLOSURE LOW when destination is signer-controlled', () => {
      // accounts[1] is the destination; accounts[2] is the owner
      // make destination === owner → signer-controlled
      const ix = makeIx({
        type: 'closeAccount',
        accounts: ['acct1', 'acct3', 'acct3'],
        accountMeta: [
          { address: 'acct1', isSigner: false, isWritable: true },
          { address: 'acct3', isSigner: true, isWritable: false },
          { address: 'acct3', isSigner: true, isWritable: false },
        ],
        data: { instructionIndex: 9 },
      });
      const { signals } = detectAuthorityChanges([ix]);
      const closure = signals.find((s) => s.type === SignalType.TOKEN_ACCOUNT_CLOSURE);
      expect(closure?.level).toBe(RiskLevel.LOW);
    });

    it('emits TOKEN_ACCOUNT_CLOSURE HIGH when destination is not signer-controlled', () => {
      // destination (acct2) is not a signer and is different from owner (acct3)
      const ix = makeIx({
        type: 'closeAccount',
        accounts: ['acct1', 'acct2', 'acct3'],
        accountMeta: [
          { address: 'acct1', isSigner: false, isWritable: true },
          { address: 'acct2', isSigner: false, isWritable: false },
          { address: 'acct3', isSigner: true, isWritable: false },
        ],
        data: { instructionIndex: 9 },
      });
      const { signals } = detectAuthorityChanges([ix]);
      const closure = signals.find((s) => s.type === SignalType.TOKEN_ACCOUNT_CLOSURE);
      expect(closure?.level).toBe(RiskLevel.HIGH);
    });
  });

  describe('setAuthority', () => {
    it('emits AUTHORITY_CHANGE CRITICAL for MintTokens (type 0)', () => {
      const ix = makeIx({ type: 'setAuthority', data: { instructionIndex: 6, authorityType: 0, hasNewAuthority: 1 } });
      const { signals } = detectAuthorityChanges([ix]);
      const sig = signals.find((s) => s.type === SignalType.AUTHORITY_CHANGE);
      expect(sig?.level).toBe(RiskLevel.CRITICAL);
      expect(sig?.metadata?.authorityTypeName).toBe('MintTokens');
    });

    it('emits AUTHORITY_CHANGE HIGH for FreezeAccount (type 1)', () => {
      const ix = makeIx({ type: 'setAuthority', data: { instructionIndex: 6, authorityType: 1, hasNewAuthority: 1 } });
      const { signals } = detectAuthorityChanges([ix]);
      const sig = signals.find((s) => s.type === SignalType.AUTHORITY_CHANGE);
      expect(sig?.level).toBe(RiskLevel.HIGH);
      expect(sig?.metadata?.authorityTypeName).toBe('FreezeAccount');
    });

    it('emits AUTHORITY_CHANGE CRITICAL for AccountOwner (type 2)', () => {
      const ix = makeIx({ type: 'setAuthority', data: { instructionIndex: 6, authorityType: 2, hasNewAuthority: 1 } });
      const { signals } = detectAuthorityChanges([ix]);
      const sig = signals.find((s) => s.type === SignalType.AUTHORITY_CHANGE);
      expect(sig?.level).toBe(RiskLevel.CRITICAL);
      expect(sig?.metadata?.authorityTypeName).toBe('AccountOwner');
    });

    it('emits AUTHORITY_CHANGE HIGH for CloseAccount (type 3)', () => {
      const ix = makeIx({ type: 'setAuthority', data: { instructionIndex: 6, authorityType: 3, hasNewAuthority: 1 } });
      const { signals } = detectAuthorityChanges([ix]);
      const sig = signals.find((s) => s.type === SignalType.AUTHORITY_CHANGE);
      expect(sig?.level).toBe(RiskLevel.HIGH);
      expect(sig?.metadata?.authorityTypeName).toBe('CloseAccount');
    });
  });

  describe('freezeAccount', () => {
    it('emits TOKEN_ACCOUNT_FREEZE HIGH', () => {
      const ix = makeIx({ type: 'freezeAccount', data: { instructionIndex: 10 } });
      const { signals } = detectAuthorityChanges([ix]);
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: SignalType.TOKEN_ACCOUNT_FREEZE, level: RiskLevel.HIGH }),
        ]),
      );
    });
  });

  describe('unknown program', () => {
    it('does not emit UNKNOWN_PROGRAM (moved to program-reputation detector)', () => {
      const ix = makeIx({ programId: 'SomeRand0mProgramXXXXXXXXXXXXXXXXXXXXXXXXXX', programName: 'Unknown Program', type: 'unknown' });
      const { signals } = detectAuthorityChanges([ix]);
      expect(signals.filter((s) => s.type === SignalType.UNKNOWN_PROGRAM)).toHaveLength(0);
    });
  });

  describe('benign', () => {
    it('emits no signals for an unrecognised non-token program in the known-program list', () => {
      const ix: ParsedInstruction = {
        programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
        programName: 'Jupiter v6',
        type: 'unknown',
        accounts: [],
        accountMeta: [],
      };
      const { signals } = detectAuthorityChanges([ix]);
      expect(signals).toHaveLength(0);
    });
  });
});

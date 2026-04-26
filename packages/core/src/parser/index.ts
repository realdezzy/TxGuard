import {
  VersionedTransaction,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import type { ParsedInstruction } from '../types/index.js';

const KNOWN_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'Token Program',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account',
  ComputeBudget111111111111111111111111111111: 'Compute Budget',
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: 'Memo Program',
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin': 'Serum DEX',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpool',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter v6',
};

function identifyProgram(programId: string): string {
  return KNOWN_PROGRAMS[programId] ?? 'Unknown Program';
}

function parseSystemInstruction(
  programId: string,
  accounts: string[],
  _data: Buffer,
): Partial<ParsedInstruction> {
  if (programId !== SystemProgram.programId.toBase58()) return {};

  const instructionIndex = _data.length > 0 ? _data.readUInt32LE(0) : -1;

  switch (instructionIndex) {
    case 2:
      return {
        type: 'transfer',
        data: {
          from: accounts[0],
          to: accounts[1],
          lamports: _data.length >= 12 ? Number(_data.readBigUInt64LE(4)) : 0,
        },
      };
    case 4:
      return { type: 'createAccount' };
    case 6:
      return { type: 'createAccountWithSeed' };
    case 12:
      return { type: 'transferWithSeed' };
    case 4: // nonceAdvance
      if (accounts.length >= 3) {
        return {
          type: 'nonceAdvance',
          data: { nonceAccount: accounts[0], nonceAuthority: accounts[2] },
        };
      }
      return { type: 'nonceAdvance' };
    default:
      return { type: `systemInstruction(${instructionIndex})` };
  }
}

export function parseTransaction(raw: string | Uint8Array): ParsedInstruction[] {
  const bytes = typeof raw === 'string' ? Buffer.from(raw, 'base64') : raw;

  let instructions: { programId: PublicKey; keys: { pubkey: PublicKey }[]; data: Buffer }[];

  try {
    const versioned = VersionedTransaction.deserialize(bytes);
    const message = versioned.message;
    const accountKeys = message.staticAccountKeys;

    instructions = message.compiledInstructions.map((ix) => ({
      programId: accountKeys[ix.programIdIndex]!,
      keys: ix.accountKeyIndexes.map((idx) => ({ pubkey: accountKeys[idx]! })),
      data: Buffer.from(ix.data),
    }));
  } catch {
    const legacy = Transaction.from(bytes);
    instructions = legacy.instructions.map((ix) => ({
      programId: ix.programId,
      keys: ix.keys.map((k) => ({ pubkey: k.pubkey })),
      data: ix.data,
    }));
  }

  return instructions.map((ix) => {
    const programId = ix.programId.toBase58();
    const accounts = ix.keys.map((k) => k.pubkey.toBase58());
    const systemParsed = parseSystemInstruction(programId, accounts, ix.data);

    return {
      programId,
      programName: identifyProgram(programId),
      type: systemParsed.type ?? 'unknown',
      accounts,
      data: systemParsed.data as Record<string, unknown> | undefined,
    };
  });
}

export function isNonceAdvanceInstruction(ix: ParsedInstruction): boolean {
  return (
    ix.programId === SystemProgram.programId.toBase58() && ix.type === 'nonceAdvance'
  );
}

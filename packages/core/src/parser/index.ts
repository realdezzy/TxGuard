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

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function readUInt32LE(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

function readBigUInt64LE(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
}

function parseSystemInstruction(
  programId: string,
  accounts: string[],
  data: Uint8Array,
): Partial<ParsedInstruction> {
  if (programId !== SystemProgram.programId.toBase58()) return {};

  const instructionIndex = data.length >= 4 ? readUInt32LE(data, 0) : -1;

  switch (instructionIndex) {
    case 2:
      return {
        type: 'transfer',
        data: {
          from: accounts[0],
          to: accounts[1],
          lamports: data.length >= 12 ? Number(readBigUInt64LE(data, 4)) : 0,
        },
      };
    case 0:
      return { type: 'createAccount' };
    case 3:
      return { type: 'createAccountWithSeed' };
    case 11:
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

function parseTokenInstruction(programId: string, data: Uint8Array): Partial<ParsedInstruction> {
  if (!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(programId)) {
    return {};
  }

  const instructionIndex = data[0];

  switch (instructionIndex) {
    case 4:
      return {
        type: 'approve',
        data: {
          instructionIndex,
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
        },
      };
    case 6:
      return { type: 'setAuthority', data: { instructionIndex } };
    case 7:
      return {
        type: 'mintTo',
        data: {
          instructionIndex,
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
        },
      };
    case 8:
      return {
        type: 'burn',
        data: {
          instructionIndex,
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
        },
      };
    case 9:
      return { type: 'closeAccount', data: { instructionIndex } };
    default:
      return { type: `tokenInstruction(${instructionIndex})`, data: { instructionIndex } };
  }
}

export function parseTransaction(raw: string | Uint8Array): ParsedInstruction[] {
  const bytes = typeof raw === 'string' ? decodeBase64(raw) : raw;

  let instructions: { programId: PublicKey; keys: { pubkey: PublicKey }[]; data: Uint8Array }[];

  try {
    const versioned = VersionedTransaction.deserialize(bytes);
    const message = versioned.message;
    const accountKeys = message.staticAccountKeys;

    instructions = message.compiledInstructions.map((ix) => ({
      programId: accountKeys[ix.programIdIndex]!,
      keys: ix.accountKeyIndexes.map((idx) => ({ pubkey: accountKeys[idx]! })),
      data: ix.data,
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
    const tokenParsed = parseTokenInstruction(programId, ix.data);

    return {
      programId,
      programName: identifyProgram(programId),
      type: systemParsed.type ?? tokenParsed.type ?? 'unknown',
      accounts,
      data: (systemParsed.data ?? tokenParsed.data) as Record<string, unknown> | undefined,
    };
  });
}

export function isNonceAdvanceInstruction(ix: ParsedInstruction): boolean {
  return (
    ix.programId === SystemProgram.programId.toBase58() && ix.type === 'nonceAdvance'
  );
}

import {
  VersionedTransaction,
  PublicKey,
  SystemProgram,
  Transaction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import type { ParsedInstruction, AccountMeta } from '../types/index.js';

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

const ATA_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111';

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
    case 0:
      return {
        type: 'createAccount',
        data: {
          from: accounts[0],
          newAccount: accounts[1],
          lamports: data.length >= 12 ? Number(readBigUInt64LE(data, 4)) : 0,
        },
      };
    case 1:
      return {
        type: 'assign',
        data: { account: accounts[0] },
      };
    case 2:
      return {
        type: 'transfer',
        data: {
          from: accounts[0],
          to: accounts[1],
          lamports: data.length >= 12 ? Number(readBigUInt64LE(data, 4)) : 0,
        },
      };
    case 3:
      return { type: 'createAccountWithSeed' };
    case 4:
      if (accounts.length >= 3) {
        return {
          type: 'nonceAdvance',
          data: { nonceAccount: accounts[0], nonceAuthority: accounts[2] },
        };
      }
      return { type: 'nonceAdvance' };
    case 5:
      return {
        type: 'nonceWithdraw',
        data: {
          nonceAccount: accounts[0],
          destination: accounts[1],
          nonceAuthority: accounts.length >= 5 ? accounts[4] : undefined,
          lamports: data.length >= 12 ? Number(readBigUInt64LE(data, 4)) : 0,
        },
      };
    case 6:
      return {
        type: 'nonceInitialize',
        data: {
          nonceAccount: accounts[0],
          nonceAuthority: accounts.length >= 3 ? accounts[2] : undefined,
        },
      };
    case 7:
      return {
        type: 'nonceAuthorize',
        data: { nonceAccount: accounts[0] },
      };
    case 8:
      return {
        type: 'allocate',
        data: { account: accounts[0] },
      };
    case 9:
      return { type: 'allocateWithSeed' };
    case 10:
      return {
        type: 'assignWithSeed',
        data: { account: accounts[0] },
      };
    case 11:
      return { type: 'transferWithSeed' };
    case 12:
      return {
        type: 'upgradeNonceAccount',
        data: { nonceAccount: accounts[0] },
      };
    default:
      return { type: `systemInstruction(${instructionIndex})` };
  }
}

function parseTokenInstruction(
  programId: string,
  accounts: string[],
  data: Uint8Array,
): Partial<ParsedInstruction> {
  if (!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(programId)) {
    return {};
  }

  const instructionIndex = data[0];

  switch (instructionIndex) {
    case 3:
      return {
        type: 'transferToken',
        data: {
          instructionIndex,
          source: accounts[0],
          destination: accounts[1],
          owner: accounts[2],
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
        },
      };
    case 4:
      return {
        type: 'approve',
        data: {
          instructionIndex,
          source: accounts[0],
          delegate: accounts[1],
          owner: accounts[2],
          amount: data.length >= 9 ? readBigUInt64LE(data, 1) : undefined,
        },
      };
    case 5:
      return {
        type: 'revoke',
        data: {
          instructionIndex,
          source: accounts[0],
          owner: accounts[1],
        },
      };
    case 6:
      return {
        type: 'setAuthority',
        data: {
          instructionIndex,
          account: accounts[0],
          currentAuthority: accounts[1],
          authorityType: data[1],
          hasNewAuthority: data[2],
        },
      };
    case 7:
      return {
        type: 'mintTo',
        data: {
          instructionIndex,
          mint: accounts[0],
          destination: accounts[1],
          authority: accounts[2],
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
        },
      };
    case 8:
      return {
        type: 'burn',
        data: {
          instructionIndex,
          source: accounts[0],
          mint: accounts[1],
          owner: accounts[2],
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
        },
      };
    case 9:
      return {
        type: 'closeAccount',
        data: {
          instructionIndex,
          account: accounts[0],
          destination: accounts[1],
          owner: accounts[2],
        },
      };
    case 10:
      return {
        type: 'freezeAccount',
        data: {
          instructionIndex,
          account: accounts[0],
          mint: accounts[1],
          authority: accounts[2],
        },
      };
    case 11:
      return {
        type: 'thawAccount',
        data: {
          instructionIndex,
          account: accounts[0],
          mint: accounts[1],
          authority: accounts[2],
        },
      };
    case 12:
      return {
        type: 'transferChecked',
        data: {
          instructionIndex,
          source: accounts[0],
          mint: accounts[1],
          destination: accounts[2],
          owner: accounts[3],
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
          decimals: data[9],
        },
      };
    case 13:
      return {
        type: 'approveChecked',
        data: {
          instructionIndex,
          source: accounts[0],
          mint: accounts[1],
          delegate: accounts[2],
          owner: accounts[3],
          amount: data.length >= 9 ? readBigUInt64LE(data, 1) : undefined,
          decimals: data[9],
        },
      };
    case 14:
      return {
        type: 'mintToChecked',
        data: {
          instructionIndex,
          mint: accounts[0],
          destination: accounts[1],
          authority: accounts[2],
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
          decimals: data[9],
        },
      };
    case 15:
      return {
        type: 'burnChecked',
        data: {
          instructionIndex,
          source: accounts[0],
          mint: accounts[1],
          owner: accounts[2],
          amount: data.length >= 9 ? Number(readBigUInt64LE(data, 1)) : undefined,
          decimals: data[9],
        },
      };
    case 17:
      return { type: 'syncNative', data: { instructionIndex, account: accounts[0] } };
    default:
      return { type: `tokenInstruction(${instructionIndex})`, data: { instructionIndex } };
  }
}

function parseAtaInstruction(programId: string, accounts: string[], data: Uint8Array): Partial<ParsedInstruction> {
  if (programId !== ATA_PROGRAM_ID) return {};

  if (data.length === 0 || data[0] === 0) {
    return {
      type: 'createAssociatedTokenAccount',
      data: {
        payer: accounts[0],
        associatedToken: accounts[1],
        wallet: accounts[2],
        mint: accounts[3],
      },
    };
  }
  if (data[0] === 1) {
    return {
      type: 'createAssociatedTokenAccountIdempotent',
      data: {
        payer: accounts[0],
        associatedToken: accounts[1],
        wallet: accounts[2],
        mint: accounts[3],
      },
    };
  }
  if (data[0] === 2) {
    return {
      type: 'recoverNestedAssociatedTokenAccount',
      data: {
        nestedAccount: accounts[0],
        nestedMint: accounts[1],
        destinationAccount: accounts[2],
        ownerMint: accounts[3],
        ownerAccount: accounts[4],
        wallet: accounts[5],
      },
    };
  }
  return { type: `ataInstruction(${data[0]})` };
}

function parseComputeBudgetInstruction(programId: string, data: Uint8Array): Partial<ParsedInstruction> {
  if (programId !== COMPUTE_BUDGET_PROGRAM_ID) return {};

  const discriminant = data.length >= 4 ? readUInt32LE(data, 0) : -1;

  switch (discriminant) {
    case 0x00:
      return {
        type: 'requestHeapFrame',
        data: { bytes: data.length >= 8 ? readUInt32LE(data, 4) : undefined },
      };
    case 0x02:
      return {
        type: 'setComputeUnitLimit',
        data: { units: data.length >= 8 ? readUInt32LE(data, 4) : undefined },
      };
    case 0x03:
      return {
        type: 'setComputeUnitPrice',
        data: { microLamports: data.length >= 12 ? Number(readBigUInt64LE(data, 4)) : undefined },
      };
    default:
      return { type: `computeBudgetInstruction(${discriminant})` };
  }
}

interface RawInstruction {
  programId: PublicKey;
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  data: Uint8Array;
}

async function resolveVersionedTransaction(
  bytes: Uint8Array,
  connection?: Connection,
): Promise<RawInstruction[]> {
  const versioned = VersionedTransaction.deserialize(bytes);
  const message = versioned.message;

  let allKeys = [...message.staticAccountKeys];

  if (message.addressTableLookups.length > 0 && connection) {
    for (const lookup of message.addressTableLookups) {
      try {
        const result = await connection.getAddressLookupTable(lookup.accountKey);
        const table = result.value;
        if (table instanceof AddressLookupTableAccount) {
          const writables = lookup.writableIndexes.map((i) => table.state.addresses[i]).filter((a): a is PublicKey => a != null);
          const readonlys = lookup.readonlyIndexes.map((i) => table.state.addresses[i]).filter((a): a is PublicKey => a != null);
          allKeys = [...allKeys, ...writables, ...readonlys];
        }
      } catch {
        // Gracefully degrade: ALT unavailable, accounts will appear as unknown pubkeys
      }
    }
  }

  const numSigners = message.header.numRequiredSignatures;
  const numReadonlySigners = message.header.numReadonlySignedAccounts;
  const numReadonlyUnsigned = message.header.numReadonlyUnsignedAccounts;
  const numWritableUnsigned = allKeys.length - numSigners - numReadonlyUnsigned;

  return message.compiledInstructions.map((ix) => ({
    programId: allKeys[ix.programIdIndex]!,
    keys: ix.accountKeyIndexes.map((idx) => {
      const pubkey = allKeys[idx]!;
      const isSigner = idx < numSigners;
      // Writable: signer accounts that are not readonly-signed, or unsigned writable accounts
      const isWritableSigner = idx < numSigners - numReadonlySigners;
      const isWritableUnsigned = idx >= numSigners && idx < numSigners + numWritableUnsigned;
      return { pubkey, isSigner, isWritable: isWritableSigner || isWritableUnsigned };
    }),
    data: ix.data,
  }));
}

function resolveLegacyTransaction(bytes: Uint8Array): RawInstruction[] {
  const legacy = Transaction.from(bytes);
  return legacy.instructions.map((ix) => ({
    programId: ix.programId,
    keys: ix.keys.map((k) => ({
      pubkey: k.pubkey,
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: ix.data,
  }));
}

export async function parseTransaction(
  raw: string | Uint8Array,
  connection?: Connection,
): Promise<ParsedInstruction[]> {
  const bytes = typeof raw === 'string' ? decodeBase64(raw) : raw;

  let instructions: RawInstruction[];

  try {
    instructions = await resolveVersionedTransaction(bytes, connection);
  } catch {
    try {
      instructions = resolveLegacyTransaction(bytes);
    } catch (err) {
      throw new Error(`Failed to deserialize transaction: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return instructions.map((ix) => {
    const programId = ix.programId.toBase58();
    const accounts = ix.keys.map((k) => k.pubkey.toBase58());
    const accountMeta: AccountMeta[] = ix.keys.map((k) => ({
      address: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    }));

    const systemParsed = parseSystemInstruction(programId, accounts, ix.data);
    const tokenParsed = parseTokenInstruction(programId, accounts, ix.data);
    const ataParsed = parseAtaInstruction(programId, accounts, ix.data);
    const computeParsed = parseComputeBudgetInstruction(programId, ix.data);

    const type =
      systemParsed.type ??
      tokenParsed.type ??
      ataParsed.type ??
      computeParsed.type ??
      'unknown';

    const data =
      systemParsed.data ??
      tokenParsed.data ??
      ataParsed.data ??
      computeParsed.data;

    return {
      programId,
      programName: identifyProgram(programId),
      type,
      accounts,
      accountMeta,
      data: data as Record<string, unknown> | undefined,
    };
  });
}

export function isNonceAdvanceInstruction(ix: ParsedInstruction): boolean {
  return (
    ix.programId === SystemProgram.programId.toBase58() && ix.type === 'nonceAdvance'
  );
}

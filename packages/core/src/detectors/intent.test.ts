import { describe, it, expect } from 'vitest';
import { classifyIntent, TransactionIntent } from './intent.js';
import type { ParsedInstruction } from '../types/index.js';

function ix(programId: string, type: string): ParsedInstruction {
  return {
    programId,
    programName: 'Test',
    type,
    accounts: [],
    accountMeta: [],
  };
}

const SYSTEM = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const COMPUTE = 'ComputeBudget111111111111111111111111111111';
const METAPLEX = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

describe('classifyIntent', () => {
  it('classifies SOL transfer', () => {
    expect(classifyIntent([ix(SYSTEM, 'transfer')]).primaryIntent).toBe(TransactionIntent.TRANSFER);
  });

  it('classifies SPL transferChecked', () => {
    expect(classifyIntent([ix(TOKEN, 'transferChecked')]).primaryIntent).toBe(TransactionIntent.TRANSFER);
  });

  it('classifies transfer with compute budget as transfer (noise filtered)', () => {
    expect(classifyIntent([
      ix(COMPUTE, 'setComputeUnitPrice'),
      ix(SYSTEM, 'transfer'),
    ]).primaryIntent).toBe(TransactionIntent.TRANSFER);
  });

  it('classifies Jupiter swap', () => {
    expect(classifyIntent([
      ix(COMPUTE, 'setComputeUnitLimit'),
      ix(JUPITER, 'route'),
      ix(TOKEN, 'transferChecked'),
    ]).primaryIntent).toBe(TransactionIntent.SWAP);
  });

  it('classifies approve as approval', () => {
    expect(classifyIntent([ix(TOKEN, 'approve')]).primaryIntent).toBe(TransactionIntent.APPROVAL);
  });

  it('classifies approveChecked as approval', () => {
    expect(classifyIntent([ix(TOKEN, 'approveChecked')]).primaryIntent).toBe(TransactionIntent.APPROVAL);
  });

  it('classifies revoke-only as revocation', () => {
    expect(classifyIntent([ix(TOKEN, 'revoke')]).primaryIntent).toBe(TransactionIntent.REVOCATION);
  });

  it('classifies NFT mint with Metaplex', () => {
    expect(classifyIntent([
      ix(TOKEN, 'mintTo'),
      ix(METAPLEX, 'createMetadata'),
    ]).primaryIntent).toBe(TransactionIntent.NFT_MINT);
  });

  it('classifies account management (closeAccount only)', () => {
    expect(classifyIntent([ix(TOKEN, 'closeAccount')]).primaryIntent).toBe(TransactionIntent.ACCOUNT_MANAGEMENT);
  });

  it('classifies createAssociatedTokenAccount as management', () => {
    const ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
    expect(classifyIntent([ix(ATA, 'createAssociatedTokenAccount')]).primaryIntent).toBe(TransactionIntent.ACCOUNT_MANAGEMENT);
  });

  it('returns unknown for empty instructions', () => {
    expect(classifyIntent([]).primaryIntent).toBe(TransactionIntent.UNKNOWN);
  });

  it('returns unknown for unrecognized instruction mix', () => {
    const unknown = 'RandomProgram111111111111111111111111111111';
    expect(classifyIntent([ix(unknown, 'doSomething')]).primaryIntent).toBe(TransactionIntent.UNKNOWN);
  });

  it('DEX takes priority over approval when both present', () => {
    expect(classifyIntent([
      ix(JUPITER, 'route'),
      ix(TOKEN, 'approve'),
    ]).primaryIntent).toBe(TransactionIntent.SWAP);
  });
});

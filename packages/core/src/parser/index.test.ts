import { describe, expect, it } from 'vitest';
import { Keypair, SystemProgram, Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import {
  createApproveCheckedInstruction,
  createApproveInstruction,
  createCloseAccountInstruction,
  createFreezeAccountInstruction,
  createRevokeInstruction,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { SignalType } from '../types/index.js';
import { detectAuthorityChanges } from '../detectors/authority.js';
import { detectDurableNonce } from '../detectors/durable-nonce.js';
import { parseTransaction } from './index.js';

const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey('ComputeBudget111111111111111111111111111111');

function serializeUnsigned(transaction: Transaction): string {
  transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
  transaction.feePayer = Keypair.generate().publicKey;
  return transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
}

function makeComputeBudgetInstruction(discriminant: number, payload: Uint8Array): TransactionInstruction {
  const data = new Uint8Array(4 + payload.length);
  new DataView(data.buffer).setUint32(0, discriminant, true);
  data.set(payload, 4);
  return new TransactionInstruction({
    programId: COMPUTE_BUDGET_PROGRAM_ID,
    keys: [],
    data: Buffer.from(data),
  });
}

describe('parseTransaction', () => {
  it('parses system transfers from base64 transactions', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: 1_250_000_000,
      }),
    );

    const [instruction] = await parseTransaction(serializeUnsigned(transaction));

    expect(instruction).toMatchObject({
      programId: SystemProgram.programId.toBase58(),
      programName: 'System Program',
      type: 'transfer',
      data: {
        from: from.toBase58(),
        to: to.toBase58(),
        lamports: 1_250_000_000,
      },
    });
  });

  it('preserves signer and writable account metadata', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 1_000 }),
    );
    transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
    transaction.feePayer = from;

    const [instruction] = await parseTransaction(
      transaction.serialize({ requireAllSignatures: false, verifySignatures: false }),
    );

    expect(instruction!.accountMeta.length).toBeGreaterThan(0);
    const fromMeta = instruction!.accountMeta.find((m) => m.address === from.toBase58());
    const toMeta = instruction!.accountMeta.find((m) => m.address === to.toBase58());
    expect(fromMeta?.isSigner).toBe(true);
    expect(fromMeta?.isWritable).toBe(true);
    expect(toMeta?.isSigner).toBe(false);
    expect(toMeta?.isWritable).toBe(true);
  });

  it('parses advance nonce instructions so durable nonce detection works', async () => {
    const noncePubkey = Keypair.generate().publicKey;
    const authorizedPubkey = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      SystemProgram.nonceAdvance({
        noncePubkey,
        authorizedPubkey,
      }),
    );

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const result = detectDurableNonce(instructions);

    expect(instructions[0]).toMatchObject({
      type: 'nonceAdvance',
      data: {
        nonceAccount: noncePubkey.toBase58(),
        nonceAuthority: authorizedPubkey.toBase58(),
      },
    });
    expect(result.detected).toBe(true);
    expect(result.signal?.metadata).toEqual({
      nonceAccount: noncePubkey.toBase58(),
    });
  });

  it('parses token approvals so delegate spending risk is detected', async () => {
    const tokenAccount = Keypair.generate().publicKey;
    const delegate = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      createApproveInstruction(tokenAccount, delegate, owner, 500_000n),
    );

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const result = detectAuthorityChanges(instructions);

    expect(instructions[0]).toMatchObject({
      type: 'approve',
      data: {
        amount: 500_000n,
      },
    });
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: SignalType.TOKEN_APPROVAL,
          metadata: expect.objectContaining({
            sourceAccount: tokenAccount.toBase58(),
            delegate: delegate.toBase58(),
            owner: owner.toBase58(),
            amount: '500000',
          }),
        }),
      ]),
    );
  });

  it('parses checked token transfers and approvals', async () => {
    const source = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const delegate = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      createTransferCheckedInstruction(source, mint, destination, owner, 123_456n, 6),
      createApproveCheckedInstruction(source, mint, delegate, owner, 50_000n, 6),
    );

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const result = detectAuthorityChanges(instructions);

    expect(instructions[0]).toMatchObject({
      type: 'transferChecked',
      data: {
        amount: 123_456,
        decimals: 6,
      },
    });
    expect(instructions[1]).toMatchObject({
      type: 'approveChecked',
      data: {
        amount: 50_000n,
        decimals: 6,
      },
    });
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: SignalType.TOKEN_APPROVAL,
          metadata: expect.objectContaining({
            sourceAccount: source.toBase58(),
            delegate: delegate.toBase58(),
            owner: owner.toBase58(),
          }),
        }),
      ]),
    );
  });

  it('parses revokes, closes, and freezes into deterministic signals', async () => {
    const account = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      createRevokeInstruction(account, owner),
      createCloseAccountInstruction(account, destination, owner),
      createFreezeAccountInstruction(account, mint, owner),
    );

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const result = detectAuthorityChanges(instructions);

    expect(instructions.map((ix) => ix.type)).toEqual([
      'revoke',
      'closeAccount',
      'freezeAccount',
    ]);
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: SignalType.TOKEN_REVOCATION }),
        expect.objectContaining({ type: SignalType.TOKEN_ACCOUNT_CLOSURE }),
        expect.objectContaining({ type: SignalType.TOKEN_ACCOUNT_FREEZE }),
      ]),
    );
  });

  it('parses ATA createAssociatedTokenAccount instruction', async () => {
    const payer = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    // createAssociatedTokenAccountInstruction uses the ATA program
    const ataAddress = Keypair.generate().publicKey; // placeholder
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(payer, ataAddress, wallet, mint),
    );

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const ataIx = instructions.find((ix) => ix.programId === ATA_PROGRAM_ID.toBase58());

    expect(ataIx).toBeDefined();
    expect(ataIx!.type).toBe('createAssociatedTokenAccount');
    expect(ataIx!.programName).toBe('Associated Token Account');
  });

  it('parses setComputeUnitLimit instruction', async () => {
    const limitPayload = new Uint8Array(4);
    new DataView(limitPayload.buffer).setUint32(0, 200_000, true);
    const transaction = new Transaction().add(makeComputeBudgetInstruction(0x02, limitPayload));

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const cbIx = instructions.find((ix) => ix.programId === COMPUTE_BUDGET_PROGRAM_ID.toBase58());

    expect(cbIx).toBeDefined();
    expect(cbIx!.type).toBe('setComputeUnitLimit');
    expect(cbIx!.data?.units).toBe(200_000);
  });

  it('parses setComputeUnitPrice instruction', async () => {
    const pricePayload = new Uint8Array(8);
    new DataView(pricePayload.buffer).setBigUint64(0, 1_000_000n, true);
    const transaction = new Transaction().add(makeComputeBudgetInstruction(0x03, pricePayload));

    const instructions = await parseTransaction(serializeUnsigned(transaction));
    const cbIx = instructions.find((ix) => ix.programId === COMPUTE_BUDGET_PROGRAM_ID.toBase58());

    expect(cbIx).toBeDefined();
    expect(cbIx!.type).toBe('setComputeUnitPrice');
    expect(cbIx!.data?.microLamports).toBe(1_000_000);
  });
});

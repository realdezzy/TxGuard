import { describe, expect, it } from 'vitest';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { createApproveInstruction } from '@solana/spl-token';
import { SignalType } from '../types/index.js';
import { detectAuthorityChanges } from '../detectors/authority.js';
import { detectDurableNonce } from '../detectors/durable-nonce.js';
import { parseTransaction } from './index.js';

function serializeUnsigned(transaction: Transaction): string {
  transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
  transaction.feePayer = Keypair.generate().publicKey;
  return transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
}

describe('parseTransaction', () => {
  it('parses system transfers from base64 transactions', () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: 1_250_000_000,
      }),
    );

    const [instruction] = parseTransaction(serializeUnsigned(transaction));

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

  it('parses advance nonce instructions so durable nonce detection works', () => {
    const noncePubkey = Keypair.generate().publicKey;
    const authorizedPubkey = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      SystemProgram.nonceAdvance({
        noncePubkey,
        authorizedPubkey,
      }),
    );

    const instructions = parseTransaction(serializeUnsigned(transaction));
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

  it('parses token approvals so delegate spending risk is detected', () => {
    const tokenAccount = Keypair.generate().publicKey;
    const delegate = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const transaction = new Transaction().add(
      createApproveInstruction(tokenAccount, delegate, owner, 500_000n),
    );

    const instructions = parseTransaction(serializeUnsigned(transaction));
    const result = detectAuthorityChanges(instructions);

    expect(instructions[0]).toMatchObject({
      type: 'approve',
      data: {
        amount: 500_000,
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
            amount: 500_000,
          }),
        }),
      ]),
    );
  });
});

import { Keypair, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
import { createApproveInstruction } from '@solana/spl-token';
import { SignalType, RiskLevel } from '../types/index.js';

export interface LabeledTransaction {
  id: string;
  category: 'benign' | 'malicious';
  rawTransaction: string;
  expectedSignals: { type: SignalType; minLevel: RiskLevel }[];
}

function serializeUnsigned(transaction: Transaction, feePayer: PublicKey): string {
  transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
  transaction.feePayer = feePayer;
  return transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');
}

export function buildCorpus(): LabeledTransaction[] {
  const corpus: LabeledTransaction[] = [];

  // 1. Benign: Simple SOL Transfer
  const alice = Keypair.generate().publicKey;
  const bob = Keypair.generate().publicKey;
  const tx1 = new Transaction().add(SystemProgram.transfer({ fromPubkey: alice, toPubkey: bob, lamports: 1000 }));
  corpus.push({
    id: 'benign-sol-transfer',
    category: 'benign',
    rawTransaction: serializeUnsigned(tx1, alice),
    expectedSignals: [],
  });

  // 2. Malicious: Drainer delegate approval
  const victim = Keypair.generate().publicKey;
  const drainer = Keypair.generate().publicKey;
  const tokenAccount = Keypair.generate().publicKey;
  const tx2 = new Transaction().add(createApproveInstruction(tokenAccount, drainer, victim, BigInt('18446744073709551615'))); // U64_MAX
  corpus.push({
    id: 'malicious-unlimited-delegate',
    category: 'malicious',
    rawTransaction: serializeUnsigned(tx2, victim),
    expectedSignals: [
      { type: SignalType.TOKEN_APPROVAL, minLevel: RiskLevel.CRITICAL },
    ],
  });

  // 3. Malicious: Durable Nonce Advance (often used in drainers to hide txs)
  const nonceAccount = Keypair.generate().publicKey;
  const tx3 = new Transaction().add(SystemProgram.nonceAdvance({ noncePubkey: nonceAccount, authorizedPubkey: drainer }));
  corpus.push({
    id: 'malicious-durable-nonce',
    category: 'malicious',
    rawTransaction: serializeUnsigned(tx3, drainer),
    expectedSignals: [
      { type: SignalType.DURABLE_NONCE, minLevel: RiskLevel.HIGH },
    ],
  });

  // 4. Benign: Token Revoke (protective)
  const tx4 = new Transaction().add({
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: victim, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([5]), // revoke
  });
  corpus.push({
    id: 'benign-token-revoke',
    category: 'benign',
    rawTransaction: serializeUnsigned(tx4, victim),
    expectedSignals: [
      { type: SignalType.TOKEN_REVOCATION, minLevel: RiskLevel.LOW },
    ],
  });

  // 5. Malicious: Unknown Program (High risk in context)
  const unknownProgram = Keypair.generate().publicKey;
  const tx5 = new Transaction().add({
    programId: unknownProgram,
    keys: [{ pubkey: victim, isSigner: true, isWritable: true }],
    data: Buffer.from([1, 2, 3]),
  });
  corpus.push({
    id: 'malicious-unknown-program',
    category: 'malicious',
    rawTransaction: serializeUnsigned(tx5, victim),
    expectedSignals: [
      { type: SignalType.UNKNOWN_PROGRAM, minLevel: RiskLevel.MEDIUM },
    ],
  });

  return corpus;
}

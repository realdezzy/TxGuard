import { Keypair, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
import { createApproveInstruction } from '@solana/spl-token';
import { SignalType, RiskLevel } from '../types/index.js';
import type { TransactionIntent } from '../detectors/intent.js';

export interface LabeledTransaction {
  id: string;
  source: 'real' | 'synthetic';
  category: 'benign' | 'malicious';
  intent: TransactionIntent;
  rawTransaction: string;
  expectedSignals: { type: SignalType; minLevel: RiskLevel }[];
  negativeSignals?: SignalType[];
  description: string;
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

  // --- Synthetic benign ---

  const alice = Keypair.generate().publicKey;
  const bob = Keypair.generate().publicKey;
  const tx1 = new Transaction().add(SystemProgram.transfer({ fromPubkey: alice, toPubkey: bob, lamports: 1000 }));
  corpus.push({
    id: 'benign-sol-transfer',
    source: 'synthetic',
    category: 'benign',
    intent: 'transfer',
    rawTransaction: serializeUnsigned(tx1, alice),
    expectedSignals: [],
    negativeSignals: [SignalType.TOKEN_APPROVAL, SignalType.AUTHORITY_CHANGE],
    description: 'Simple SOL transfer between two wallets',
  });

  // Benign: Token revoke (protective)
  const victim = Keypair.generate().publicKey;
  const tokenAccount = Keypair.generate().publicKey;
  const tx4 = new Transaction().add({
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: victim, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([5]),
  });
  corpus.push({
    id: 'benign-token-revoke',
    source: 'synthetic',
    category: 'benign',
    intent: 'revocation',
    rawTransaction: serializeUnsigned(tx4, victim),
    expectedSignals: [
      { type: SignalType.TOKEN_REVOCATION, minLevel: RiskLevel.LOW },
    ],
    negativeSignals: [SignalType.TOKEN_APPROVAL, SignalType.AUTHORITY_CHANGE],
    description: 'Token delegate revocation -- protective action',
  });

  // --- Synthetic malicious ---

  const drainer = Keypair.generate().publicKey;
  const tx2 = new Transaction().add(createApproveInstruction(tokenAccount, drainer, victim, BigInt('18446744073709551615')));
  corpus.push({
    id: 'malicious-unlimited-delegate',
    source: 'synthetic',
    category: 'malicious',
    intent: 'approval',
    rawTransaction: serializeUnsigned(tx2, victim),
    expectedSignals: [
      { type: SignalType.TOKEN_APPROVAL, minLevel: RiskLevel.CRITICAL },
    ],
    description: 'Unlimited delegate approval -- classic drainer pattern',
  });

  const nonceAccount = Keypair.generate().publicKey;
  const tx3 = new Transaction().add(SystemProgram.nonceAdvance({ noncePubkey: nonceAccount, authorizedPubkey: drainer }));
  corpus.push({
    id: 'malicious-durable-nonce',
    source: 'synthetic',
    category: 'malicious',
    intent: 'unknown',
    rawTransaction: serializeUnsigned(tx3, drainer),
    expectedSignals: [
      { type: SignalType.DURABLE_NONCE, minLevel: RiskLevel.HIGH },
    ],
    description: 'Durable nonce advance -- often used by drainers to delay signature submission',
  });

  const unknownProgram = Keypair.generate().publicKey;
  const tx5 = new Transaction().add({
    programId: unknownProgram,
    keys: [{ pubkey: victim, isSigner: true, isWritable: true }],
    data: Buffer.from([1, 2, 3]),
  });
  corpus.push({
    id: 'malicious-unknown-program',
    source: 'synthetic',
    category: 'malicious',
    intent: 'unknown',
    rawTransaction: serializeUnsigned(tx5, victim),
    expectedSignals: [
      { type: SignalType.UNKNOWN_PROGRAM, minLevel: RiskLevel.MEDIUM },
    ],
    description: 'Interaction with unknown, unverified program',
  });

  // Malicious: approve + closeAccount combo (drainer sweep pattern)
  const tx6 = new Transaction();
  tx6.add(createApproveInstruction(tokenAccount, drainer, victim, BigInt('18446744073709551615')));
  tx6.add({
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: drainer, isSigner: false, isWritable: true },
      { pubkey: victim, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([9]),
  });
  corpus.push({
    id: 'malicious-approve-close-combo',
    source: 'synthetic',
    category: 'malicious',
    intent: 'approval',
    rawTransaction: serializeUnsigned(tx6, victim),
    expectedSignals: [
      { type: SignalType.TOKEN_APPROVAL, minLevel: RiskLevel.CRITICAL },
      { type: SignalType.TOKEN_ACCOUNT_CLOSURE, minLevel: RiskLevel.HIGH },
    ],
    description: 'Approve unlimited delegate then close account to drainer -- combined sweep',
  });

  // --- Noise Cases / Near Misses ---

  // Swap with extra noise
  const tx7 = new Transaction();
  tx7.add({
    programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
    keys: [],
    data: Buffer.from([2, 0, 0, 0, 0]),
  });
  tx7.add({
    programId: new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'),
    keys: [{ pubkey: victim, isSigner: true, isWritable: true }],
    data: Buffer.from([1]),
  });
  tx7.add({
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    keys: [],
    data: Buffer.from('hello world'),
  });
  corpus.push({
    id: 'benign-swap-noise',
    source: 'synthetic',
    category: 'benign',
    intent: 'swap',
    rawTransaction: serializeUnsigned(tx7, victim),
    expectedSignals: [],
    negativeSignals: [SignalType.TOKEN_APPROVAL, SignalType.AUTHORITY_CHANGE, SignalType.INTENT_ANOMALY],
    description: 'Swap with compute budget and memo noise',
  });

  // Adversarial: Swap with hidden approval
  const tx8 = new Transaction();
  tx8.add({
    programId: new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'),
    keys: [{ pubkey: victim, isSigner: true, isWritable: true }],
    data: Buffer.from([1]),
  });
  tx8.add(createApproveInstruction(tokenAccount, drainer, victim, BigInt('18446744073709551615')));
  corpus.push({
    id: 'adversarial-swap-hidden-approval',
    source: 'synthetic',
    category: 'malicious',
    intent: 'swap', // The primary intent looks like swap
    rawTransaction: serializeUnsigned(tx8, victim),
    expectedSignals: [
      { type: SignalType.INTENT_ANOMALY, minLevel: RiskLevel.HIGH },
      { type: SignalType.TOKEN_APPROVAL, minLevel: RiskLevel.CRITICAL },
    ],
    description: 'Swap that also approves a delegate',
  });

  return corpus;
}

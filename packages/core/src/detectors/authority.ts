import { RiskLevel, SignalType, U64_MAX, type RiskSignal, type ParsedInstruction } from '../types/index.js';

const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];

const SET_AUTHORITY_IX_INDEX = 6;

// Authority types for setAuthority instruction
const AUTHORITY_TYPE_NAMES: Record<number, string> = {
  0: 'MintTokens',
  1: 'FreezeAccount',
  2: 'AccountOwner',
  3: 'CloseAccount',
};

function authorityTypeLevel(authorityType: number | undefined): RiskLevel {
  if (authorityType === 0 || authorityType === 2) return RiskLevel.CRITICAL;
  if (authorityType === 1 || authorityType === 3) return RiskLevel.HIGH;
  return RiskLevel.HIGH;
}

function isUnlimitedAmount(amount: unknown): boolean {
  if (amount === undefined || amount === null) return true;
  if (typeof amount === 'bigint') return amount >= U64_MAX;
  if (typeof amount === 'number') return amount >= Number.MAX_SAFE_INTEGER;
  return false;
}

export interface AuthorityChangeResult {
  signals: RiskSignal[];
}

export function detectAuthorityChanges(instructions: ParsedInstruction[]): AuthorityChangeResult {
  const signals: RiskSignal[] = [];

  for (const ix of instructions) {
    if (!TOKEN_PROGRAMS.includes(ix.programId)) continue;

    const isSetAuthority =
      ix.type === 'setAuthority' ||
      (ix.data && (ix.data as Record<string, unknown>)['instructionIndex'] === SET_AUTHORITY_IX_INDEX);

    if (isSetAuthority) {
      const authorityType = (ix.data as Record<string, unknown> | undefined)?.authorityType as number | undefined;
      const authorityTypeName = authorityType !== undefined ? (AUTHORITY_TYPE_NAMES[authorityType] ?? `Unknown(${authorityType})`) : 'Unknown';
      const level = authorityTypeLevel(authorityType);

      signals.push({
        type: SignalType.AUTHORITY_CHANGE,
        level,
        title: 'Token Authority Change',
        message:
          `This transaction modifies token authority (${authorityTypeName}). ` +
          'This could grant a third party mint, freeze, or transfer control over your tokens.',
        metadata: {
          programId: ix.programId,
          accounts: ix.accounts,
          authorityType,
          authorityTypeName,
        },
      });
    }

    if (ix.type === 'approve' || ix.type === 'approveChecked') {
      const amount = (ix.data as Record<string, unknown> | undefined)?.amount;
      const delegate = ix.type === 'approveChecked' ? ix.accounts[2] : ix.accounts[1];
      const owner = ix.type === 'approveChecked' ? ix.accounts[3] : ix.accounts[2];
      const unlimited = isUnlimitedAmount(amount);

      signals.push({
        type: SignalType.TOKEN_APPROVAL,
        level: unlimited ? RiskLevel.CRITICAL : RiskLevel.HIGH,
        title: unlimited ? 'Unlimited Token Delegate Approval' : 'Token Delegate Approval',
        message: unlimited
          ? 'This transaction grants unlimited spending rights over your token account. This is a critical drainer pattern.'
          : 'This transaction approves another account to spend tokens from your token account. Only approve delegates you explicitly trust.',
        metadata: {
          programId: ix.programId,
          sourceAccount: ix.accounts[0],
          delegate,
          owner,
          amount: amount?.toString(),
          unlimited,
        },
      });
    }

    if (ix.type === 'revoke') {
      signals.push({
        type: SignalType.TOKEN_REVOCATION,
        level: RiskLevel.LOW,
        title: 'Token Delegate Revocation',
        message:
          'This transaction revokes a token delegate approval. This is usually a protective action.',
        metadata: {
          programId: ix.programId,
          sourceAccount: ix.accounts[0],
          owner: ix.accounts[1],
        },
      });
    }

    if (ix.type === 'closeAccount') {
      const destinationAddress = ix.accounts[1];
      // Determine if the destination is signer-controlled within this instruction
      const destinationMeta = ix.accountMeta.find((m) => m.address === destinationAddress);
      const ownerAddress = ix.accounts[2];
      const destinationIsSignerControlled =
        destinationMeta?.isSigner === true || destinationAddress === ownerAddress;

      signals.push({
        type: SignalType.TOKEN_ACCOUNT_CLOSURE,
        level: destinationIsSignerControlled ? RiskLevel.LOW : RiskLevel.HIGH,
        title: 'Token Account Closure',
        message: destinationIsSignerControlled
          ? 'This transaction closes a token account and returns rent to your wallet.'
          : 'This transaction closes a token account and sends rent to a third-party destination. Verify you intended this.',
        metadata: {
          programId: ix.programId,
          account: ix.accounts[0],
          destination: destinationAddress,
          owner: ownerAddress,
          destinationIsSignerControlled,
        },
      });
    }

    if (ix.type === 'freezeAccount') {
      signals.push({
        type: SignalType.TOKEN_ACCOUNT_FREEZE,
        level: RiskLevel.HIGH,
        title: 'Token Account Freeze',
        message:
          'This transaction freezes a token account. Frozen accounts cannot transfer tokens until thawed by the freeze authority.',
        metadata: {
          programId: ix.programId,
          account: ix.accounts[0],
          mint: ix.accounts[1],
          authority: ix.accounts[2],
        },
      });
    }

    if (ix.type === 'thawAccount') {
      signals.push({
        type: SignalType.TOKEN_ACCOUNT_FREEZE,
        level: RiskLevel.LOW,
        title: 'Token Account Thaw',
        message:
          'This transaction thaws a previously frozen token account. This is typically a protective or administrative action.',
        metadata: {
          programId: ix.programId,
          account: ix.accounts[0],
          mint: ix.accounts[1],
          authority: ix.accounts[2],
        },
      });
    }
  }

  for (const ix of instructions) {
    if (ix.programName === 'Unknown Program') {
      signals.push({
        type: SignalType.UNKNOWN_PROGRAM,
        level: RiskLevel.MEDIUM,
        title: 'Unknown Program Interaction',
        message: `Transaction interacts with unrecognized program ${ix.programId.slice(0, 8)}...${ix.programId.slice(-4)}.`,
        metadata: { programId: ix.programId },
      });
    }
  }

  return { signals };
}

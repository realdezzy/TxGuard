import { RiskLevel, SignalType, type RiskSignal, type ParsedInstruction } from '../types/index.js';

const TOKEN_PROGRAMS = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]);

export interface WritablePatternResult {
  signals: RiskSignal[];
}

export function detectWritablePatterns(instructions: ParsedInstruction[]): WritablePatternResult {
  const signals: RiskSignal[] = [];

  const signers = new Set<string>();
  const thirdPartyWritableTokenAccounts: { address: string; programId: string; type: string }[] = [];

  for (const ix of instructions) {
    for (const meta of ix.accountMeta) {
      if (meta.isSigner) signers.add(meta.address);
    }
  }

  for (const ix of instructions) {
    if (!TOKEN_PROGRAMS.has(ix.programId)) continue;

    for (const meta of ix.accountMeta) {
      if (!meta.isWritable) continue;
      if (signers.has(meta.address)) continue;

      const owner = ix.data?.owner as string | undefined;
      if (owner && signers.has(owner)) continue;

      thirdPartyWritableTokenAccounts.push({
        address: meta.address,
        programId: ix.programId,
        type: ix.type,
      });
    }
  }

  const uniqueThirdParty = new Set(thirdPartyWritableTokenAccounts.map((a) => a.address));
  if (uniqueThirdParty.size >= 3) {
    signals.push({
      type: SignalType.AUTHORITY_CHANGE,
      level: RiskLevel.HIGH,
      title: 'Multiple Third-Party Writable Token Accounts',
      message:
        `This transaction writes to ${uniqueThirdParty.size} token accounts not controlled by the signer. ` +
        'This pattern may indicate a drainer sweeping multiple accounts.',
      metadata: {
        count: uniqueThirdParty.size,
        accounts: [...uniqueThirdParty].slice(0, 5),
      },
    });
  }

  return { signals };
}

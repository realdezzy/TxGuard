import { RiskLevel, SignalType, type RiskSignal } from '../types/index.js';

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[m]![n]!;
}

function prefixSuffixMatch(a: string, b: string, chars: number = 4): boolean {
  if (a.length < chars || b.length < chars) return false;
  const prefixMatch = a.slice(0, chars) === b.slice(0, chars);
  const suffixMatch = a.slice(-chars) === b.slice(-chars);
  return prefixMatch && suffixMatch && a !== b;
}

export interface AddressPoisoningResult {
  signal: RiskSignal | null;
  matchedAddress?: string;
  similarity?: number;
}

export function detectAddressPoisoning(
  target: string,
  history: string[],
  threshold: number = 0.85,
): AddressPoisoningResult {
  for (const addr of history) {
    if (addr === target) continue;

    if (prefixSuffixMatch(target, addr)) {
      return {
        signal: {
          type: SignalType.ADDRESS_POISONING,
          level: RiskLevel.CRITICAL,
          title: 'Address Poisoning Detected',
          message: `Recipient "${target.slice(0, 6)}...${target.slice(-4)}" closely mimics known address "${addr.slice(0, 6)}...${addr.slice(-4)}". First and last characters match but the address is different.`,
          metadata: { target, matchedAddress: addr, matchType: 'prefix-suffix' },
        },
        matchedAddress: addr,
      };
    }

    const distance = levenshteinDistance(target, addr);
    const maxLen = Math.max(target.length, addr.length);
    const similarity = 1 - distance / maxLen;

    if (similarity >= threshold) {
      return {
        signal: {
          type: SignalType.ADDRESS_POISONING,
          level: similarity >= 0.95 ? RiskLevel.CRITICAL : RiskLevel.HIGH,
          title: 'Possible Address Poisoning',
          message: `Recipient is ${(similarity * 100).toFixed(1)}% similar to known address "${addr.slice(0, 6)}...${addr.slice(-4)}". Verify carefully.`,
          metadata: { target, matchedAddress: addr, similarity, distance },
        },
        matchedAddress: addr,
        similarity,
      };
    }
  }

  return { signal: null };
}

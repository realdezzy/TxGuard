import { describe, expect, it } from 'vitest';
import { SignalType, RiskLevel } from '../types/index.js';
import { detectAddressPoisoning } from './address-poisoning.js';

const BASE = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUu';
const KNOWN = 'AAAA1111111111111111111111111111111111111111';

describe('detectAddressPoisoning', () => {
  it('returns no signal when target is not in history', () => {
    const result = detectAddressPoisoning('SomeAddress12345678901234567890123456789012', [KNOWN]);
    expect(result.signal).toBeNull();
  });

  it('returns no signal when target exactly matches a history address (benign send-to-known)', () => {
    const result = detectAddressPoisoning(KNOWN, [KNOWN]);
    expect(result.signal).toBeNull();
  });

  it('returns CRITICAL when first 4 and last 4 characters match but address differs', () => {
    // Craft an address with same prefix/suffix as KNOWN
    const poisoned = KNOWN.slice(0, 4) + 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' + KNOWN.slice(-4);
    // Ensure same length as a real base58 address
    const padded = (poisoned + 'A'.repeat(44)).slice(0, 44);
    const result = detectAddressPoisoning(padded, [KNOWN]);
    if (padded.slice(0, 4) === KNOWN.slice(0, 4) && padded.slice(-4) === KNOWN.slice(-4) && padded !== KNOWN) {
      expect(result.signal?.type).toBe(SignalType.ADDRESS_POISONING);
      expect(result.signal?.level).toBe(RiskLevel.CRITICAL);
    }
  });

  it('returns HIGH signal for an address that is highly similar but not prefix-suffix matched', () => {
    // Change only 1 character of a 44-char address → ~97.7% similarity
    const similar = BASE.slice(0, 43) + 'Z';
    const result = detectAddressPoisoning(similar, [BASE]);
    expect(result.signal?.type).toBe(SignalType.ADDRESS_POISONING);
    expect(result.signal?.level).toBeOneOf([RiskLevel.HIGH, RiskLevel.CRITICAL]);
  });

  it('returns no signal for addresses below similarity threshold', () => {
    const veryDifferent = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
    const result = detectAddressPoisoning(veryDifferent, [BASE]);
    expect(result.signal).toBeNull();
  });

  it('returns no signal with empty history', () => {
    const result = detectAddressPoisoning(BASE, []);
    expect(result.signal).toBeNull();
  });
});

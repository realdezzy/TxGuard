import { RiskLevel, SignalType, type RiskSignal } from '../types/index.js';

const SOLANA_ACTION_PATTERNS = [
  /\/api\/actions\//,
  /solana-action:/,
  /^https:\/\/[^/]+\/actions\//,
] as const;

const TRUSTED_BLINK_DOMAINS = new Set([
  'jup.ag',
  'raydium.io',
  'tensor.trade',
  'dialect.to',
  'sphere.market',
]);

export interface BlinkAnalysis {
  isBlink: boolean;
  url?: string;
  domain?: string;
  trusted: boolean;
  signal: RiskSignal | null;
}

export function detectBlinkUrl(url: string): boolean {
  return SOLANA_ACTION_PATTERNS.some((pattern) =>
    typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url),
  );
}

export function analyzeBlinkUrl(url: string): BlinkAnalysis {
  if (!detectBlinkUrl(url)) {
    return { isBlink: false, trusted: false, signal: null };
  }

  let domain: string | undefined;
  try {
    domain = new URL(url).hostname;
  } catch {
    return {
      isBlink: true,
      url,
      trusted: false,
      signal: {
        type: SignalType.BLINK_PHISHING,
        level: RiskLevel.CRITICAL,
        title: 'Malformed Blink URL',
        message: 'The Solana Action URL is malformed and cannot be parsed.',
        metadata: { url },
      },
    };
  }

  const trusted = TRUSTED_BLINK_DOMAINS.has(domain);

  if (!trusted) {
    return {
      isBlink: true,
      url,
      domain,
      trusted: false,
      signal: {
        type: SignalType.BLINK_PHISHING,
        level: RiskLevel.HIGH,
        title: 'Untrusted Blink Source',
        message: `This Solana Action originates from "${domain}", which is not in the trusted domain list. The embedded transaction may be malicious.`,
        metadata: { url, domain },
      },
    };
  }

  return { isBlink: true, url, domain, trusted: true, signal: null };
}

export async function fetchBlinkPayload(
  url: string,
  account: string,
): Promise<{ transaction: string | null; error?: string }> {
  try {
    const metaResponse = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!metaResponse.ok) {
      return { transaction: null, error: `Blink endpoint returned ${metaResponse.status}` };
    }

    const postResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account }),
    });

    if (!postResponse.ok) {
      return { transaction: null, error: `Blink POST returned ${postResponse.status}` };
    }

    const data = (await postResponse.json()) as { transaction?: string };
    return { transaction: data.transaction ?? null };
  } catch (err) {
    return {
      transaction: null,
      error: err instanceof Error ? err.message : 'Failed to fetch Blink payload',
    };
  }
}

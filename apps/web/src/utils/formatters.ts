export const SUSPICIOUS_SOL_THRESHOLD = 1_000_000_000; // 1 Billion SOL

export function parseLamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

export function formatSol(solValue: number): { formatted: string; suspicious: boolean } {
  const absValue = Math.abs(solValue);
  const suspicious = absValue > SUSPICIOUS_SOL_THRESHOLD;

  if (suspicious) {
    return { formatted: '⚠️ (suspicious)', suspicious: true };
  }

  // Short scale formatting
  let formatted = '';
  if (absValue >= 1e9) {
    formatted = `${(solValue / 1e9).toFixed(2)}B`;
  } else if (absValue >= 1e6) {
    formatted = `${(solValue / 1e6).toFixed(2)}M`;
  } else if (absValue >= 1e3) {
    formatted = `${(solValue / 1e3).toFixed(2)}K`;
  } else {
    // For small values, format up to 4 decimal places, removing trailing zeros
    formatted = solValue.toFixed(4).replace(/\.?0+$/, '');
    if (formatted === '' || formatted === '-0') formatted = '0';
  }

  return { formatted, suspicious };
}

export function cleanSignalMessage(message: string): string {
  // Look for large numeric values followed by SOL (e.g., 5073745902958390272.00 SOL)
  return message.replace(/([0-9,.]+)\s*SOL/g, (match, numStr) => {
    const num = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(num)) return match;
    
    const { formatted, suspicious } = formatSol(num);
    if (suspicious) {
      return `⚠️ Unable to reliably decode transfer amount`;
    }
    return `${formatted} SOL`;
  });
}

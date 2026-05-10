import { defineBackground } from '#imports';
import type { TransactionAnalysis } from '@txguard/core';
import { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation } from '@txguard/core';

export default defineBackground(() => {
  console.log('TxGuard background worker started');

  const MAX_TX_PAYLOAD_BYTES = 1_048_576;

  async function getSettings(): Promise<Record<string, any>> {
    const data = await browser.storage.local.get('settings');
    return (data.settings || {}) as Record<string, any>;
  }

  async function getApiUrl(): Promise<string> {
    const settings = await getSettings();
    const envUrl = import.meta.env.VITE_API_URL;
    const resolvedEnvUrl = envUrl && envUrl !== 'undefined' ? envUrl : undefined;
    return settings.apiUrl || resolvedEnvUrl || 'http://localhost:3001';
  }

  async function saveToHistory(item: any) {
    const data = await browser.storage.local.get('history');
    const history = Array.isArray(data.history) ? data.history : [];
    const newHistory = [
      { ...item, timestamp: Date.now(), id: crypto.randomUUID() },
      ...history,
    ].slice(0, 50);
    await browser.storage.local.set({ history: newHistory });
  }

  async function getAddressHistory(): Promise<string[]> {
    const data = await browser.storage.local.get('addressHistory');
    return Array.isArray(data.addressHistory) ? data.addressHistory : [];
  }

  async function updateAddressHistory(analysis: TransactionAnalysis) {
    const existing = await getAddressHistory();
    const recipients = analysis.instructions
      .filter((ix) => ix.type === 'transfer' && ix.data)
      .map((ix) => (ix.data as Record<string, string>).to)
      .filter((addr): addr is string => typeof addr === 'string');
    const seen = new Set(existing);
    for (const addr of recipients) seen.add(addr);
    await browser.storage.local.set({
      addressHistory: [...seen].slice(-200),
    });
  }

  browser.runtime.onMessage.addListener((message: unknown, sender: any, sendResponse: (response?: any) => void) => {
    if (!message || typeof message !== 'object') return false;
    const msg = message as Record<string, unknown>;

    if (msg.type === 'ANALYZE_BLINK') {
      if (typeof msg.url !== 'string' || !msg.url.startsWith('http')) {
        sendResponse({ success: false, error: 'Invalid URL' });
        return true;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      
      getApiUrl().then(apiUrl => {
        fetch(`${apiUrl}/api/blink/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: msg.url as string,
            account: '11111111111111111111111111111111' 
          }),
          signal: controller.signal
        })
        .then(res => res.json())
        .then(async data => {
          clearTimeout(timeoutId);
          await saveToHistory({ type: 'blink', url: msg.url, analysis: data.analysis });
          sendResponse({ success: true, data });
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.error('Blink analysis failed:', err);
          sendResponse({ success: false, error: err.name === 'AbortError' ? 'Analysis timed out' : err.message });
        });
      });
      return true;
    }

    if (msg.type === 'ANALYZE_TRANSACTION') {
      if (typeof msg.transaction !== 'string' || msg.transaction.length > MAX_TX_PAYLOAD_BYTES) {
        sendResponse({ approved: false, error: 'Invalid transaction payload' });
        return true;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      
      Promise.all([getApiUrl(), getSettings(), getAddressHistory()]).then(([apiUrl, settings, addressHistory]) => {
        fetch(`${apiUrl}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction: msg.transaction,
            cluster: settings.cluster || 'devnet',
            addressHistory,
          }),
          signal: controller.signal
        })
        .then(async res => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Analysis failed with HTTP ${res.status}`);
          }
          return data;
        })
        .then(async (analysis: TransactionAnalysis) => {
          clearTimeout(timeoutId);
          await saveToHistory({ type: 'transaction', analysis });
          await updateAddressHistory(analysis);
          
          sendResponse({
            analysis,
            approved: analysis.recommendation === 'APPROVE',
            requiresUserDecision: analysis.recommendation !== 'APPROVE',
          });
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.error('Transaction analysis failed:', err);
          sendResponse({
            approved: false,
            requiresUserDecision: false,
            error: err.name === 'AbortError' 
              ? 'Security analysis timed out. Transaction blocked for your safety.' 
              : `Analysis failed: ${err.message}. Signing blocked.`,
          });
        });
      });
      return true;
    }

    if (msg.type === 'BROWSER_THREAT') {
      const report = msg.report as any;
      if (report && Array.isArray(report.signals) && report.signals.length > 0) {
        const { riskScore, whyScore, scoreVarianceHint } = calculateRiskScore(report.signals);
        const analysis = {
          instructions: [],
          signals: report.signals,
          simulation: null,
          riskScore,
          whyScore,
          scoreVarianceHint,
          riskLevel: scoreToRiskLevel(riskScore),
          recommendation: scoreToRecommendation(riskScore),
          explanation: report.signals.map((signal: { message: string }) => signal.message).join('\n'),
          timestamp: report.timestamp ?? Date.now(),
        };
        saveToHistory({ type: 'browser', url: report.url, title: report.title, analysis })
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }));
        return true;
      }
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === 'GET_HISTORY') {
      browser.storage.local.get('history').then(data => sendResponse(data.history || []));
      return true;
    }

    return false;
  });
});

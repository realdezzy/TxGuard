import { defineBackground } from '#imports';
import type { TransactionAnalysis } from '@txguard/core';

export default defineBackground(() => {
  console.log('TxGuard background worker started');

  const MAX_TX_PAYLOAD_BYTES = 1_048_576;

  async function getApiUrl(): Promise<string> {
    const data = await browser.storage.local.get('settings');
    const settings = (data.settings || {}) as Record<string, any>;
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
      
      getApiUrl().then(apiUrl => {
        fetch(`${apiUrl}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: msg.transaction }),
          signal: controller.signal
        })
        .then(res => res.json())
        .then(async (analysis: TransactionAnalysis) => {
          clearTimeout(timeoutId);
          await saveToHistory({ type: 'transaction', analysis });
          
          sendResponse({ analysis });
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.error('Transaction analysis failed:', err);
          sendResponse({ approved: false, error: err.name === 'AbortError' ? 'Analysis timed out' : err.message });
        });
      });
      return true;
    }

    if (msg.type === 'BROWSER_THREAT') {
      const report = msg.report as any;
      if (report && Array.isArray(report.signals) && report.signals.length > 0) {
        const riskScore = Math.min(
          100,
          report.signals.reduce((score: number, signal: { level: string }) => {
            if (signal.level === 'CRITICAL') return score + 45;
            if (signal.level === 'HIGH') return score + 35;
            if (signal.level === 'MEDIUM') return score + 20;
            return score + 10;
          }, 0),
        );
        const analysis = {
          instructions: [],
          signals: report.signals,
          simulation: null,
          riskScore,
          riskLevel:
            riskScore >= 80 ? 'CRITICAL' :
            riskScore >= 60 ? 'HIGH' :
            riskScore >= 35 ? 'MEDIUM' :
            riskScore >= 15 ? 'LOW' : 'SAFE',
          recommendation: riskScore >= 60 ? 'REJECT' : riskScore >= 25 ? 'CAUTION' : 'APPROVE',
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

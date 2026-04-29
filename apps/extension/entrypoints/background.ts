import { defineBackground } from '#imports';

export default defineBackground(() => {
  console.log('TxGuard background worker started');

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  async function saveToHistory(item: any) {
    const data = await browser.storage.local.get('history');
    const history = Array.isArray(data.history) ? data.history : [];
    const newHistory = [
      { ...item, timestamp: Date.now(), id: crypto.randomUUID() },
      ...history,
    ].slice(0, 50);
    await browser.storage.local.set({ history: newHistory });
  }

  browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response?: any) => void) => {
    if (message.type === 'ANALYZE_BLINK') {
      fetch(`${apiUrl}/api/blink/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: message.url,
          account: '11111111111111111111111111111111' 
        })
      })
      .then(res => res.json())
      .then(async data => {
        await saveToHistory({ type: 'blink', url: message.url, analysis: data.analysis });
        sendResponse({ success: true, data });
      })
      .catch(err => {
        console.error('Blink analysis failed:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (message.type === 'ANALYZE_TRANSACTION') {
      fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: message.transaction })
      })
      .then(res => res.json())
      .then(async analysis => {
        await saveToHistory({ type: 'transaction', analysis });
        
        sendResponse({ analysis });
      })
      .catch(err => {
        console.error('Transaction analysis failed:', err);
        sendResponse({ approved: false, error: err.message });
      });
      return true;
    }

    if (message.type === 'BROWSER_THREAT') {
      const report = message.report;
      if (report?.signals?.length > 0) {
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

    if (message.type === 'GET_HISTORY') {
      browser.storage.local.get('history').then(data => sendResponse(data.history || []));
      return true;
    }
  });
});

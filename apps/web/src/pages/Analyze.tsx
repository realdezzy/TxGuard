import { useState } from 'react';
import type { TransactionAnalysis } from '@txguard/core';
import { Summary } from '../components/Summary';
import { RiskSignals } from '../components/RiskSignals';
import { InstructionSummary } from '../components/InstructionSummary';
import { BalanceChanges } from '../components/BalanceChanges';
import { SimulationDetails } from '../components/SimulationDetails';
import { Settings, type SettingsData } from '../components/Settings';

export default function Analyze() {
  const [inputTx, setInputTx] = useState('');
  const [addressHistoryText, setAddressHistoryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TransactionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddressHistory, setShowAddressHistory] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(() => {
    const saved = localStorage.getItem('txguard-settings');
    if (saved) return JSON.parse(saved);
    return {
      apiUrl: import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'undefined'
        ? import.meta.env.VITE_API_URL
        : 'http://localhost:3001',
      cluster: 'devnet',
    };
  });

  const saveSettings = (newSettings: SettingsData) => {
    setSettings(newSettings);
    localStorage.setItem('txguard-settings', JSON.stringify(newSettings));
  };

  const handleAnalyze = async () => {
    if (!inputTx.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    const addressHistory = addressHistoryText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 32);

    try {
      const endpoint = inputTx.startsWith('http')
        ? `${settings.apiUrl}/api/blink/preview`
        : `${settings.apiUrl}/api/analyze`;

      const body = inputTx.startsWith('http')
        ? { url: inputTx, account: '11111111111111111111111111111111', cluster: settings.cluster }
        : { transaction: inputTx, cluster: settings.cluster, addressHistory };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setAnalysis(data.analysis || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const navigateHome = () => {
    window.location.hash = '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <div className="min-h-screen bg-darker text-white font-sans selection:bg-primary/30">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <button onClick={navigateHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary shadow-lg shadow-primary/20">
                <svg className="w-6 h-6 text-darker" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 18c-3.75-1-6.5-4.82-6.5-9V8.55l6.5-3.61 6.5 3.61V11c0 4.18-2.75 8-6.5 9z"/>
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">TxGuard</span>
            </button>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                settings.cluster === 'mainnet-beta' ? 'bg-primary/10 text-primary border-primary/20' :
                settings.cluster === 'testnet' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {settings.cluster === 'mainnet-beta' ? 'Mainnet' : settings.cluster === 'testnet' ? 'Testnet' : 'Devnet'}
              </span>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-xl hover:bg-white/5 text-white/50 hover:text-white transition-all active:scale-95"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-white/90">
            Transaction Analysis
          </h1>
          <p className="text-white/40">Paste a base64 transaction or a Solana Blink URL</p>
        </div>

        <div className="max-w-4xl mx-auto glass-panel p-6 rounded-2xl mb-12">
          <div className="flex flex-col gap-4">
            <textarea
              className="w-full h-32 bg-dark/50 border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow custom-scrollbar resize-none placeholder-white/30"
              placeholder="Paste Base64 Transaction or Blink URL (https://...)"
              value={inputTx}
              onChange={(e) => setInputTx(e.target.value)}
              spellCheck={false}
            />
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowAddressHistory(!showAddressHistory)}
                className="text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1"
              >
                <svg className={`w-3 h-3 transition-transform ${showAddressHistory ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {showAddressHistory ? 'Hide' : 'Add known addresses (address poisoning detection)'}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={loading || !inputTx.trim()}
                className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
                  loading || !inputTx.trim()
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary to-secondary text-darker hover:opacity-90 hover:scale-[1.02] active:scale-95'
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Analyzing...
                  </span>
                ) : 'Analyze Transaction'}
              </button>
            </div>

            {showAddressHistory && (
              <div className="animate-[fade-in_0.2s_ease-out]">
                <textarea
                  className="w-full h-20 bg-dark/50 border border-white/10 rounded-xl p-4 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow custom-scrollbar resize-none placeholder-white/20"
                  placeholder={`Enter one address per line or comma-separated.\nExamples of addresses you commonly interact with.\nTxGuard will detect if a recipient mimics these addresses.`}
                  value={addressHistoryText}
                  onChange={(e) => setAddressHistoryText(e.target.value)}
                  spellCheck={false}
                />
                <p className="text-[10px] text-white/20 mt-1 px-1">
                  Addresses you trust. TxGuard compares recipients against this list to detect lookalike poisoning attacks.
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="max-w-4xl mx-auto mb-12 p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-4">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-red-300">Analysis Failed</h3>
              <p className="mt-1 opacity-80 text-sm">{error}</p>
            </div>
          </div>
        )}

        {analysis && (
          <div className="max-w-4xl mx-auto space-y-10 animate-[fade-in_0.6s_ease-out]">
            <style>{`
              @keyframes fade-in {
                from { opacity: 0; transform: translateY(24px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <Summary analysis={analysis} />
            <RiskSignals signals={analysis.signals} />
            <InstructionSummary instructions={analysis.instructions} />
            {analysis.simulation && <BalanceChanges simulation={analysis.simulation} />}
            <SimulationDetails simulation={analysis.simulation} />
          </div>
        )}
      </main>

      {showSettings && (
        <Settings
          initialSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
        />
      )}
    </div>
  );
}

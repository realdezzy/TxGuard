import { useState } from 'react';
import type { TransactionAnalysis } from '@txguard/core';
import { Summary } from './components/Summary';
import { RiskSignals } from './components/RiskSignals';
import { InstructionSummary } from './components/InstructionSummary';
import { BalanceChanges } from './components/BalanceChanges';
import { SimulationDetails } from './components/SimulationDetails';
import { Settings, type SettingsData } from './components/Settings';

export default function App() {
  const [inputTx, setInputTx] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TransactionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
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

    try {
      const endpoint = inputTx.startsWith('http')
        ? `${settings.apiUrl}/api/blink/preview`
        : `${settings.apiUrl}/api/analyze`;

      const body = inputTx.startsWith('http')
        ? { url: inputTx, account: '11111111111111111111111111111111', cluster: settings.cluster }
        : { transaction: inputTx, cluster: settings.cluster };

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
      setAnalysis(data.analysis || data); // Handle both endpoint shapes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-darker text-white font-sans selection:bg-primary/30">
      {/* Navbar */}
      <nav className="border-b border-white/10 glass-panel sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary shadow-lg">
                <span className="font-bold text-darker text-2xl">T</span>
              </div>
              <span className="text-xl font-bold tracking-tight">TxGuard</span>
            </div>
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
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-400 to-secondary">
            Sign with Confidence
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
            Paste a raw Solana transaction (base64) or a Blink Action URL to simulate and analyze it before execution.
          </p>
        </div>

        {/* Decoder Input */}
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
              <div className="text-xs text-white/40">
                Powered by Solana and Artificial Inteligence
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !inputTx.trim()}
                className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all ${loading || !inputTx.trim()
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-primary text-darker hover:bg-[#10c47a] hover:-translate-y-0.5'
                  }`}
              >
                {loading ? 'Analyzing...' : 'Analyze Transaction'}
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-4xl mx-auto mb-12 p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-4">
            <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-red-300">Analysis Failed</h3>
              <p className="mt-1 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Results View */}
        {analysis && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* 1. Summary (Top) */}
            <Summary analysis={analysis} />

            {/* 2. Key Risks / Warnings */}
            <RiskSignals signals={analysis.signals} />

            {/* 3. What This Transaction Does */}
            <InstructionSummary instructions={analysis.instructions} />

            {/* 4. Balance Changes */}
            {analysis.simulation && <BalanceChanges simulation={analysis.simulation} />}

            {/* 5. Technical Details */}
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

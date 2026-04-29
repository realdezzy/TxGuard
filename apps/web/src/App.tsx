import { useState } from 'react';
import type { BalanceChange, TransactionAnalysis } from '@txguard/core';
import { RiskLevel } from '@txguard/core';

export default function App() {
  const [inputTx, setInputTx] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TransactionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!inputTx.trim()) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Base64 tx or Blink URL proxy depending on input content format
      const endpoint = inputTx.startsWith('http')
        ? `${import.meta.env.VITE_API_URL}/api/blink/preview`
        : `${import.meta.env.VITE_API_URL}/api/analyze`;

      const body = inputTx.startsWith('http')
        ? { url: inputTx, account: '11111111111111111111111111111111' }
        : { transaction: inputTx };

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
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/20">
                Live on Devnet
              </span>
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
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header / Score */}
            <div className="glass-panel p-8 rounded-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
              {/* Background glow based on risk */}
              <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none ${analysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500' :
                  analysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500' :
                    analysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500' : 'bg-green-500'
                }`} />

              <div className="flex-shrink-0 text-center relative">
                <div className="w-40 h-40 rounded-full border-8 flex items-center justify-center flex-col shadow-2xl relative bg-darker/50 backdrop-blur-sm"
                  style={{
                    borderColor: analysis.riskLevel === RiskLevel.CRITICAL ? '#ef4444' :
                      analysis.riskLevel === RiskLevel.HIGH ? '#f97316' :
                        analysis.riskLevel === RiskLevel.MEDIUM ? '#eab308' : '#22c55e'
                  }}>
                  <span className="text-4xl font-extrabold">{analysis.riskScore}</span>
                  <span className="text-xs uppercase font-bold tracking-wider mt-1 opacity-80">
                    {analysis.riskLevel}
                  </span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left z-10">
                <h2 className="text-2xl font-bold mb-4">AI Risk Explanation</h2>
                <div className="prose prose-invert prose-p:leading-relaxed prose-p:text-white/80 max-w-none bg-dark/30 p-5 rounded-xl border border-white/5">
                  {analysis.explanation.split('\n').map((line, i) => (
                    <p key={i} className="my-1">{line}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Signals Grid */}
            {analysis.signals.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Risk Signals Detected ({analysis.signals.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.signals.map((sig, i) => (
                    <div key={i} className="glass-panel p-5 rounded-xl border-l-4"
                      style={{
                        borderLeftColor: sig.level === RiskLevel.CRITICAL ? '#ef4444' :
                          sig.level === RiskLevel.HIGH ? '#f97316' :
                            sig.level === RiskLevel.MEDIUM ? '#eab308' : '#3b82f6'
                      }}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{sig.title}</h4>
                        <span className="text-xs px-2 py-1 rounded bg-white/5 font-semibold">
                          {sig.level}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed mb-3">
                        {sig.message}
                      </p>
                      {sig.metadata && Object.keys(sig.metadata).length > 0 && (
                        <div className="bg-dark/50 rounded p-2 text-xs font-mono text-white/50 overflow-x-auto whitespace-pre custom-scrollbar">
                          {JSON.stringify(sig.metadata, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simulation Preview */}
            {analysis.simulation && (
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Simulation Preview
                </h3>
                <div className="glass-panel rounded-xl overflow-hidden">
                  <div className={`p-4 border-b border-white/10 flex justify-between items-center ${analysis.simulation.success ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                    <span className="font-semibold text-sm">
                      {analysis.simulation.success ? '✓ Simulation Succeeded' : '✕ Simulation Failed'}
                    </span>
                    <span className="text-xs text-white/50">{analysis.simulation.unitsConsumed} compute units</span>
                  </div>

                  {analysis.simulation.balanceChanges.length > 0 ? (
                    <div className="p-0">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10 text-xs text-white/50">
                            <th className="p-4 font-medium">Account</th>
                            <th className="p-4 font-medium text-right">Change (SOL)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                          {analysis.simulation.balanceChanges.map((change: BalanceChange, i: number) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                              <td className="p-4 font-mono text-white/70">{change.account}</td>
                              <td className={`p-4 font-mono font-medium text-right ${change.delta > 0 ? 'text-green-400' : change.delta < 0 ? 'text-red-400' : 'text-white/50'}`}>
                                {change.delta > 0 ? '+' : ''}{change.delta.toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-white/40 text-sm">
                      No balance changes simulated or simulation failed.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

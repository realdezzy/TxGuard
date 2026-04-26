import { useState, useEffect } from 'react';
import type { TransactionAnalysis } from '@txguard/core';
import { RiskLevel } from '@txguard/core';

interface HistoryItem {
  id: string;
  type: 'blink' | 'transaction';
  analysis: TransactionAnalysis;
  timestamp: number;
}

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_HISTORY' });
      setHistory(response || []);
      if (response && response.length > 0) {
        setSelectedItem(response[0]);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentAnalysis = selectedItem?.analysis;

  return (
    <div className="flex flex-col h-[600px] w-[400px] bg-darker p-4 text-white overflow-hidden font-sans">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-darker text-sm">
            T
          </div>
          <h1 className="text-base font-bold tracking-tight">TxGuard</h1>
        </div>
        <div className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/50 border border-white/10 uppercase tracking-widest font-bold">
          Devnet
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center italic text-white/20 text-sm">
            Loading security history...
          </div>
        ) : history.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center opacity-40 grayscale">
             <div className="w-12 h-12 rounded-full border border-dashed border-white/30 flex items-center justify-center mb-3">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
               </svg>
             </div>
             <p className="text-xs">No transactions analyzed yet.</p>
          </div>
        ) : (
          <>
            {/* Active Analysis / Most Recent */}
            {currentAnalysis && (
              <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-3">
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] font-bold text-white/40 uppercase">Recent Analysis</span>
                   <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                     currentAnalysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500/20 text-red-400' :
                     currentAnalysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500/20 text-orange-400' :
                     currentAnalysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'
                   }`}>
                     {currentAnalysis.riskLevel}
                   </span>
                 </div>

                 <div className="bg-dark/40 p-3 rounded-lg border border-white/5">
                   <p className="text-xs leading-relaxed text-white/80 italic">
                     "{currentAnalysis.explanation}"
                   </p>
                 </div>

                 <div className="space-y-2">
                   {currentAnalysis.signals.slice(0, 2).map((sig, i) => (
                     <div key={i} className="flex items-start gap-2 text-[11px] bg-red-500/5 p-2 rounded border border-red-500/10">
                       <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                       </svg>
                       <span className="text-red-300/90 font-medium">{sig.title}</span>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            {/* Minor History List */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-white/30 uppercase pl-1">History</h3>
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors border ${
                    selectedItem?.id === item.id ? 'bg-white/10 border-white/10' : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      item.analysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500' :
                      item.analysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500' :
                      item.analysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500' : 'bg-primary'
                    }`} />
                    <div className="text-left">
                      <div className="text-xs font-medium">
                        {item.type === 'blink' ? 'Blink Action' : 'Transaction'}
                      </div>
                      <div className="text-[10px] text-white/40">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="mt-4 pt-3 border-t border-white/10 text-center">
        <p className="text-[10px] text-white/30">
          AI Guarding your wallet by scanning on-chain simulations.
        </p>
      </footer>
    </div>
  );
}

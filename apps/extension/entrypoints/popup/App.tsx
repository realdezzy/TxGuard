import { useState, useEffect } from 'react';
import type { TransactionAnalysis } from '@txguard/core';
import { RiskLevel } from '@txguard/core';
import Settings from './Settings';

interface HistoryItem {
  id: string;
  type: 'blink' | 'transaction' | 'browser';
  title?: string;
  url?: string;
  analysis: TransactionAnalysis;
  timestamp: number;
}

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [cluster, setCluster] = useState('devnet');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const settingsData = await browser.storage.local.get('settings');
      const settings = (settingsData.settings || {}) as Record<string, any>;
      const retentionDays = settings.historyRetentionDays || 7;
      setCluster(settings.cluster || 'devnet');
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

      const response = await browser.runtime.sendMessage({ type: 'GET_HISTORY' });
      const validHistory = (response || []).filter((item: HistoryItem) => item.timestamp > cutoffTime);

      setHistory(validHistory);
      if (validHistory.length > 0) {
        setSelectedItem(validHistory[0]);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentAnalysis = selectedItem?.analysis;

  return (
    <div className="flex flex-col h-[600px] w-[400px] bg-[#050505] text-white overflow-hidden font-sans relative">
      {/* Background Glow */}
      <div 
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000"
        style={{
          backgroundColor: currentAnalysis?.riskLevel === RiskLevel.CRITICAL ? '#ef4444' :
            currentAnalysis?.riskLevel === RiskLevel.HIGH ? '#f97316' :
            currentAnalysis?.riskLevel === RiskLevel.MEDIUM ? '#eab308' : '#22c55e'
        }}
      />

      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 relative z-10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
            <svg className="w-5 h-5 text-darker" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 18c-3.75-1-6.5-4.82-6.5-9V8.55l6.5-3.61 6.5 3.61V11c0 4.18-2.75 8-6.5 9z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">TxGuard</h1>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-1">Real-time Guardian</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[9px] bg-white/5 px-2 py-0.5 rounded-full text-white/40 border border-white/5 uppercase tracking-widest font-black">
            {cluster}
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="p-2 rounded-lg hover:bg-white/5 transition-all active:scale-95"
          >
            <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar relative z-10">
        {showSettings ? (
          <Settings onClose={() => setShowSettings(false)} />
        ) : loading ? (
          <div className="h-full flex items-center justify-center italic text-white/20 text-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <span>Scanning history...</span>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center mb-6">
               <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
               </svg>
             </div>
             <h3 className="text-white font-bold mb-1">No activity yet</h3>
             <p className="text-xs text-white/30 max-w-[200px]">TxGuard is active and watching for suspicious transactions.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Analysis */}
            {currentAnalysis && (
              <section className="space-y-4">
                 <div className="flex justify-between items-center">
                   <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Active Report</h3>
                   <div className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider shadow-sm border ${
                     currentAnalysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                     currentAnalysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                     currentAnalysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-primary/10 text-primary border-primary/20'
                   }`}>
                     {currentAnalysis.riskLevel}
                   </div>
                 </div>

                 <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full opacity-50" style={{
                     backgroundColor: currentAnalysis.riskLevel === RiskLevel.CRITICAL ? '#ef4444' :
                                     currentAnalysis.riskLevel === RiskLevel.HIGH ? '#f97316' :
                                     currentAnalysis.riskLevel === RiskLevel.MEDIUM ? '#eab308' : '#22c55e'
                   }}></div>
                   
                   <p className="text-sm leading-relaxed text-white/90 font-medium mb-4">
                     {currentAnalysis.explanation}
                   </p>

                   <div className="space-y-2">
                     {currentAnalysis.signals.slice(0, 3).map((sig, i) => (
                       <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px]">
                         <div className={`p-1.5 rounded-lg ${
                           sig.level === RiskLevel.CRITICAL ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                         }`}>
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                           </svg>
                         </div>
                         <span className="font-bold opacity-80">{sig.title}</span>
                       </div>
                     ))}
                   </div>
                 </div>
              </section>
            )}

            {/* History List */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] pl-1">History</h3>
              <div className="space-y-2 pb-8">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border group ${
                      selectedItem?.id === item.id 
                        ? 'bg-white/10 border-white/10 ring-1 ring-white/10' 
                        : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] transition-all ${
                        item.analysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500 shadow-red-500/40' :
                        item.analysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500 shadow-orange-500/40' :
                        item.analysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500 shadow-yellow-500/40' : 'bg-primary shadow-primary/40'
                      }`} />
                      <div className="text-left">
                        <div className="text-[13px] font-bold group-hover:text-white transition-colors">
                          {item.type === 'blink' ? 'Blink Interaction' : item.type === 'browser' ? 'Threat Detected' : 'Transaction Scan'}
                        </div>
                        <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mt-0.5">
                          {item.type === 'browser' && item.title
                            ? item.title.slice(0, 24) + (item.title.length > 24 ? '...' : '')
                            : new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="mt-auto px-6 py-4 border-t border-white/5 bg-black/40 backdrop-blur-md relative z-10 text-center">
        <p className="text-[10px] text-white/20 font-medium tracking-tight">
          Protected by <span className="text-white/40 font-black">TxGuard Engine v1.5</span>
        </p>
      </footer>
    </div>
  );
}

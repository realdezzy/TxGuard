import { useState, useEffect } from 'react';
import type { TransactionAnalysis, RiskSignal } from '@txguard/core';
import { RiskLevel, SignalType } from '@txguard/core';
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
  const [selectedSignal, setSelectedSignal] = useState<RiskSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [cluster, setCluster] = useState('devnet');
  const [activeTabUrl, setActiveTabUrl] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  // Sync cluster from storage when returning from settings
  useEffect(() => {
    if (showSettings) return;
    browser.storage.local.get('settings').then((data) => {
      const s = (data.settings || {}) as Record<string, any>;
      if (s.cluster) setCluster(s.cluster);
    }).catch(() => {});
  }, [showSettings]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [settingsData, tabs] = await Promise.all([
        browser.storage.local.get('settings'),
        browser.tabs.query({ active: true, currentWindow: true }),
      ]);
      const settings = (settingsData.settings || {}) as Record<string, any>;
      const days = settings.historyRetentionDays ?? 1;
      setRetentionDays(days);
      setCluster(settings.cluster || 'devnet');
      setActiveTabUrl(tabs[0]?.url ?? null);

      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
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

  const deleteItem = async (itemId: string) => {
    setDeleting(true);
    try {
      const data = await browser.storage.local.get('history');
      const all: HistoryItem[] = Array.isArray(data.history) ? data.history : [];
      const filtered = all.filter((h: HistoryItem) => h.id !== itemId);
      await browser.storage.local.set({ history: filtered });
      const updated = history.filter((h) => h.id !== itemId);
      setHistory(updated);
      if (selectedItem?.id === itemId) {
        setSelectedItem(updated.length > 0 ? updated[0] : null);
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setDeleting(false);
    }
  };

  const clearAllHistory = async () => {
    setDeleting(true);
    try {
      await browser.storage.local.set({ history: [] });
      setHistory([]);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to clear history:', err);
    } finally {
      setDeleting(false);
    }
  };

  const purgeOldHistory = async () => {
    setDeleting(true);
    try {
      const data = await browser.storage.local.get('history');
      const all: HistoryItem[] = Array.isArray(data.history) ? data.history : [];
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const kept = all.filter((h: HistoryItem) => h.timestamp > cutoffTime);
      await browser.storage.local.set({ history: kept });
      setHistory(kept);
    } catch (err) {
      console.error('Failed to purge history:', err);
    } finally {
      setDeleting(false);
    }
  };

  const seedMockData = async () => {
    const now = Date.now();
    const mockItems: HistoryItem[] = [
      {
        id: 'mock-1',
        type: 'transaction',
        url: activeTabUrl || 'https://jup.ag/swap',
        timestamp: now - 60_000,
        analysis: {
          instructions: [],
          signals: [
            { type: 'SOLPHISH_PATTERN' as any, level: 'CRITICAL' as any, title: 'SolPhish Account Authority Transfer', message: 'This transaction transfers account ownership. This is a known Solana phishing pattern.' },
            { type: 'ADDRESS_POISONING' as any, level: 'CRITICAL' as any, title: 'Address Poisoning Detected', message: 'Recipient closely mimics a known address. First and last characters match.' },
            { type: 'UNKNOWN_PROGRAM' as any, level: 'HIGH' as any, title: 'Unknown Program Interaction', message: 'Transaction interacts with 3 programs not in the trusted allowlist.' },
          ],
          simulation: { success: true, logs: [] as string[], balanceChanges: [], unitsConsumed: 45000, confidence: 'HIGH' as any, writableSigners: [] },
          riskScore: 85,
          whyScore: [],
          scoreVarianceHint: 'LOW' as any,
          riskLevel: 'CRITICAL' as any,
          recommendation: 'REJECT' as any,
          explanation: 'This transaction attempts to change the authority of your token account and sends funds to an address that mimics one of your known contacts. The combination of account authority transfer and address poisoning indicates a likely phishing attack.',
          timestamp: now - 60_000,
        },
      },
      {
        id: 'mock-2',
        type: 'browser',
        url: activeTabUrl || 'https://jukp.ag/swap',
        title: 'Fake Jupiter',
        timestamp: now - 300_000,
        analysis: {
          instructions: [],
          signals: [
            { type: 'CLICKJACKING' as any, level: 'HIGH' as any, title: 'Suspicious Page Overlay', message: 'A large transparent overlay is intercepting pointer events. This pattern is commonly used to redirect clicks.' },
            { type: 'WALLET_SPOOFING' as any, level: 'MEDIUM' as any, title: 'Wallet UI Spoofing Risk', message: 'This page shows multiple wallet-like controls but no Solana provider is available.' },
          ],
          simulation: null,
          riskScore: 55,
          whyScore: [],
          scoreVarianceHint: 'MEDIUM' as any,
          riskLevel: 'MEDIUM' as any,
          recommendation: 'CAUTION' as any,
          explanation: 'This page has suspicious overlays that could intercept clicks, and wallet-like UI elements on a site that has no legitimate Solana wallet provider. Approach with caution.',
          timestamp: now - 300_000,
        },
      },
      {
        id: 'mock-3',
        type: 'blink',
        url: 'https://blink.solflare.com/action/swap',
        timestamp: now - 3_600_000,
        analysis: {
          instructions: [],
          signals: [
            { type: 'BLINK_PHISHING' as any, level: 'HIGH' as any, title: 'Untrusted Blink Source', message: 'This Solana Action originates from a domain not in the trusted list.' },
          ],
          simulation: null,
          riskScore: 40,
          whyScore: [],
          scoreVarianceHint: 'LOW' as any,
          riskLevel: 'MEDIUM' as any,
          recommendation: 'CAUTION' as any,
          explanation: 'The Blink URL comes from an untrusted source. The embedded transaction should be reviewed carefully before signing.',
          timestamp: now - 3_600_000,
        },
      },
      {
        id: 'mock-4',
        type: 'transaction',
        url: activeTabUrl || 'https://jup.ag/swap',
        timestamp: now - 7_200_000,
        analysis: {
          instructions: [],
          signals: [],
          simulation: { success: true, logs: [] as string[], balanceChanges: [], unitsConsumed: 25000, confidence: 'HIGH' as any, writableSigners: [] },
          riskScore: 5,
          whyScore: [],
          scoreVarianceHint: 'LOW' as any,
          riskLevel: 'SAFE' as any,
          recommendation: 'APPROVE' as any,
          explanation: 'This transaction is a routine token swap on Jupiter. All programs are trusted, there are no suspicious patterns.',
          timestamp: now - 7_200_000,
        },
      },
      {
        id: 'mock-5',
        type: 'transaction',
        url: 'https://solsniper.xyz/trade',
        timestamp: now - 86_400_000,
        analysis: {
          instructions: [],
          signals: [
            { type: 'COMPUTE_BUDGET_MANIPULATION' as any, level: 'MEDIUM' as any, title: 'Elevated Priority Fee with Risk Signals', message: 'A high compute unit price was set alongside suspicious instructions. This could indicate front-running or rushing a malicious transaction.' },
            { type: 'DURABLE_NONCE' as any, level: 'MEDIUM' as any, title: 'Durable Nonce Transaction', message: 'This transaction uses a durable nonce, meaning it can be submitted at any future time.' },
          ],
          simulation: null,
          riskScore: 28,
          whyScore: [],
          scoreVarianceHint: 'LOW' as any,
          riskLevel: 'LOW' as any,
          recommendation: 'CAUTION' as any,
          explanation: 'Transaction uses an elevated priority fee and a durable nonce. While not necessarily malicious, the combination deserves attention.',
          timestamp: now - 86_400_000,
        },
      },
    ];

    await browser.storage.local.set({ history: mockItems });
    setShowDevTools(false);
    await loadHistory();
  };

  const normalizeUrl = (url: string | undefined): string => {
    if (!url) return '';
    try {
      const u = new URL(url);
      return u.origin + u.pathname;
    } catch { return url; }
  };

  const filteredHistory = showAllHistory
    ? history
    : activeTabUrl
      ? history.filter((item) => normalizeUrl(item.url) === normalizeUrl(activeTabUrl))
      : history;

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
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
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
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="p-2 rounded-lg hover:bg-white/5 transition-all active:scale-95"
            title="Dev Tools"
          >
            <svg className={`w-4 h-4 ${showDevTools ? 'text-yellow-400' : 'text-white/20'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
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
              <span>Loading...</span>
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
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
                      {currentAnalysis.signals.map((sig, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedSignal(sig)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-left hover:bg-white/10 hover:border-white/10 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <div className={`p-1.5 rounded-lg shrink-0 ${
                            sig.level === RiskLevel.CRITICAL ? 'bg-red-500/20 text-red-400' :
                            sig.level === RiskLevel.HIGH ? 'bg-orange-500/20 text-orange-400' :
                            sig.level === RiskLevel.MEDIUM ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-primary/20 text-primary'
                          }`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold opacity-80 block truncate">{sig.title}</span>
                            <span className="text-[10px] text-white/30">{sig.type.replace(/_/g, ' ')}</span>
                          </div>
                          <svg className="w-3 h-3 text-white/20 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                 </div>
              </section>
            )}

            {/* History controls */}
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] pl-1">
                {showAllHistory ? 'All History' : 'This Tab'} ({filteredHistory.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAllHistory(!showAllHistory); setSelectedItem(null); }}
                  className="text-[9px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-all"
                >
                  {showAllHistory ? 'This Tab' : 'Show All'}
                </button>
                <button
                  onClick={purgeOldHistory}
                  disabled={deleting}
                  className="text-[9px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/50 transition-all"
                  title={`Delete older than ${retentionDays}d`}
                >
                  Purge
                </button>
                <button
                  onClick={clearAllHistory}
                  disabled={deleting}
                  className="text-[9px] px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 pb-8">
              {filteredHistory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border group ${
                    selectedItem?.id === item.id 
                      ? 'bg-white/10 border-white/10 ring-1 ring-white/10' 
                      : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] shrink-0 transition-all ${
                      item.analysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500 shadow-red-500/40' :
                      item.analysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500 shadow-orange-500/40' :
                      item.analysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500 shadow-yellow-500/40' : 'bg-primary shadow-primary/40'
                    }`} />
                    <div className="text-left min-w-0">
                      <div className="text-[13px] font-bold group-hover:text-white transition-colors truncate">
                        {item.type === 'blink' ? 'Blink Interaction' : item.type === 'browser' ? 'Threat Detected' : 'Transaction Scan'}
                      </div>
                      <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mt-0.5">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <div
                      className="p-1 rounded-md hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dev Tools Panel */}
        {showDevTools && (
          <div className="mb-8 p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 animate-[fade-in_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em]">
                Dev Tools
              </h3>
              <button
                onClick={() => setShowDevTools(false)}
                className="text-white/20 hover:text-white/50 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={seedMockData}
                className="w-full py-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Seed 5 Mock History Items
              </button>
              <div className="text-[10px] text-white/20 leading-relaxed px-1">
                Seeds 5 mock entries: CRITICAL transaction, MEDIUM browser threat, MEDIUM blink, SAFE swap, LOW nonce.
                Each item has full signals, explanation, and metadata for testing the UI.
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto px-6 py-4 border-t border-white/5 bg-black/40 backdrop-blur-md relative z-10 text-center">
        <p className="text-[10px] text-white/20 font-medium tracking-tight">
          Protected by <span className="text-white/40 font-black">TxGuard</span>
        </p>
      </footer>

      {selectedSignal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedSignal(null); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[400px] max-h-[85vh] bg-[#0a0a0a] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-[txguard-pop_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <style>{`
              @keyframes txguard-pop {
                from { transform: translateY(20px) scale(0.97); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
              }
            `}</style>

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${
                  selectedSignal.level === RiskLevel.CRITICAL ? 'bg-red-500/20 text-red-400' :
                  selectedSignal.level === RiskLevel.HIGH ? 'bg-orange-500/20 text-orange-400' :
                  selectedSignal.level === RiskLevel.MEDIUM ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-primary/20 text-primary'
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-black text-white">Threat Details</h3>
              </div>
              <button
                onClick={() => setSelectedSignal(null)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/30 hover:text-white/60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[55vh] custom-scrollbar">
              <div className="p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <div className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border ${
                    selectedSignal.level === RiskLevel.CRITICAL ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    selectedSignal.level === RiskLevel.HIGH ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    selectedSignal.level === RiskLevel.MEDIUM ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-primary/10 text-primary border-primary/20'
                  }`}>
                    {selectedSignal.level}
                  </div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">
                    {selectedSignal.type.replace(/_/g, ' ')}
                  </span>
                </div>

                <h2 className="text-lg font-black leading-tight text-white">
                  {selectedSignal.title}
                </h2>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm leading-relaxed text-white/80">
                    {selectedSignal.message}
                  </p>
                </div>

                {selectedSignal.metadata && Object.keys(selectedSignal.metadata).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em]">Technical Details</h4>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                      {Object.entries(selectedSignal.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-start gap-4">
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider shrink-0">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-[11px] text-white/60 text-right break-all font-mono">
                            {typeof value === 'object' && value !== null
                              ? JSON.stringify(value, null, 0).slice(0, 120) + (JSON.stringify(value).length > 120 ? '...' : '')
                              : String(value).slice(0, 120)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentAnalysis && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[9px] text-white/20 uppercase tracking-wider font-bold mb-1">Risk Score</div>
                      <div className="text-sm font-black text-white/80">{currentAnalysis.riskScore}<span className="text-white/20 text-xs">/100</span></div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[9px] text-white/20 uppercase tracking-wider font-bold mb-1">Simulation</div>
                      <div className={`text-xs font-bold ${currentAnalysis.simulation ? 'text-primary/80' : 'text-white/20'}`}>
                        {currentAnalysis.simulation?.success ? 'Passed' : currentAnalysis.simulation ? 'Failed' : 'Unavailable'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-white/5 bg-black/20">
              <button
                onClick={() => setSelectedSignal(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-bold transition-all active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

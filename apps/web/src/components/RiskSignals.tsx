import type { RiskSignal } from '@txguard/core';
import { RiskLevel, SignalType } from '@txguard/core';
import { cleanSignalMessage } from '../utils/formatters';

interface RiskSignalsProps {
  signals: RiskSignal[];
}

export function RiskSignals({ signals }: RiskSignalsProps) {
  // Filtering and cleaning logic
  const processedSignals = signals
    .filter((sig) => {
      // 1. Remove noisy LARGE_TRANSFER if it doesn't meet the threshold or has realistic data
      // Note: The threshold in core is 10, but we double check here in case of bad metadata.
      if (sig.type === SignalType.LARGE_TRANSFER) {
        const metadata = sig.metadata as any;
        if (metadata?.transfers && Array.isArray(metadata.transfers)) {
          const maxDelta = Math.max(...metadata.transfers.map((t: any) => Math.abs(t.delta)));
          if (maxDelta < 10) return false;
        }
      }
      return true;
    })
    .map((sig) => ({
      ...sig,
      message: cleanSignalMessage(sig.message),
    }));

  // Deduplicate signals by message
  const uniqueSignals = Array.from(new Map(processedSignals.map(s => [s.message, s])).values());

  if (uniqueSignals.length === 0) return null;

  return (
    <div>
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Risk Signals Detected ({uniqueSignals.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {uniqueSignals.map((sig, i) => (
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
              <details className="mt-2">
                <summary className="text-[10px] text-white/30 cursor-pointer hover:text-white/50 transition-colors uppercase tracking-widest font-bold">
                  View Technical Metadata
                </summary>
                <div className="bg-dark/50 rounded mt-2 p-2 text-xs font-mono text-white/50 overflow-x-auto whitespace-pre custom-scrollbar">
                  {JSON.stringify(sig.metadata, null, 2)}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

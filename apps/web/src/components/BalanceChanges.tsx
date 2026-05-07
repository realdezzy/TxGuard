import type { SimulationResult } from '@txguard/core';
import { formatSol } from '../utils/formatters';

interface BalanceChangesProps {
  simulation: SimulationResult;
}

export function BalanceChanges({ simulation }: BalanceChangesProps) {
  const { balanceChanges, confidence, feePayer } = simulation;
  
  const activeChanges = balanceChanges.filter((c) => Math.abs(c.delta) > 0.000001);

  if (activeChanges.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl text-center text-white/40 text-sm italic">
        No balance changes simulated.
      </div>
    );
  }

  const formattedChanges = activeChanges.map(c => ({
    ...c,
    ...formatSol(c.token ? 0 : c.delta), // formatSol is SOL-specific, skip for SPL
    formattedAmount: c.token === 'SPL' 
      ? `${c.delta > 0 ? '+' : ''}${c.delta.toLocaleString(undefined, { maximumFractionDigits: c.decimals ?? 6 })}`
      : undefined
  }));
  
  const hasSuspiciousValues = formattedChanges.some(c => !c.token && c.suspicious);
  const displayConfidence = hasSuspiciousValues ? 'LOW' : confidence;

  // Use feePayer if available, otherwise fallback to biggest negative (heuristic)
  const userWalletAccount = feePayer || formattedChanges.reduce((prev, current) => {
    return (current.delta < prev.delta) ? current : prev;
  }, formattedChanges[0]).account;

  const userChanges = formattedChanges.filter(c => c.account === userWalletAccount);
  const counterpartyChanges = formattedChanges.filter(c => c.account !== userWalletAccount);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Balance Changes
        </h3>
        <div className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border ${
          displayConfidence === 'HIGH' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          displayConfidence === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
          'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {displayConfidence === 'LOW' ? '⚠️ Low Confidence' : `${displayConfidence} Confidence`}
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
        <div className="p-6 space-y-6">
          {/* User Wallet */}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 block mb-3">Your Wallet</span>
            <div className="space-y-2">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-2">
                <span className="font-mono text-[10px] text-white/30 block mb-1">Address</span>
                <span className="font-mono text-sm text-white/60 truncate block">{userWalletAccount}</span>
              </div>
              {userChanges.map((change, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2 bg-white/5 rounded-lg">
                  <span className="text-xs text-white/40">{change.token === 'SPL' ? `Token (${change.mint?.slice(0,4)}...)` : 'SOL'}</span>
                  <span className={`font-bold ${change.delta > 0 ? 'text-green-400' : change.delta < 0 ? 'text-red-400' : 'text-white/40'}`}>
                    {change.token === 'SPL' ? change.formattedAmount : `${change.delta > 0 ? '+' : ''}${change.formatted} SOL`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Counterparties */}
          {counterpartyChanges.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 block mb-3">Counterparties & Vaults</span>
              <div className="space-y-2">
                {counterpartyChanges.map((change, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] text-white/20 truncate max-w-[120px]">{change.account}</span>
                      <span className="text-[10px] text-white/40">{change.token === 'SPL' ? `Token (${change.mint?.slice(0,4)}...)` : 'SOL'}</span>
                    </div>
                    <span className={`font-bold text-sm ${change.delta > 0 ? 'text-green-400' : change.delta < 0 ? 'text-red-400' : 'text-white/40'}`}>
                      {change.token === 'SPL' ? change.formattedAmount : `${change.delta > 0 ? '+' : ''}${change.formatted} SOL`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

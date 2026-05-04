import type { SimulationResult, BalanceChange } from '@txguard/core';
import { formatSol } from '../utils/formatters';

interface BalanceChangesProps {
  simulation: SimulationResult;
}

export function BalanceChanges({ simulation }: BalanceChangesProps) {
  const { balanceChanges, confidence } = simulation;
  
  // Collapse zero-value changes
  const activeChanges = balanceChanges.filter((c) => Math.abs(c.delta) > 0.000001);

  if (activeChanges.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl text-center text-white/40 text-sm italic">
        No balance changes simulated.
      </div>
    );
  }

  // Check for suspicious values across all changes
  const formattedChanges = activeChanges.map(c => ({
    ...c,
    ...formatSol(c.delta)
  }));
  
  const hasSuspiciousValues = formattedChanges.some(c => c.suspicious);
  const displayConfidence = hasSuspiciousValues ? 'LOW' : confidence;

  // Simple heuristic for "Your Wallet": The first signer or the one with the largest negative delta.
  // For this exercise, we assume the first account in simulation is usually the user or we look for the biggest negative.
  const userWalletChange = formattedChanges.reduce((prev, current) => {
    return (current.delta < prev.delta) ? current : prev;
  }, formattedChanges[0]);

  const counterparties = formattedChanges.filter(c => c.account !== userWalletChange.account);

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
          {displayConfidence === 'LOW' ? '⚠️ Low Confidence (possible decoding issue)' : `${displayConfidence} Confidence`}
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
        <div className="p-6 space-y-6">
          {/* User Wallet */}
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 block mb-3">Your Wallet</span>
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
              <span className="font-mono text-sm text-white/60 truncate mr-4">{userWalletChange.account}</span>
              <span className={`font-bold text-lg ${userWalletChange.delta > 0 ? 'text-green-400' : userWalletChange.delta < 0 ? 'text-red-400' : 'text-white/40'}`}>
                {userWalletChange.delta > 0 ? '+' : ''}{userWalletChange.formatted} SOL
              </span>
            </div>
          </div>

          {/* Counterparties */}
          {counterparties.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 block mb-3">Counterparties</span>
              <div className="space-y-2">
                {counterparties.map((change, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                    <span className="font-mono text-xs text-white/40 truncate mr-4">{change.account}</span>
                    <span className={`font-bold ${change.delta > 0 ? 'text-green-400' : change.delta < 0 ? 'text-red-400' : 'text-white/40'}`}>
                      {change.delta > 0 ? '+' : ''}{change.formatted} SOL
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

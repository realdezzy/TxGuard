import type { SimulationResult } from '@txguard/core';

interface SimulationDetailsProps {
  simulation: SimulationResult | null;
}

export function SimulationDetails({ simulation }: SimulationDetailsProps) {
  if (!simulation) return null;

  return (
    <div className="mt-12 pt-8 border-t border-white/10">
      <details className="group">
        <summary className="flex justify-between items-center cursor-pointer list-none">
          <span className="text-sm font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">
            Technical Details & Simulation Logs
          </span>
          <svg className="w-5 h-5 text-white/20 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        
        <div className="mt-6 space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dark/40 p-4 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-white/30 block mb-1">Compute Used</span>
              <span className="text-sm font-mono">{simulation.unitsConsumed.toLocaleString()} CU</span>
            </div>
            <div className="bg-dark/40 p-4 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-white/30 block mb-1">Source</span>
              <span className="text-sm font-mono uppercase">{simulation.simulationSource || 'RPC'}</span>
            </div>
            <div className="bg-dark/40 p-4 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-white/30 block mb-1">Consistency</span>
              <span className="text-sm font-mono uppercase">{simulation.stateConsistencyHint || 'N/A'}</span>
            </div>
            <div className="bg-dark/40 p-4 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-white/30 block mb-1">Slot</span>
              <span className="text-sm font-mono">{simulation.slot || 'Unknown'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-white/30 block mb-2 px-1">Raw Simulation Logs</span>
            <div className="bg-darker/80 rounded-xl p-4 font-mono text-[11px] text-white/40 h-64 overflow-y-auto custom-scrollbar border border-white/5 whitespace-pre-wrap leading-relaxed">
              {simulation.logs && simulation.logs.length > 0 
                ? simulation.logs.join('\n') 
                : 'No logs available for this simulation.'}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

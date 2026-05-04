import type { ParsedInstruction } from '@txguard/core';
import { useState } from 'react';

interface InstructionSummaryProps {
  instructions: ParsedInstruction[];
}

export function InstructionSummary({ instructions }: InstructionSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (instructions.length === 0) return null;

  // Group instructions by program and type
  const groups = instructions.reduce((acc, inst) => {
    const key = `${inst.programName}:${inst.type}`;
    if (!acc[key]) {
      acc[key] = {
        count: 0,
        programName: inst.programName,
        type: inst.type,
        programId: inst.programId,
      };
    }
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { count: number; programName: string; type: string; programId: string }>);

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          What This Transaction Does
        </h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-white/40 hover:text-white/60 transition-colors uppercase tracking-widest font-bold"
        >
          {isExpanded ? 'Hide Technical Details' : 'Show Program IDs'}
        </button>
      </div>

      <div className="space-y-3">
        {Object.values(groups).map((group, i) => (
          <div key={i} className="flex flex-col bg-dark/20 p-4 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white/90">
                  {group.count > 1 ? `${group.count}× ` : ''}{group.programName === 'Unknown Program' ? 'Interaction with Unknown Program' : group.programName}
                </span>
                {group.type && group.type !== 'unknown' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase font-bold tracking-tight">
                    {group.type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-white/30 font-mono break-all">
                  Program ID: {group.programId}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

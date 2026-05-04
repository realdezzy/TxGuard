import type { TransactionAnalysis } from '@txguard/core';
import { RiskLevel } from '@txguard/core';

interface SummaryProps {
  analysis: TransactionAnalysis;
}

export function Summary({ analysis }: SummaryProps) {
  // Deduce the main intent/description from the first instruction if no explicit intent exists.
  // In our core library we added `primaryIntent` to anomalies, but it's not strictly on `TransactionAnalysis` interface yet.
  // For now we use the explanation.
  const isHighRisk = analysis.riskLevel === RiskLevel.CRITICAL || analysis.riskLevel === RiskLevel.HIGH;

  return (
    <div className="glass-panel p-8 rounded-2xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none ${
        analysis.riskLevel === RiskLevel.CRITICAL ? 'bg-red-500' :
        analysis.riskLevel === RiskLevel.HIGH ? 'bg-orange-500' :
        analysis.riskLevel === RiskLevel.MEDIUM ? 'bg-yellow-500' : 'bg-green-500'
      }`} />

      <div className="flex-shrink-0 text-center relative z-10">
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
        <h2 className="text-2xl font-bold mb-4">
          {isHighRisk ? '⚠️ High Risk Transaction' : 'Transaction Summary'}
        </h2>
        <div className="prose prose-invert prose-p:leading-relaxed prose-p:text-white/80 max-w-none bg-dark/30 p-5 rounded-xl border border-white/5">
          {analysis.explanation.split('\n').map((line, i) => (
            <p key={i} className="my-1">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

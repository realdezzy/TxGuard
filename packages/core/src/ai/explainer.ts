import type { AIProvider, TransactionAnalysis } from '../types/index.js';
import { RiskLevel } from '../types/index.js';

// Template-based fallback — always available, zero external dependencies
function templateExplanation(analysis: Omit<TransactionAnalysis, 'explanation'>): string {
  const lines: string[] = [];

  lines.push(`Transaction Analysis Summary`);
  lines.push(`Risk Score: ${analysis.riskScore}/100 (${analysis.riskLevel})`);
  lines.push(`Recommendation: ${analysis.recommendation}`);
  lines.push('');

  if (analysis.instructions.length > 0) {
    lines.push('Instructions:');
    for (const ix of analysis.instructions) {
      lines.push(`  - ${ix.programName}: ${ix.type}`);
      if (ix.data && ix.type === 'transfer') {
        const lamports = (ix.data as Record<string, number>).lamports;
        if (lamports) {
          lines.push(`    Amount: ${(lamports / 1e9).toFixed(4)} SOL`);
        }
      }
    }
    lines.push('');
  }

  if (analysis.signals.length > 0) {
    lines.push('Warnings:');
    for (const signal of analysis.signals) {
      const icon = signal.level === RiskLevel.CRITICAL ? '[!!!]' :
                   signal.level === RiskLevel.HIGH ? '[!!]' :
                   signal.level === RiskLevel.MEDIUM ? '[!]' : '[i]';
      lines.push(`  ${icon} ${signal.title}: ${signal.message}`);
    }
    lines.push('');
  }

  if (analysis.simulation) {
    if (!analysis.simulation.success) {
      lines.push(`Simulation: FAILED - ${analysis.simulation.error}`);
    } else {
      lines.push(`Simulation: SUCCESS (${analysis.simulation.unitsConsumed} compute units)`);
      if (analysis.simulation.balanceChanges.length > 0) {
        lines.push('Balance Changes:');
        for (const change of analysis.simulation.balanceChanges) {
          const direction = change.delta > 0 ? '+' : '';
          lines.push(`  ${change.account.slice(0, 8)}...: ${direction}${change.delta.toFixed(4)} SOL`);
        }
      }
    }
  }

  return lines.join('\n');
}

function buildPrompt(analysis: Omit<TransactionAnalysis, 'explanation'>): string {
  const signalDescriptions = analysis.signals
    .map((s) => `- [${s.level}] ${s.title}: ${s.message}`)
    .join('\n');

  const instructionDescriptions = analysis.instructions
    .map((ix) => `- ${ix.programName} (${ix.programId.slice(0, 8)}...): ${ix.type}`)
    .join('\n');

  return `You are a Solana transaction security analyst. Analyze this transaction and explain the risks in clear, concise language a non-technical user would understand. Be direct about dangers. Do not use markdown formatting.

Transaction Details:
Instructions:
${instructionDescriptions || 'None parsed'}

Risk Signals:
${signalDescriptions || 'None detected'}

Risk Score: ${analysis.riskScore}/100
Risk Level: ${analysis.riskLevel}
Recommendation: ${analysis.recommendation}

Simulation: ${analysis.simulation ? (analysis.simulation.success ? 'Passed' : `Failed: ${analysis.simulation.error}`) : 'Not available'}

Provide a brief (3-5 sentence) explanation of what this transaction does and whether the user should proceed. Focus on the most critical risks.`;
}

export async function explainTransaction(
  analysis: Omit<TransactionAnalysis, 'explanation'>,
  providers: AIProvider[],
): Promise<string> {
  for (const provider of providers) {
    try {
      const explanation = await provider.explain(analysis);
      if (explanation && explanation.trim().length > 0) {
        return explanation;
      }
    } catch {
      // Fall through to next provider
    }
  }

  return templateExplanation(analysis);
}

export { buildPrompt, templateExplanation };

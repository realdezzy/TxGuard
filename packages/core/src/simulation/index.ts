import {
  Connection,
  VersionedTransaction,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import type { SimulationResult, BalanceChange, RiskSignal } from '../types/index.js';
import { RiskLevel, SignalType } from '../types/index.js';

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function simulateTransaction(
  connection: Connection,
  rawTx: string | Uint8Array,
): Promise<SimulationResult> {
  const bytes = typeof rawTx === 'string' ? decodeBase64(rawTx) : rawTx;

  let simulationResponse;

  try {
    const versioned = VersionedTransaction.deserialize(bytes);
    simulationResponse = await connection.simulateTransaction(versioned, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
  } catch {
    try {
      const legacy = Transaction.from(bytes);
      simulationResponse = await connection.simulateTransaction(legacy);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Deserialization failed',
        logs: [],
        balanceChanges: [],
        unitsConsumed: 0,
      };
    }
  }

  const result = simulationResponse.value;

  if (result.err) {
    return {
      success: false,
      error: typeof result.err === 'string' ? result.err : JSON.stringify(result.err),
      logs: result.logs ?? [],
      balanceChanges: [],
      unitsConsumed: result.unitsConsumed ?? 0,
    };
  }

  const balanceChanges = parseBalanceChangesFromLogs(result.logs ?? []);

  return {
    success: true,
    logs: result.logs ?? [],
    balanceChanges,
    unitsConsumed: result.unitsConsumed ?? 0,
  };
}

function parseBalanceChangesFromLogs(logs: string[]): BalanceChange[] {
  const changes: BalanceChange[] = [];

  for (const log of logs) {
    const transferMatch = log.match(
      /Transfer: lamports (\d+), source .+?([A-Za-z0-9]{32,44}), destination .+?([A-Za-z0-9]{32,44})/,
    );
    if (transferMatch) {
      const lamports = parseInt(transferMatch[1]!, 10);
      const sol = lamports / LAMPORTS_PER_SOL;
      changes.push({
        account: transferMatch[2]!,
        before: 0,
        after: 0,
        delta: -sol,
      });
      changes.push({
        account: transferMatch[3]!,
        before: 0,
        after: 0,
        delta: sol,
      });
    }
  }

  return changes;
}

export function simulationToSignal(sim: SimulationResult): RiskSignal | null {
  if (!sim.success) {
    return {
      type: SignalType.SIMULATION_FAILURE,
      level: RiskLevel.HIGH,
      title: 'Simulation Failed',
      message: `Transaction simulation failed: ${sim.error ?? 'Unknown error'}. This transaction will likely fail on-chain.`,
      metadata: { error: sim.error, logs: sim.logs.slice(0, 5) },
    };
  }

  const largeSolTransfers = sim.balanceChanges.filter(
    (c) => Math.abs(c.delta) > 10,
  );

  if (largeSolTransfers.length > 0) {
    return {
      type: SignalType.LARGE_TRANSFER,
      level: RiskLevel.MEDIUM,
      title: 'Large SOL Transfer',
      message: `This transaction moves ${largeSolTransfers.map((t) => `${Math.abs(t.delta).toFixed(2)} SOL`).join(', ')}.`,
      metadata: { transfers: largeSolTransfers },
    };
  }

  return null;
}

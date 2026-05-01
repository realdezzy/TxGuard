import {
  Connection,
  VersionedTransaction,
  Transaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import type { SimulationResult, BalanceChange, RiskSignal } from '../types/index.js';
import { RiskLevel, SignalType } from '../types/index.js';

const TOKEN_ACCOUNT_SIZE = 165;
const RENT_EXEMPT_MINIMUM_LAMPORTS = 2_039_280;

export interface SimulateOptions {
  timeoutMs?: number;
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extractWritableAddresses(bytes: Uint8Array): string[] {
  try {
    const versioned = VersionedTransaction.deserialize(bytes);
    const msg = versioned.message;
    return msg.staticAccountKeys
      .filter((_, i) => msg.isAccountWritable(i))
      .map((k) => k.toBase58());
  } catch {
    try {
      const legacy = Transaction.from(bytes);
      const compiled = legacy.compileMessage();
      return compiled.accountKeys
        .filter((_, i) => compiled.isAccountWritable(i))
        .map((k) => k.toBase58());
    } catch {
      return [];
    }
  }
}

async function fetchPreBalances(
  connection: Connection,
  addresses: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (addresses.length === 0) return map;
  try {
    const pubkeys = addresses.map((a) => new PublicKey(a));
    const infos = await connection.getMultipleAccountsInfo(pubkeys);
    for (let i = 0; i < addresses.length; i++) {
      map.set(addresses[i]!, infos[i]?.lamports ?? 0);
    }
  } catch {
    // Pre-balance fetch is best-effort; deltas will not be reported if unavailable
  }
  return map;
}

export async function simulateTransaction(
  connection: Connection,
  rawTx: string | Uint8Array,
  options?: SimulateOptions,
): Promise<SimulationResult> {
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const bytes = typeof rawTx === 'string' ? decodeBase64(rawTx) : rawTx;

  const withTimeout = <T>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Simulation timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

  let transaction: VersionedTransaction | Transaction;
  let isVersioned = false;

  try {
    transaction = VersionedTransaction.deserialize(bytes);
    isVersioned = true;
  } catch {
    try {
      transaction = Transaction.from(bytes);
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

  const writableAddresses = extractWritableAddresses(bytes);
  const preBalances = await fetchPreBalances(connection, writableAddresses);

  let simulationResponse: Awaited<ReturnType<Connection['simulateTransaction']>>;

  try {
    simulationResponse = await withTimeout(
      isVersioned
        ? connection.simulateTransaction(transaction as VersionedTransaction, {
            sigVerify: false,
            replaceRecentBlockhash: true,
            accounts: writableAddresses.length > 0
              ? { encoding: 'base64', addresses: writableAddresses }
              : undefined,
          })
        : connection.simulateTransaction(transaction as Transaction),
    );
  } catch (err) {
    throw new Error(
      `RPC simulation unavailable: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }

  const result = simulationResponse.value;

  if (result.err) {
    return {
      success: false,
      error: typeof result.err === 'string' ? result.err : JSON.stringify(result.err),
      logs: result.logs ?? [],
      balanceChanges: [],
      unitsConsumed: result.unitsConsumed ?? 0,
      slot: simulationResponse.context.slot,
    };
  }

  const balanceChanges: BalanceChange[] = [];
  const accountResults = (result as { accounts?: ({ lamports?: number; data?: [string, string] | string; owner?: string } | null)[] | null }).accounts;

  if (accountResults) {
    for (let i = 0; i < writableAddresses.length; i++) {
      const address = writableAddresses[i]!;
      const acctResult = accountResults[i];
      if (!acctResult) continue;

      const postLamports = acctResult.lamports ?? null;
      if (postLamports !== null) {
        const preLamports = preBalances.get(address) ?? 0;
        const delta = (postLamports - preLamports) / LAMPORTS_PER_SOL;
        if (delta !== 0) {
          balanceChanges.push({
            account: address,
            before: preLamports / LAMPORTS_PER_SOL,
            after: postLamports / LAMPORTS_PER_SOL,
            delta,
          });
        }
      }

      // Decode SPL token account data (165 bytes, base64-encoded)
      const rawData = acctResult.data;
      if (rawData && Array.isArray(rawData) && rawData[1] === 'base64' && typeof rawData[0] === 'string') {
        try {
          const decoded = decodeBase64(rawData[0]);
          if (decoded.length >= TOKEN_ACCOUNT_SIZE) {
            const mint = new PublicKey(decoded.slice(0, 32)).toBase58();
            const owner = new PublicKey(decoded.slice(32, 64)).toBase58();
            const amount = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength).getBigUint64(64, true);

            balanceChanges.push({
              account: address,
              before: 0,
              after: Number(amount),
              delta: Number(amount),
              token: 'SPL',
              mint,
              owner,
            });
          }
        } catch {
          // Not a valid token account; skip
        }
      }
    }
  }

  return {
    success: true,
    logs: result.logs ?? [],
    balanceChanges,
    unitsConsumed: result.unitsConsumed ?? 0,
    slot: simulationResponse.context.slot,
    replaceRecentBlockhash: isVersioned ? true : undefined,
  };
}

export function simulationToSignal(
  sim: SimulationResult,
  largeTransferThresholdSol = 10,
): RiskSignal | null {
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
    (c) => Math.abs(c.delta) > largeTransferThresholdSol,
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

  // NFT transfer detection: SPL token balance change of exactly 1 (indivisible)
  const nftTransfers = sim.balanceChanges.filter(
    (c) => c.token === 'SPL' && Math.abs(c.delta) === 1,
  );
  if (nftTransfers.length > 0) {
    return {
      type: SignalType.LARGE_TRANSFER,
      level: RiskLevel.MEDIUM,
      title: 'NFT Transfer Detected',
      message: `This transaction transfers ${nftTransfers.length} NFT(s). Verify the recipient.`,
      metadata: { nftTransfers },
    };
  }

  // Rent drain detection: SOL delta matching token account rent-exempt minimum
  const rentDrains = sim.balanceChanges.filter(
    (c) => !c.token && Math.abs(c.delta * LAMPORTS_PER_SOL - RENT_EXEMPT_MINIMUM_LAMPORTS) < 1000,
  );
  if (rentDrains.length > 0) {
    return {
      type: SignalType.LARGE_TRANSFER,
      level: RiskLevel.LOW,
      title: 'Token Account Rent Reclaimed',
      message: `This transaction reclaims rent from ${rentDrains.length} token account(s).`,
      metadata: { rentDrains },
    };
  }

  return null;
}

export function simulationUnavailableToSignal(error: unknown): RiskSignal {
  const message = error instanceof Error ? error.message : 'Unknown simulation error';

  return {
    type: SignalType.SIMULATION_UNAVAILABLE,
    level: RiskLevel.MEDIUM,
    title: 'Simulation Unavailable',
    message:
      'TxGuard could not simulate this transaction. Treat the result as incomplete and verify the transaction carefully before signing.',
    metadata: { error: message },
  };
}

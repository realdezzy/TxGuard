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

interface TokenAccountSnapshot {
  mint: string;
  owner: string;
  amount: number;
}

interface AccountSnapshot {
  lamports: number;
  token?: TokenAccountSnapshot;
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

function decodeTokenAccountData(data: Uint8Array): TokenAccountSnapshot | null {
  if (data.length < TOKEN_ACCOUNT_SIZE) return null;
  try {
    const mint = new PublicKey(data.slice(0, 32)).toBase58();
    const owner = new PublicKey(data.slice(32, 64)).toBase58();
    const amount = new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(64, true);
    return { mint, owner, amount: Number(amount) };
  } catch {
    return null;
  }
}

function decodeAccountData(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data) && data[1] === 'base64' && typeof data[0] === 'string') {
    return decodeBase64(data[0]);
  }
  return null;
}

async function fetchPreAccountSnapshots(
  connection: Connection,
  addresses: string[],
): Promise<Map<string, AccountSnapshot>> {
  const map = new Map<string, AccountSnapshot>();
  if (addresses.length === 0) return map;
  try {
    const pubkeys = addresses.map((a) => new PublicKey(a));
    const infos = await connection.getMultipleAccountsInfo(pubkeys);
    for (let i = 0; i < addresses.length; i++) {
      const info = infos[i];
      const decoded = info ? decodeAccountData(info.data) : null;
      const token = decoded ? decodeTokenAccountData(decoded) ?? undefined : undefined;
      map.set(addresses[i]!, {
        lamports: info?.lamports ?? 0,
        token,
      });
    }
  } catch {
    // Pre-account fetch is best-effort; deltas will not be reported if unavailable
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
        confidence: 'LOW',
        writableSigners: [],
      };
    }
  }

  const writableAddresses = extractWritableAddresses(bytes);
  const preAccountSnapshots = await fetchPreAccountSnapshots(connection, writableAddresses);
  const txMetadata = getTxMetadata(bytes);

  let simulationResponse: Awaited<ReturnType<Connection['simulateTransaction']>>;
  let currentSlot: number | null = null;

  try {
    const [simRes, slotRes] = await Promise.all([
      withTimeout(
        isVersioned
          ? connection.simulateTransaction(transaction as VersionedTransaction, {
              sigVerify: false,
              replaceRecentBlockhash: true,
              accounts: writableAddresses.length > 0
                ? { encoding: 'base64', addresses: writableAddresses }
                : undefined,
            })
          : connection.simulateTransaction(transaction as Transaction),
      ),
      withTimeout(
        typeof connection.getSlot === 'function' 
          ? connection.getSlot() 
          : Promise.reject(new Error('getSlot not available'))
      ).catch(() => null)
    ]);
    simulationResponse = simRes;
    currentSlot = slotRes;
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
      confidence: 'LOW',
      slot: simulationResponse.context.slot,
      simulationSource: 'rpc',
      stateConsistencyHint: 'recent',
      feePayer: txMetadata.feePayer,
      writableSigners: txMetadata.writableSigners,
    };
  }

  const balanceChanges: BalanceChange[] = [];
  const accountResults = (result as { accounts?: ({ lamports?: number; data?: [string, string] | string; owner?: string } | null)[] | null }).accounts;

  if (accountResults) {
    const mintsToFetch: string[] = [];
    const rawChanges: { address: string; acctResult: any; postToken: TokenAccountSnapshot | null }[] = [];

    for (let i = 0; i < writableAddresses.length; i++) {
      const address = writableAddresses[i]!;
      const acctResult = accountResults[i];
      if (!acctResult) continue;

      const decodedPostData = decodeAccountData(acctResult.data);
      const postToken = decodedPostData ? decodeTokenAccountData(decodedPostData) : null;
      if (postToken) {
        mintsToFetch.push(postToken.mint);
      }
      rawChanges.push({ address, acctResult, postToken });
    }

    const mintDecimals = await fetchMintDecimals(connection, mintsToFetch);

    for (const { address, acctResult, postToken } of rawChanges) {
      const postLamports = acctResult.lamports ?? null;
      if (postLamports !== null) {
        const preLamports = preAccountSnapshots.get(address)?.lamports ?? 0;
        const delta = (postLamports - preLamports) / LAMPORTS_PER_SOL;
        if (delta !== 0) {
          balanceChanges.push({
            account: address,
            before: preLamports / LAMPORTS_PER_SOL,
            after: postLamports / LAMPORTS_PER_SOL,
            delta,
            decimals: 9,
            symbol: 'SOL',
          });
        }
      }

      if (postToken) {
        const preToken = preAccountSnapshots.get(address)?.token;
        const beforeRaw = preToken?.mint === postToken.mint ? preToken.amount : 0;
        const afterRaw = postToken.amount;
        const deltaRaw = afterRaw - beforeRaw;

        if (deltaRaw !== 0) {
          const decimals = mintDecimals.get(postToken.mint) ?? 0;
          const factor = Math.pow(10, decimals);
          balanceChanges.push({
            account: address,
            before: beforeRaw / factor,
            after: afterRaw / factor,
            delta: deltaRaw / factor,
            token: 'SPL',
            mint: postToken.mint,
            owner: postToken.owner,
            decimals,
          });
        }
      }
    }
  }

  const hasAccounts = !!accountResults && accountResults.length > 0;
  const hasBalanceData = balanceChanges.length > 0;
  const usedBlockhashReplace = isVersioned;

  let confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  if (hasAccounts && hasBalanceData && !usedBlockhashReplace) {
    confidence = 'HIGH';
  } else if (hasAccounts || hasBalanceData) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  let stateConsistencyHint: 'recent' | 'slightly_stale' | 'stale' = 'recent';
  const simSlot = simulationResponse.context.slot;
  if (currentSlot && simSlot) {
    const diff = currentSlot - simSlot;
    if (diff > 50) {
      stateConsistencyHint = 'stale';
    } else if (diff > 10) {
      stateConsistencyHint = 'slightly_stale';
    }
  }

  return {
    success: true,
    logs: result.logs ?? [],
    balanceChanges,
    unitsConsumed: result.unitsConsumed ?? 0,
    confidence,
    slot: simulationResponse.context.slot,
    replaceRecentBlockhash: isVersioned ? true : undefined,
    simulationSource: 'rpc',
    stateConsistencyHint,
    feePayer: txMetadata.feePayer,
    writableSigners: txMetadata.writableSigners,
  };
}

function getTxMetadata(bytes: Uint8Array): { feePayer?: string; writableSigners: string[] } {
  try {
    const versioned = VersionedTransaction.deserialize(bytes);
    const msg = versioned.message;
    const feePayer = msg.staticAccountKeys[0]?.toBase58();
    const writableSigners = msg.staticAccountKeys
      .filter((_, i) => msg.isAccountSigner(i) && msg.isAccountWritable(i))
      .map((k) => k.toBase58());
    return { feePayer, writableSigners };
  } catch {
    try {
      const legacy = Transaction.from(bytes);
      return {
        feePayer: legacy.feePayer?.toBase58(),
        writableSigners: legacy.instructions
          .flatMap((ix) => ix.keys)
          .filter((k) => k.isSigner && k.isWritable)
          .map((k) => k.pubkey.toBase58()),
      };
    } catch {
      return { writableSigners: [] };
    }
  }
}

async function fetchMintDecimals(connection: Connection, mints: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniqueMints = [...new Set(mints)];
  if (uniqueMints.length === 0) return map;
  
  try {
    const pubkeys = uniqueMints.map((m) => new PublicKey(m));
    const infos = await connection.getMultipleAccountsInfo(pubkeys);
    for (let i = 0; i < pubkeys.length; i++) {
      const info = infos[i];
      if (info && info.data.length >= 44) {
        // Mint decimals are at byte 44 in SPL Token Mint account
        const decimals = info.data[44];
        if (decimals !== undefined) {
          map.set(uniqueMints[i]!, decimals);
        }
      }
    }
  } catch {
    // Best effort
  }
  return map;
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
      metadata: { error: sim.error, logs: sim.logs.slice(0, 5), simulationConfidence: sim.confidence },
    };
  }

  const largeSolTransfers = sim.balanceChanges.filter(
    (c) => !c.token && Math.abs(c.delta) > largeTransferThresholdSol,
  );

  if (largeSolTransfers.length > 0) {
    return {
      type: SignalType.LARGE_TRANSFER,
      level: RiskLevel.MEDIUM,
      title: 'Large SOL Transfer',
      message: `This transaction moves ${largeSolTransfers.map((t) => `${Math.abs(t.delta).toFixed(2)} SOL`).join(', ')}.`,
      metadata: { transfers: largeSolTransfers, simulationConfidence: sim.confidence },
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
      metadata: { nftTransfers, simulationConfidence: sim.confidence },
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
      metadata: { rentDrains, simulationConfidence: sim.confidence },
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

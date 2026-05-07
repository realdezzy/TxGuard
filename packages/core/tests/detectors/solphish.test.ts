import { describe, expect, it } from 'vitest';
import { RiskLevel, SignalType, type ParsedInstruction, type SimulationResult } from '../../src/types/index.js';
import { detectSolPhish } from '../../src/detectors/solphish.js';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function makeIx(overrides: Partial<ParsedInstruction>): ParsedInstruction {
  return {
    programId: SYSTEM_PROGRAM,
    programName: 'System Program',
    type: 'transfer',
    accounts: ['from', 'to'],
    accountMeta: [
      { address: 'from', isSigner: true, isWritable: true },
      { address: 'to', isSigner: false, isWritable: true },
    ],
    data: { from: 'from', to: 'to', lamports: 1_000 },
    ...overrides,
  };
}

function makeSimulation(overrides: Partial<SimulationResult>): SimulationResult {
  return {
    success: true,
    logs: [],
    balanceChanges: [],
    unitsConsumed: 0,
    confidence: 'HIGH',
    ...overrides,
  };
}

describe('detectSolPhish', () => {
  it('emits AAT for System assign instructions', () => {
    const { signals } = detectSolPhish([
      makeIx({
        type: 'assign',
        accounts: ['victimWallet', 'phishingProgram'],
        data: { account: 'victimWallet', owner: 'phishingProgram' },
      }),
    ]);

    expect(signals).toEqual([
      expect.objectContaining({
        type: SignalType.SOLPHISH_PATTERN,
        level: RiskLevel.CRITICAL,
        metadata: expect.objectContaining({ solphishKind: 'AAT' }),
      }),
    ]);
  });

  it('emits AAT for token account owner setAuthority', () => {
    const { signals } = detectSolPhish([
      makeIx({
        programId: TOKEN_PROGRAM,
        programName: 'Token Program',
        type: 'setAuthority',
        accounts: ['tokenAccount', 'currentOwner', 'newOwner'],
        data: { instructionIndex: 6, authorityType: 2 },
      }),
    ]);

    expect(signals[0]).toMatchObject({
      type: SignalType.SOLPHISH_PATTERN,
      level: RiskLevel.CRITICAL,
      metadata: { solphishKind: 'AAT', newAuthority: 'newOwner' },
    });
  });

  it('emits ISA for transfers to system-account-like vanity addresses', () => {
    const { signals } = detectSolPhish([
      makeIx({
        data: {
          from: 'victim',
          to: 'CompuV3LmCTW7AGFakeSystem111111111111',
          lamports: 1_000,
        },
      }),
    ]);

    expect(signals[0]).toMatchObject({
      type: SignalType.SOLPHISH_PATTERN,
      level: RiskLevel.HIGH,
      metadata: {
        solphishKind: 'ISA',
        recipient: 'CompuV3LmCTW7AGFakeSystem111111111111',
      },
    });
  });

  it('does not emit ISA for official system accounts', () => {
    const { signals } = detectSolPhish([
      makeIx({
        data: {
          from: 'victim',
          to: 'ComputeBudget111111111111111111111111111111',
          lamports: 1_000,
        },
      }),
    ]);

    expect(signals).toHaveLength(0);
  });

  it('emits high STMT when multiple transfers fully drain multiple assets', () => {
    const transfers = [
      makeIx({ accounts: ['victim', 'attacker1'], data: { from: 'victim', to: 'attacker1' } }),
      makeIx({ accounts: ['victim', 'attacker2'], data: { from: 'victim', to: 'attacker2' } }),
      makeIx({ accounts: ['victim', 'attacker3'], data: { from: 'victim', to: 'attacker3' } }),
    ];
    const simulation = makeSimulation({
      balanceChanges: [
        { account: 'asset1', before: 10, after: 0, delta: -10 },
        { account: 'asset2', before: 5, after: 0, delta: -5, token: 'SPL', mint: 'mint1' },
      ],
    });

    const { signals } = detectSolPhish(transfers, simulation);
    const stmt = signals.find((signal) => signal.metadata?.solphishKind === 'STMT');

    expect(stmt).toMatchObject({
      level: RiskLevel.HIGH,
      metadata: { drainedAssetCount: 2, balanceEvidenceComplete: true },
    });
  });

  it('downgrades STMT when balance evidence is unavailable', () => {
    const transfers = [
      makeIx({ accounts: ['victim', 'attacker1'] }),
      makeIx({ accounts: ['victim', 'attacker2'] }),
      makeIx({ accounts: ['victim', 'attacker3'] }),
    ];

    const { signals } = detectSolPhish(transfers, null);
    const stmt = signals.find((signal) => signal.metadata?.solphishKind === 'STMT');

    expect(stmt).toMatchObject({
      level: RiskLevel.LOW,
      metadata: { drainedAssetCount: 0, balanceEvidenceComplete: false },
    });
  });

  it('suppresses STMT in known market context', () => {
    const transfers = [
      makeIx({ accounts: ['victim', 'market1'] }),
      makeIx({ accounts: ['victim', 'market2'] }),
      makeIx({ accounts: ['victim', 'market3'] }),
      makeIx({
        programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
        programName: 'Jupiter v6',
        type: 'unknown',
      }),
    ];

    const { signals } = detectSolPhish(transfers);

    expect(signals.filter((signal) => signal.metadata?.solphishKind === 'STMT')).toHaveLength(0);
  });
});

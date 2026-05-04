# TxGuard Scoring Weights & Thresholds

> This file is generated from values in `scoring.ts`. Do not edit manually.

**Version:** 1.1.0

## Signal Weights

Source: `SIGNAL_WEIGHTS` in `packages/core/src/risk/scoring.ts`

| Signal | Weight |
|---|---|
| `ADDRESS_POISONING` | 40 |
| `DURABLE_NONCE` | 30 |
| `AUTHORITY_CHANGE` | 20 |
| `UNKNOWN_PROGRAM` | 10 |
| `BLINK_PHISHING` | 35 |
| `LARGE_TRANSFER` | 5 |
| `SIMULATION_FAILURE` | 25 |
| `SIMULATION_UNAVAILABLE` | 35 |
| `TOKEN_APPROVAL` | 30 |
| `TOKEN_REVOCATION` | 5 |
| `TOKEN_ACCOUNT_CLOSURE` | 25 |
| `TOKEN_ACCOUNT_FREEZE` | 25 |
| `CLICKJACKING` | 45 |
| `WALLET_SPOOFING` | 35 |
| `COMPUTE_BUDGET_MANIPULATION` | 15 |

## Risk Level Multipliers

Source: `LEVEL_MULTIPLIERS` in `packages/core/src/risk/scoring.ts`

| Risk Level | Multiplier |
|---|---|
| SAFE | 0 |
| LOW | 0.25 |
| MEDIUM | 0.5 |
| HIGH | 0.75 |
| CRITICAL | 1.0 |

## Simulation Confidence Multipliers

Simulation-derived signals (`SIMULATION_FAILURE`, `SIMULATION_UNAVAILABLE`, `LARGE_TRANSFER`) are further scaled by confidence:

| Confidence | Multiplier |
|---|---|
| HIGH | 1.0 |
| MEDIUM | 0.7 |
| LOW | 0.4 |

## Score Thresholds

| Score Range | Risk Level | Recommendation |
|---|---|---|
| >= 80 | CRITICAL | REJECT |
| >= 60 | HIGH | REJECT |
| >= 35 | MEDIUM | CAUTION |
| >= 25 | LOW | CAUTION |
| >= 15 | LOW | APPROVE |
| < 15 | SAFE | APPROVE |

## Known Limitations (v1.1.0)

- Benchmark corpus is partially synthetic. Real-world labeled drainer payloads are being sourced (Blowfish > on-chain collection > community reports).
- Writable pattern detector fires on 3+ third-party writable accounts. False positives on DEX aggregators are being addressed by narrowing to intent-correlated patterns.
- Simulation confidence downgrades are conservative. Versioned transactions always use `replaceRecentBlockhash` which caps confidence at MEDIUM.

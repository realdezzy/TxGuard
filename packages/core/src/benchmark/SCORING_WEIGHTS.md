# TxGuard Scoring Weights & Thresholds

**Version:** 1.0.0
**Last Updated:** May 1, 2026

This document tracks the rationale and values for the deterministic safety engine scoring.

## Signal Weights

| Signal | Weight | Rationale |
|---|---|---|
| `ADDRESS_POISONING` | 40 | High likelihood of intent to deceive, but could be user error (copying wrong address). |
| `DURABLE_NONCE` | 30 | Rare in normal usage, often used by drainers to delay signature submission. |
| `TOKEN_APPROVAL` | 35 | Severe risk if amount is unlimited or recipient is untrusted. |
| `TOKEN_REVOCATION` | -10 | Protective action, reduces risk score. |
| `TOKEN_ACCOUNT_CLOSURE` | 20 | Normal for dust collection, but high risk if sweeping many accounts. |
| `TOKEN_ACCOUNT_FREEZE` | 25 | Can be used maliciously to lock user funds before a drain. |
| `AUTHORITY_CHANGE` | 45 | Transferring ownership or mint authority is almost always critical outside of specific DeFi actions. |
| `SIMULATION_FAILURE` | 35 | Transactions that fail simulation are inherently risky to sign. |
| `SIMULATION_UNAVAILABLE` | 35 | Lack of visibility increases risk. |
| `LARGE_TRANSFER` | 20 | Context-dependent, amplifies existing signals. |
| `UNKNOWN_PROGRAM` | 15 | interacting with unverified or obscure contracts. |
| `COMPUTE_BUDGET_MANIPULATION` | 15 | Often used by drainers to outbid legitimate transactions during a sweep. |
| `WALLET_SPOOFING` | 100 | Unambiguous browser-level threat (phishing). |
| `CLICKJACKING` | 100 | Unambiguous browser-level threat (UI redressing). |
| `BLINK_PHISHING` | 80 | Malicious Actions payload. |

## Multipliers by Level

| Risk Level | Multiplier |
|---|---|
| INFO | 0 |
| LOW | 0.1 |
| MEDIUM | 0.5 |
| HIGH | 1.0 |
| CRITICAL | 2.0 |

## Recommendation Thresholds

- **REJECT**: Score >= 50
- **CAUTION**: Score >= 25
- **APPROVE**: Score < 25

## Known Limitations (v1.0.0)

- Benchmark corpus is currently synthetic. We need real-world labeled drainer payloads to tune precision/recall.
- Writable pattern detector (which emits `AUTHORITY_CHANGE`) is highly sensitive and may false-positive on complex DeFi aggregators.

# TxGuard Production Implementation Plan V2

## Goal

Move TxGuard from prototype to production candidate by closing the highest-risk gaps found during review:

- The repository must build, lint, and test cleanly.
- The extension signing path must produce deterministic allow/block behavior without timeouts on normal transactions.
- Production API exposure must require an authentication boundary.
- SolPhishHunter-style transaction patterns must be represented as deterministic signals.
- Simulation and parsed metadata gaps must be explicit instead of silently lowering confidence.

## Priority 0: Build and Release Gate

Tasks:

- Fix TypeScript unused-variable blockers in API and web.
- Keep `pnpm build`, `pnpm lint`, and `pnpm test` green before widening scope.
- Add CI checks for build, lint, tests, extension zip, and benchmark when corpus data is ready.

Acceptance criteria:

- Root build, lint, and test scripts pass.
- Build failures block release.

## Priority 1: Extension Signing Correctness

Tasks:

- Make background transaction analysis return an explicit approval decision.
- Ensure content script always posts a matching `TXGUARD_RESULT` for valid analysis requests.
- Treat API/network/timeout failures as blocked with clear error metadata.
- Pass configured cluster and sensitivity to the API.
- Add integration tests for low-risk approval, high-risk overlay decision, and API failure rejection.

Acceptance criteria:

- Benign transactions do not hang waiting for a result.
- High-risk transactions require explicit user confirmation.
- Failed analysis does not allow signing by default.

## Priority 2: API Production Boundary

Tasks:

- Require `API_KEY` in `NODE_ENV=production`.
- Keep constant-time key comparison.
- Include auth and rate-limit tests.
- Replace in-memory rate limiting with Redis-backed or edge-provider rate limiting before multi-instance deployment.

Acceptance criteria:

- API refuses to boot in production without a strong API key.
- Unauthorized analysis and Blink requests return `401`.
- Rate limits remain effective across production replicas.

## Priority 3: SolPhishHunter Deterministic Detector

Implement the three SolPhishHunter classes as deterministic signals:

- STMT: Single Transaction with Multiple Transfers.
- AAT: Account Authority Transfer.
- ISA: Impersonation of System Accounts.

Tasks:

- Add SolPhish signal typing and scoring.
- Add a `solphish` detector module.
- Detect AAT from System `assign` and SPL `setAuthority` with `authorityType === 2`.
- Detect ISA from transfers to suspicious vanity system-account-like recipients such as `Compu*` and `*11111`, while excluding official system accounts.
- Detect STMT from multiple transfer instructions and, when trustworthy balance deltas exist, multiple fully drained assets.
- Add market-prerequisite suppression hooks for known market counterparties and market logs.
- Add table-driven tests for benign multi-transfer, authority transfer, and system impersonation.

Acceptance criteria:

- Each SolPhish class emits auditable metadata.
- STMT without reliable balance data is downgraded or marked incomplete, not overclaimed.
- Tests lock expected severity for representative benign and malicious-shaped cases.

## Priority 4: Simulation and Balance Fidelity

Tasks:

- Capture SPL token pre/post balances instead of treating post amount as delta.
- Surface fee payer, writable account SOL deltas, token mint, token owner, decimals, and account closure rent effects.
- Mark ALT lookup failures, missing account snapshots, and stale simulation as explicit confidence metadata.
- Add mocked RPC tests for versioned transactions with lookup tables and token account deltas.

Acceptance criteria:

- SOL and SPL deltas are accurate for common transfer, swap, approval, and closure flows.
- Missing simulation data affects score variance and user-facing explanation.

## Priority 5: Browser Protection Hardening

Tasks:

- Move browser detector logic into testable pure helpers.
- Execute real detector helpers against fixture DOMs instead of duplicated test logic.
- Enforce trusted origins consistently before initial scan.
- Add critical browser threat interruption before wallet interaction.
- Store history by configured retention days and count.

Acceptance criteria:

- Fixture tests validate the production detector path.
- Critical browser signals block or interrupt signing until user acts.
- Privacy disclosure matches inspected and retained data.

## Priority 6: Calibration and Release Evidence

Tasks:

- Build labeled transaction and browser fixture corpora.
- Add benchmark output to CI.
- Version detector rules and scoring weights.
- Track precision, recall, false positive rate, and false negative rate by signal.

Acceptance criteria:

- Release notes include benchmark results.
- User-facing claims are limited to measured guarantees.

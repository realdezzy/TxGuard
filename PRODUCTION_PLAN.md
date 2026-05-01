# TxGuard Production Implementation Plan

## Product Goal

TxGuard should be a deterministic-first wallet safety layer for Solana. It should inspect transaction payloads, Blink actions, and browser interaction context before a user signs, then present clear approve/caution/reject guidance.

AI is allowed to explain findings, but AI must not be the source of truth for blocking or scoring decisions.

## Current Baseline

Implemented today:

- Monorepo apps: core analysis package, API, web app, and browser extension.
- Transaction parsing for legacy/versioned transaction containers.
- System Program parsing for transfer and durable nonce.
- Selected SPL Token parsing for approve, setAuthority, mintTo, burn, and closeAccount.
- Deterministic signals for address poisoning, durable nonce, token authority change, token delegate approval, unknown program, Blink source trust, simulation failure, large SOL movement, clickjacking, and wallet UI spoofing.
- Extension interception of `signTransaction`.
- Browser threat detection for framed pages, suspicious overlays, click-target mismatch, and wallet-like spoofing controls.
- Redis-backed best-effort API cache.
- API startup configuration validation.
- Request ID propagation and structured request logging.
- In-memory rate limiting for analysis and Blink routes.
- Liveness and readiness health endpoints.
- Template explanation fallback when AI providers are unavailable.
- Build, lint, and focused core tests are passing.

## Production Principles

- Deterministic rules decide risk. AI explains deterministic evidence only.
- Every risk signal must include enough metadata to audit why it fired.
- Unknown or unavailable data should be explicit. Do not silently treat missing simulation or missing account metadata as safe.
- Blocking rules must be calibrated with real false-positive and false-negative data before strong user-facing claims.
- Extension behavior must favor privacy: inspect only what is required, store only short-lived local history, and disclose what is inspected.

## Phase 1: Safety Engine Completeness

Goal: make the core analyzer materially useful against common Solana drainer patterns.

### Transaction Parser

Tasks:

- Decode all System Program instructions used in wallet flows.
- Decode SPL Token and Token-2022 instructions:
  - approve
  - approveChecked
  - revoke
  - setAuthority
  - freezeAccount
  - thawAccount
  - closeAccount
  - mintTo
  - mintToChecked
  - burn
  - burnChecked
  - transfer
  - transferChecked
  - syncNative
- Decode Associated Token Account create/createIdempotent/recoverNested instructions.
- Decode Compute Budget instructions so priority-fee and compute-unit manipulation are visible.
- Resolve Address Lookup Table account indexes for versioned transactions.
- Preserve account metadata per parsed instruction:
  - signer
  - writable
  - readonly
  - source index
  - program id

Acceptance criteria:

- Unit tests cover every decoded instruction type.
- Unknown instruction parsing never throws; it returns `unknown` with program id and raw instruction index where possible.
- Versioned transactions with lookup tables preserve correct program and account mapping.

### Deterministic Detectors

Tasks:

- Detect unlimited or high-value token delegate approvals.
- Detect revocation as a positive/low-risk signal so users are not warned unnecessarily.
- Detect token account close operations where the destination is not controlled by the signer. Status: partially implemented as an explicit closure signal; ownership validation still pending.
- Detect token account freezes. Status: implemented as an explicit freeze signal.
- Detect mint/freeze authority changes and classify by authority type.
- Detect suspicious signer/writable patterns, especially writable token accounts controlled by third parties.
- Detect suspicious compute budget use when paired with other high-risk signals.
- Add explicit `SIMULATION_UNAVAILABLE` separate from `SIMULATION_FAILURE`. Status: implemented.

Acceptance criteria:

- Each detector has table-driven tests for benign, suspicious, and malicious-shaped cases.
- Every high/critical signal has clear metadata and a plain-English message.
- Scoring tests lock expected scores for representative transaction bundles.

## Phase 2: Simulation and Balance Fidelity

Goal: move from log parsing to reliable asset-delta analysis.

Tasks:

- Use RPC simulation fields and account snapshots where possible instead of parsing logs only.
- Capture SOL balance deltas for fee payer and writable accounts.
- Capture SPL token account pre/post balances.
- Identify NFT transfers using token amount and mint metadata where available.
- Detect rent drains from token account creation/closure.
- Add a simulation timeout and retry policy.
- Surface RPC cluster, slot, and blockhash replacement status in metadata.

Acceptance criteria:

- Analyzer reports SOL and SPL balance changes for common transfer/swap/approval flows.
- Failed simulation, unavailable simulation, and successful simulation are distinct states.
- Tests cover simulation mapping using mocked RPC responses.

## Phase 3: Browser Protection

Goal: make the extension useful against browser-layer attacks, not just transaction-layer attacks.

### Clickjacking

Tasks:

- Keep current detectors for framing, overlays, and click-target mismatch.
- Add fixture-based tests with representative malicious DOMs.
- Add rate limiting so one page cannot spam browser-threat history.
- Show a visible warning overlay for critical browser threats before allowing wallet interaction.
- Add allowlist controls for trusted origins where iframe usage is expected.
- Record threat source as page-level, frame-level, or click-level.

Acceptance criteria:

- Clickjacking fixtures produce deterministic `CLICKJACKING` signals.
- Benign modal-heavy apps do not produce critical alerts in fixture tests.
- Critical browser signals block or interrupt signing flow until user explicitly rejects or continues.

### Wallet Spoofing

Tasks:

- Detect fake wallet modal text when no provider is present.
- Detect provider object mismatch between `window.solana`, `window.phantom.solana`, and expected wallet metadata.
- Detect pages that request seed phrases, private keys, or recovery phrases.
- Detect suspicious wallet download prompts from non-wallet domains.

Acceptance criteria:

- Seed phrase/private key prompts always produce critical alerts.
- Wallet-like UI without provider produces medium/high alerts depending on context.
- Signals include sanitized evidence snippets, not full page content.

## Phase 4: API Production Readiness

Goal: make the API safe to expose beyond local development.

Tasks:

- Add environment schema validation at startup.
- Add request ID middleware and structured JSON logging.
- Add rate limiting for `/api/analyze` and `/api/blink/preview`. Status: implemented with an in-memory limiter.
- Add API timeout handling for RPC, Blink fetches, Redis, and AI providers.
- Restrict CORS by environment.
- Add optional API key or extension-origin validation.
- Add `/api/health/live` and `/api/health/ready`.
- Include Redis/RPC/AI provider status in readiness, without leaking secrets.
- Add safe error responses that do not leak provider internals.

Acceptance criteria:

- API refuses to boot with invalid required production configuration.
- Abuse-rate tests prove rate limits trigger.
- Health checks distinguish process liveness from dependency readiness.

## Phase 5: Risk Calibration and Metrics

Goal: make claims measurable.

Tasks:

- Create a labeled transaction corpus:
  - benign transfers
  - benign swaps
  - benign approvals
  - malicious delegate approvals
  - address poisoning
  - drainer-style token account closures
  - malicious Blinks
  - unknown program interactions
- Create a browser fixture corpus:
  - benign modals
  - transparent overlays
  - iframe clickjacking
  - fake wallet prompts
  - seed phrase phishing
- Track precision, recall, false-positive rate, and false-negative rate by signal type.
- Version scoring weights and detector rules.
- Add a benchmark command to run the corpus in CI.

Acceptance criteria:

- Every release includes benchmark output.
- Score thresholds are justified by measured data.
- User-facing copy avoids “accurate malicious intent detection” until metrics support it.

## Phase 6: Extension Release Readiness

Goal: prepare a browser-store-ready extension.

Tasks:

- Minimize extension permissions where feasible.
- Add settings page:
  - API URL
  - network/cluster
  - sensitivity level
  - local history retention
  - trusted origins
- Add privacy policy and in-extension disclosure.
- Add clear browser-threat notifications in popup history.
- Add extension packaging and zip scripts to CI.
- Add manual QA checklist for Chrome and Chromium-based browsers.

Acceptance criteria:

- Store package builds reproducibly.
- Privacy disclosure matches actual behavior.
- Extension can run against production API without local env changes.

## Phase 7: Security Review

Goal: reduce the chance that TxGuard itself becomes an attack surface.

Tasks:

- Audit extension page-script bridge and message validation.
- Validate message origins where possible.
- Escape all untrusted content before injecting into DOM.
- Review CSP for web and extension surfaces.
- Run dependency audit.
- Review Redis/cache data lifecycle.
- Review AI provider prompts for prompt-injection impact. AI explanations must not alter deterministic decision fields.

Acceptance criteria:

- Security review issues are tracked and resolved or explicitly accepted.
- No untrusted HTML is injected unsanitized.
- Message handlers reject malformed payloads.

## Launch Gates

TxGuard can be called a production beta when:

- Build, lint, and tests pass in CI.
- Core detector test coverage includes common malicious transaction classes.
- Browser clickjacking and spoofing fixtures pass.
- API has production config validation, rate limiting, logging, and health checks.
- Extension has settings, privacy disclosure, and reproducible packaging.
- Known limitations are documented in the UI and README.

TxGuard should not claim broad malicious-intent accuracy until:

- A labeled benchmark exists.
- Risk thresholds are calibrated against benchmark results.
- False-positive and false-negative rates are published internally per release.
- A security review has been completed.

## Immediate Next Tickets

Completed:

- Add `SIMULATION_UNAVAILABLE` and distinguish it from failed simulation.
- Add API environment validation and structured request logging.
- Add liveness/readiness health endpoints.
- Add API rate limiting for analyze and Blink endpoints.
- Expand SPL Token parser and tests for checked approvals/transfers, revoke, close, and freeze flows.

Next:

1. Add browser DOM fixture tests for clickjacking and wallet spoofing.
2. Add extension settings for API URL and detection sensitivity.
3. Add API timeout handling for RPC, Blink fetches, Redis, and AI providers.
4. Add benchmark harness scaffolding for labeled transaction/browser fixtures.
5. Add account metadata preservation for signer/writable/readonly flags.

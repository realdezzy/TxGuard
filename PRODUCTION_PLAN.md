# TxGuard Production Implementation Plan

## Current Production Baseline

TxGuard is now structured around deterministic safety signals first, with AI used only for explanation. The current baseline covers:

- Solana transaction parsing for system transfers, durable nonce, and selected SPL Token instructions.
- Deterministic risk signals for address poisoning, durable nonce, token authority changes, token delegate approvals, unknown programs, Blink source trust, simulation failure, large SOL movement, clickjacking, and wallet UI spoofing.
- Browser extension interception of Solana signing requests.
- Browser-side DOM threat detection for framing, suspicious overlays, click-target mismatch, and wallet-like spoofing controls.
- API analysis endpoint with Redis-backed best-effort caching.
- Web and extension UIs that display risk score, risk level, recommendation, signals, and fallback explanations.

## Launch-Critical Work

1. Expand deterministic transaction coverage.
   - Decode SPL Token and Token-2022 instructions comprehensively.
   - Detect approve, approveChecked, revoke, setAuthority, freeze, thaw, closeAccount, mintTo, burn, transferChecked, and confidential transfer instructions.
   - Decode Address Lookup Tables and loaded account metadata for versioned transactions.
   - Track signer, writable, and owner semantics per account.

2. Improve simulation fidelity.
   - Prefer Solana RPC simulation account deltas over log parsing.
   - Capture SOL, SPL token, and NFT balance changes.
   - Identify token account creation, closure, rent drain, delegate changes, and owner changes.
   - Treat unavailable simulation as an explicit signal with a separate severity from failed simulation.

3. Harden browser threat detection.
   - Add automated DOM fixtures for clickjacking cases.
   - Detect wallet modal spoofing by origin, iframe, visual text, and provider state.
   - Add user-visible warning overlays for browser threats, not only history entries.
   - Rate-limit repeated threat history writes per tab/origin.

4. Calibrate risk scoring.
   - Build a labeled dataset of benign and malicious transactions.
   - Track false positives, false negatives, precision, recall, and severity calibration.
   - Version risk rules and scoring weights.
   - Add regression tests for known malicious transaction patterns.

5. Production API readiness.
   - Add request authentication or extension origin validation.
   - Add rate limiting, structured logs, metrics, and request IDs.
   - Add health checks for Redis, RPC, and AI providers.
   - Add strict CORS configuration per environment.
   - Add environment-specific deployment config.

6. Extension release readiness.
   - Minimize host permissions where practical.
   - Add privacy disclosure for inspected page DOM and transaction payloads.
   - Add extension settings for API URL, network, and detection sensitivity.
   - Add Chrome Web Store packaging and release scripts.

7. Security review.
   - Audit extension message passing and page-script bridge.
   - Escape all untrusted UI content.
   - Add CSP review for web and extension surfaces.
   - Add dependency audit and lockfile review.

## AI Policy

AI must not be the source of truth for blocking decisions. It should summarize deterministic findings only. If AI is unavailable, TxGuard must continue to detect and score risks deterministically and use template explanations.

## Release Criteria

TxGuard should not claim accurate malicious-intent detection until:

- A labeled benchmark exists.
- Core malicious transaction classes have deterministic test coverage.
- Scoring thresholds are calibrated against measured false-positive and false-negative rates.
- Browser clickjacking detection has automated DOM regression tests.
- The extension and API have passed a security review.

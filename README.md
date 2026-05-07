I now have a thorough understanding of the entire codebase. Here is the comprehensive structural map.

---

## TxGuard Codebase -- Complete Structural Map

### 1. Top-Level Directory Layout

```
/home/dezzy/Documents/gig/Hackathons/TxGuard/
├── .agents/                          # Empty -- agent/automation config dir
├── .codex/                           # Empty -- Codex config dir
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI pipeline
├── .turbo/                           # TurboRepo build cache
├── apps/
│   ├── api/                          # Express API server
│   ├── extension/                    # Browser extension (Chrome/Firefox)
│   └── web/                          # Vite + React web app
├── packages/
│   └── core/                         # Shared core library (@txguard/core)
├── .env.example                      # Environment variable template
├── .gitignore
├── .prettierrc                       # Prettier formatting config
├── node_modules/
├── package.json                      # Root monorepo package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml               # pnpm workspace definition
├── PRODUCTION_PLAN.md                # Production implementation plan v1
├── PRODUCTION_PLAN_V2.md             # Production implementation plan v2
├── tsconfig.base.json                # Shared base TypeScript config
└── turbo.json                        # TurboRepo pipeline config
```

---

### 2. Monorepo Setup

| Aspect | Detail |
|---|---|
| **Package manager** | `pnpm @ 9.15.0` (declared in root `package.json` via `packageManager` field) |
| **Workspace config** | `pnpm-workspace.yaml` defines two workspace globs: `packages/*` and `apps/*` |
| **Orchestrator** | **TurboRepo v2.3.0** (`turbo.json`) |
| **Root scripts** | `dev`, `build`, `test`, `lint`, `clean`, `format` -- all delegated to `turbo` |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`): Node 20, pnpm install, format check, lint, audit, benchmark, test, build, then archive extension artifact |

**Workspace packages** (all prefixed `@txguard/`):
- `@txguard/core` -- `packages/core`
- `@txguard/api` -- `apps/api`
- `@txguard/web` -- `apps/web`
- `@txguard/extension` -- `apps/extension`

---

### 3. Root Config Files

| File | Path | Purpose |
|---|---|---|
| `package.json` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/package.json` | Root workspace def; devDeps: turbo, typescript, prettier, @types/node |
| `pnpm-workspace.yaml` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/pnpm-workspace.yaml` | 2 workspace entries: `packages/*`, `apps/*` |
| `turbo.json` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/turbo.json` | Pipeline: build (dependsOn `^build`, outputs `dist/**` + `.output/**`), dev (persistent, no cache), test, lint, clean |
| `tsconfig.base.json` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/tsconfig.base.json` | Base TS config: ES2022 target/module, bundler resolution, strict, declarations, sourcemaps, noUnusedLocals/Parameters |
| `.prettierrc` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/.prettierrc` | semicolons, single quotes, trailing commas, 100 print width, 2-space tabs |
| `.env.example` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/.env.example` | PORT, SOLANA_RPC_URL, AI_PROVIDER_PRIORITY, OpenAI/Anthropic/Groq keys+models, REDIS_URL, VITE_API_URL |
| `.gitignore` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/.gitignore` | Ignores node_modules, dist, .output, .turbo, .env, logs, .vite |
| `PRODUCTION_PLAN.md` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/PRODUCTION_PLAN.md` | 282-line plan: safety engine completeness, parser improvements, scoring calibration |
| `PRODUCTION_PLAN_V2.md` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/PRODUCTION_PLAN_V2.md` | 123-line plan: build/release gate, extension signing correctness, API production boundary, SolPhish patterns |
| `.github/workflows/ci.yml` | `/home/dezzy/Documents/gig/Hackathons/TxGuard/.github/workflows/ci.yml` | CI: build, lint, format check, audit, benchmark, test (core + extension), builds (core + API + extension), archive extension artifact |

---

### 4. Package: `@txguard/core` -- `/home/dezzy/Documents/gig/Hackathons/TxGuard/packages/core/`

**Purpose**: The shared library containing ALL transaction parsing, risk detection, simulation, scoring, AI explanation, and Blink analysis logic. Used by all three apps.

**`package.json`**: `/home/dezzy/Documents/gig/Hackathons/TxGuard/packages/core/package.json`
- Type: `module`
- Entry: `./src/index.ts` (re-exports from submodules)
- Exports: `".": "./src/index.ts"`
- Scripts: `build` (tsc), `test` (vitest), `test:watch`, `benchmark` (tsx src/benchmark/cli.ts), `lint` (tsc --noEmit), `clean`
- Dependencies: `@solana/web3.js`, `@solana/spl-token`, `zod`
- DevDependencies: `tsx`, `typescript`, `vitest`

**Directory structure**:

```
packages/core/
├── package.json
├── tsconfig.json                    # extends ../../tsconfig.base.json, composite, outDir=dist, rootDir=src
├── dist/                            # tsc output
├── node_modules/
├── scratch/
│   └── fetch_malicious_data.ts      # Utility to scrape malicious transaction data
├── test_output.txt
├── src/
│   ├── index.ts                     # Package entry: re-exports types, parser, Guardian, simulation, scoring
│   ├── Guardian.ts                  # MAIN ORCHESTRATOR: analyzeTransaction(), runDetectors()
│   ├── types/
│   │   └── index.ts                 # ALL shared types: RiskLevel, SignalType, RiskSignal, ParsedInstruction,
│   │                                #   BalanceChange, SimulationResult, TransactionAnalysis, GuardianConfig,
│   │                                #   AIProvider, ProgramTrustLevel, WhyScoreReason, ScoreVarianceHint
│   ├── parser/
│   │   └── index.ts                 # Transaction deserializer: parses legacy + versioned transactions,
│   │                                #   addresses lookup table resolution, instruction decoding for:
│   │                                #   System Program (transfer, nonce, createAccount, etc.),
│   │                                #   SPL Token (approve, revoke, setAuthority, mintTo, burn, closeAccount,
│   │                                #     freeze, thaw, transferChecked, etc.),
│   │                                #   Associated Token Account, Compute Budget instructions
│   ├── detectors/
│   │   ├── index.ts                 # Re-exports all detectors
│   │   ├── address-poisoning.ts     # Levenshtein distance + prefix/suffix matching for address poisoning
│   │   ├── durable-nonce.ts         # Durable nonce account detection
│   │   ├── authority.ts             # Token/account authority change detection
│   │   ├── compute-budget.ts        # Compute budget manipulation detection
│   │   ├── writable-pattern.ts      # Suspicious writable account patterns
│   │   ├── program-reputation.ts    # Trusted program allowlist (System, Token, Jupiter, Orca, Raydium,
│   │   │                            #   Marinade, Metaplex, Serum, Meteora, etc.), unknown program detection
│   │   ├── intent.ts               # Transaction intent classification (TRANSFER, SWAP, APPROVAL, REVOCATION,
│   │   │                            #   NFT_MINT, ACCOUNT_MANAGEMENT, UNKNOWN), anomaly detection
│   │   └── solphish.ts             # Solana-specific phishing pattern detection: STMT (multi-token drain),
│   │                                #   AAT (account authority transfer), ISA (system account impersonation)
│   ├── simulation/
│   │   └── index.ts                 # simulateTransaction(): RPC pre/post balance snapshots,
│   │                                #   token account decoding, balance delta computation,
│   │                                #   simulationToSignal(), simulationUnavailableToSignal()
│   ├── risk/
│   │   └── scoring.ts               # SIGNAL_WEIGHTS (per SignalType), LEVEL_MULTIPLIERS (per RiskLevel),
│   │                                #   calculateRiskScore(), confidence multipliers, browser signal amplification,
│   │                                #   scoreToRiskLevel(), scoreToRecommendation()
│   ├── ai/
│   │   ├── index.ts                 # Re-exports explainer + providers
│   │   ├── explainer.ts             # templateExplanation() (zero-dep fallback), buildPrompt(),
│   │   │                            #   explainTransaction() (tries AI providers with fallback)
│   │   └── providers.ts            # OpenAIProvider, AnthropicProvider, GroqProvider, OllamaProvider --
│   │                                #   each implements AIProvider.explain() via fetch to respective APIs
│   ├── blink/
│   │   └── index.ts                 # detectBlinkUrl(), analyzeBlinkUrl() (trusted domain list: jup.ag, raydium.io,
│   │                                #   tensor.trade, dialect.to, sphere.market), fetchBlinkPayload()
│   └── benchmark/
│       ├── index.ts                 # Re-exports corpus + runner
│       ├── cli.ts                   # CLI entry for running benchmarks
│       ├── corpus.ts                # buildCorpus(): labeled transactions from JSON/CSV data
│       ├── runner.ts                # runBenchmark(): precision/recall/F1 metrics per SignalType,
│       │                            #   false positive rates per intent, negative violations
│       ├── SCORING_WEIGHTS.md       # Documentation for scoring weight calibration
│       ├── malicious_hashes.csv
│       ├── malicious_hashes.json
│       └── malicious_transactions.json # Benchmark corpus data
├── tests/
│   ├── index.test.ts                # Core integration test: simulates analyzeTransaction with mock RPC
│   ├── detectors/
│   │   ├── address-poisoning.test.ts
│   │   ├── authority.test.ts
│   │   ├── compute-budget.test.ts
│   │   ├── intent.test.ts
│   │   ├── program-reputation.test.ts
│   │   ├── solphish.test.ts
│   │   └── writable-pattern.test.ts
│   ├── parser/
│   │   └── index.test.ts
│   └── simulation/
│       └── index.test.ts
```

---

### 5. App: `@txguard/api` -- `/home/dezzy/Documents/gig/Hackathons/TxGuard/apps/api/`

**Purpose**: Express.js API server (port 3001). Provides POST endpoints for transaction analysis and Blink preview. Uses Redis for caching, supports API key auth in production, and has rate limiting.

**`package.json`**: `/home/dezzy/Documents/gig/Hackathons/TxGuard/apps/api/package.json`
- Dependencies: `@solana/web3.js`, `@txguard/core` (workspace), `cors`, `express` (v5), `redis`, `zod`
- DevDependencies: `@types/cors`, `@types/express`, `tsx`, `typescript`

**Directory structure**:

```
apps/api/
├── package.json
├── tsconfig.json                     # extends ../../tsconfig.base.json, references ../../packages/core
├── dist/
├── src/
│   ├── index.ts                      # Express app setup: CORS, JSON body parser, request logging,
│   │                                 #   rate limiting, API key auth, error handler, routes mounted at:
│   │                                 #     /api/health (public), /api/analyze (auth+rate-limited),
│   │                                 #     /api/blink (auth+rate-limited)
│   ├── routes/
│   │   ├── analyze.ts                # POST /api/analyze: validates tx payload with zod,
│   │   │                             #   checks Redis cache, calls analyzeTransaction() from @txguard/core,
│   │   │                             #   caches result
│   │   ├── blink.ts                  # POST /api/blink/preview: parses Blink URL, fetches payload,
│   │   │                             #   runs analyzeTransaction on the embedded tx
│   │   └── health.ts                 # GET /api/health, /api/health/live, /api/health/ready
│   │                                 #   (redis + solana RPC readiness checks)
│   ├── services/
│   │   ├── config.ts                 # Zod-validated env config: port, CORS, RPC URL, Redis, rate limits,
│   │   │                             #   request timeout, API key (required in production)
│   │   ├── providers.ts              # buildProviderChain(): reads AI_PROVIDER_PRIORITY env var,
│   │   │                             #   instantiates OpenAI/Anthropic/Groq/Ollama providers from env keys
│   │   ├── cache.ts                  # Redis client for tx analysis caching (5-min TTL),
│   │   │                             #   generateTxHash(), getCachedAnalysis(), setCachedAnalysis()
│   │   └── solana.ts                 # getSolanaConnection(): Connection factory (caches by cluster),
│   │                                 #   supports mainnet-beta, devnet, testnet via env vars
│   └── middleware/
│       ├── api-key.ts                # apiKeyAuth(): constant-time comparison against API_KEY (timing-safe)
│       ├── rate-limit.ts             # rateLimit(): Redis-backed sliding window rate limiting (per IP,
│       │                             #   per API key, per tx hash), with in-memory fallback
│       ├── request-logging.ts        # requestLogging(): structured JSON request logging with request IDs
│       └── timeout.ts                # requestTimeout(): configurable request timeout middleware
```

---

### 6. App: `@txguard/web` -- `/home/dezzy/Documents/gig/Hackathons/TxGuard/apps/web/`

**Purpose**: Vite + React + Tailwind CSS v4 web dashboard. Allows manual pasting of base64 Solana transactions or Blink URLs for analysis, displaying a rich visual breakdown.

**`package.json`**: `/home/dezzy/Documents/gig/Hackathons/TxGuard/apps/web/package.json`
- Dependencies: `react`/`react-dom` (v19), `@txguard/core` (workspace)
- DevDependencies: Vite 8, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss` v4, ESLint 10, `typescript-eslint`

**Directory structure**:

```
apps/web/
├── package.json
├── index.html                        # Vite HTML entry point
├── vite.config.ts                    # Vite config: React plugin + Tailwind CSS plugin
├── tsconfig.json                     # References tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json                 # ES2023 target, DOM lib, React JSX, bundler resolution, noEmit
├── tsconfig.node.json                # ES2023 target, Node types, for vite.config.ts
├── eslint.config.js                  # ESLint flat config: @eslint/js, typescript-eslint, react-hooks, react-refresh
├── .gitignore
├── dist/
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.tsx                      # React 19 createRoot entry
    ├── App.tsx                       # Main app: textarea for tx/Blink input, "Analyze Transaction" button,
    │                                 #   fetches from API, renders Summary/RiskSignals/InstructionSummary/
    │                                 #   BalanceChanges/SimulationDetails, Settings modal
    ├── App.css
    ├── index.css                     # Tailwind v4 @import, custom theme (primary/solar green, secondary/purple,
    │                                 #   dark/darker/panel), glass-panel, custom scrollbar
    ├── assets/
    │   ├── hero.png
    │   ├── react.svg
    │   └── vite.svg
    ├── components/
    │   ├── Summary.tsx               # Risk score ring, explanation text
    │   ├── RiskSignals.tsx           # Signal list with severity badges
    │   ├── InstructionSummary.tsx    # Tabular breakdown of parsed instructions
    │   ├── BalanceChanges.tsx        # Pre/post balance delta display
    │   ├── SimulationDetails.tsx     # Simulation metadata (logs, units, confidence)
    │   └── Settings.tsx              # Modal for API URL + cluster selection (devnet/testnet/mainnet)
    └── utils/
        └── formatters.ts
```

---

### 7. App: `@txguard/extension` -- `/home/dezzy/Documents/gig/Hackathons/TxGuard/apps/extension/`

**Purpose**: Cross-browser extension (Chrome + Firefox) using [WXT framework](https://wxt.dev). Intercepts `signTransaction`/`signAllTransactions` calls from wallet providers, sends transactions to the API for analysis, blocks dangerous transactions with a Guardian overlay. Also runs client-side browser threat detection (clickjacking, wallet spoofing, seed phrase prompts).

**`package.json`**: `/home/dezzy/Documents/gig/Hackathons/TxGuard/apps/extension/package.json`
- Dependencies: `react`/`react-dom` (v19), `@txguard/core` (workspace)
- DevDependencies: `wxt`, `@wxt-dev/module-react`, `tailwindcss` v4, `@tailwindcss/vite`, `vitest`, `jsdom`
- Scripts: `dev`/`build`/`zip` (via `wxt`), `test` (vitest), `lint` (tsc --noEmit), `postinstall` (wxt prepare)

**Directory structure**:

```
apps/extension/
├── package.json
├── wxt.config.ts                     # WXT config: React module, Tailwind Vite plugin,
│                                     #   manifest with permissions (activeTab, storage),
│                                     #   host_permissions (localhost, api.txguard.com), CSP
├── tsconfig.json                     # Extends ./.wxt/tsconfig.json, React JSX
├── .gitignore
├── README.md
├── .output/                          # Built extension output (chrome-mv3/)
│   └── chrome-mv3/
│       ├── manifest.json
│       ├── background.js
│       ├── popup.html
│       ├── chunks/popup-*.js
│       └── icon/ (16/32/48/96/128.png)
├── .wxt/                             # WXT auto-generated types and config
│   ├── tsconfig.json
│   ├── wxt.d.ts
│   ├── eslint-auto-imports.mjs
│   └── types/
│       ├── imports.d.ts
│       ├── imports-module.d.ts
│       ├── paths.d.ts
│       ├── i18n.d.ts
│       └── globals.d.ts
├── entrypoints/
│   ├── background.ts                 # Service worker: handles ANALYZE_TRANSACTION (POST to /api/analyze),
│   │                                 #   ANALYZE_BLINK (POST to /api/blink/preview), BROWSER_THREAT (local scoring),
│   │                                 #   GET_HISTORY messages. In-memory analysis results returned to content script
│   ├── content.ts                    # Content script injected on <all_urls> (allFrames: true):
│   │                                 #   - Browser threat detection (overlays, click mismatch, framing)
│   │                                 #   - DOM MutationObserver for seed-phrase inputs and wallet spoofing
│   │                                 #   - Threat toast overlay for page-level alerts
│   │                                 #   - Listens for window.postMessage('TXGUARD_ANALYZE_TX') from inpage
│   │                                 #   - Shows "Guardian Overlay" for CAUTION/REJECT transactions
│   │                                 #   - Blink URL detection on link clicks
│   ├── inpage.content.ts             # MAIN world content script: wraps window.solana / window.phantom.solana
│   │                                 #   providers, intercepts signTransaction/signAllTransactions, sends
│   │                                 #   serialized tx via window.postMessage to content script for analysis
│   └── popup/
│       ├── index.html                # Extension popup HTML shell
│       ├── main.tsx                  # React 19 root render
│       ├── App.tsx                   # Popup UI: history list, active analysis display, risk score, signals
│       ├── App.css
│       ├── index.tsx
│       ├── Settings.tsx              # Settings: API URL, cluster, trust origins, sensitivity, retention days
│       └── style.css
├── utils/
│   └── browser-threat-detectors.ts   # Browser-side threat detectors:
│                                     #   detectBrowserThreats(), detectFramingRisk(), detectOverlayRisk(),
│                                     #   detectSeedPhraseInput(), detectWalletSpoofingRisk(),
│                                     #   escapeHtml(), hasSensitiveText(), isVisible(), isElementInside()
├── tests/
│   ├── content.test.ts               # Browser threat detection tests (jsdom + HTML fixtures)
│   └── fixtures/
│       ├── benign-modal.html
│       ├── fake-wallet-modal.html
│       ├── iframe-clickjack.html
│       ├── seed-phrase-input.html
│       ├── transparent-overlay.html
│       └── wallet-download-prompt.html
├── assets/
│   └── react.svg
└── public/
    ├── icon/
    │   ├── 16.png, 32.png, 48.png, 96.png, 128.png   # Extension icons
    ├── privacy.html                                    # Full privacy policy page
    └── wxt.svg
```

---

### 8. Build System and Scripts Summary

| Level | Script | Command | Behavior |
|---|---|---|---|
| **Root** | `dev` | `turbo dev` | Runs dev for all packages with persistent/cache:false tasks |
| **Root** | `build` | `turbo build` | Builds all packages in dependency order (packages first, then apps) |
| **Root** | `test` | `turbo test` | Runs tests (dependsOn `^build` so core builds first) |
| **Root** | `lint` | `turbo lint` | Runs lint in all packages |
| **Root** | `clean` | `turbo clean && rm -rf node_modules` | Cleans dist outputs |
| **Root** | `format` | `prettier --write "**/*.{ts,tsx,js,jsx,json,md}"` |
| **@txguard/core** | `build` | `tsc` | Compiles TypeScript to dist/ |
| **@txguard/core** | `test` | `vitest run` | Unit + integration tests |
| **@txguard/core** | `benchmark` | `tsx src/benchmark/cli.ts` | Precision/recall benchmark against known malicious/benign corpus |
| **@txguard/api** | `dev` | `tsx watch src/index.ts` | Hot-reload dev server |
| **@txguard/api** | `build` | `tsc` | Compiles to dist/ |
| **@txguard/web** | `dev` | `vite` | Vite dev server with HMR |
| **@txguard/web** | `build` | `tsc -b && vite build` | Type-checks then bundles |
| **@txguard/extension** | `dev` | `wxt` | WXT dev mode (hot-reload extension) |
| **@txguard/extension** | `build` | `wxt build` | Produces extension in .output/ |
| **@txguard/extension** | `test` | `vitest run` | Browser threat detection tests with jsdom |
| **@txguard/extension** | `zip` | `wxt zip` | Packages extension for distribution |

---

### 9. Data Flow Summary

1. **User triggers a transaction** in a dApp. The wallet provider (`window.solana` or `window.phantom.solana`) calls `signTransaction()`.

2. **`inpage.content.ts`** (running in MAIN world) intercepts the call, serializes the transaction to base64, and uses `window.postMessage` to forward it to the content script.

3. **`content.ts`** (ISOLATED world) receives the message and forwards it via `browser.runtime.sendMessage` to the background service worker.

4. **`background.ts`** sends a POST request to the API (`/api/analyze`) with the transaction bytes and cluster setting.

5. **`apps/api`** receives the request, checks Redis cache, then calls `analyzeTransaction()` from `@txguard/core`.

6. **`Guardian.ts`** (`@txguard/core`) orchestrates the full analysis:
   - Parses the transaction (Versioned or Legacy)
   - Runs all detectors (address poisoning, authority changes, solphish, etc.)
   - Runs RPC simulation (pre/post balance snapshots)
   - Calculates risk score from signals
   - Generates AI explanation (with template fallback)
   - Returns a `TransactionAnalysis` object

7. **Back to `content.ts`**: The analysis is returned. If the recommendation is `APPROVE`, the transaction proceeds. If `CAUTION` or `REJECT`, a "Guardian Overlay" is shown asking the user to explicitly approve or reject.

8. The result is posted back via `window.postMessage` to **`inpage.content.ts`**, which resolves the original `analyzeTx()` promise. If rejected, an error is thrown to block signing.

9. In parallel, the **content script** runs browser threat detectors (clickjacking, overlays, seed phrase inputs, wallet spoofing) and can show threat toasts on the page.

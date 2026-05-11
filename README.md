# TxGuard

AI-powered transaction security layer for Solana. Simulate, score, and explain transactions before you sign.

---

## Quick Start

```bash
git clone https://github.com/realdezzy/TxGuard.git
cd TxGuard
pnpm install
pnpm build
```

## Packages

| Package | Type | Purpose |
|---|---|---|
| `packages/core` | Library | Transaction parsing, risk detection, simulation, scoring, AI explainer |
| `apps/api` | Service | Express REST API for transaction analysis + Blink previews |
| `apps/extension` | Extension | Browser extension that intercepts wallet signing |
| `apps/web` | Web App | Dashboard for manual transaction analysis |

---

## `@txguard/core` — Analysis Engine

The shared library consumed by all other packages. Parses Solana transactions, runs detectors, simulates on-chain, computes risk scores, and generates explanations.

### API

```ts
import { analyzeTransaction, calculateRiskScore, scoreToRiskLevel } from '@txguard/core';

// Full analysis pipeline
const result = await analyzeTransaction(rawBase64Tx, {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  aiProviders: [],
  addressHistory: ['known-address-1', 'known-address-2'], // optional
  trustedMarketPrograms: ['JUP6Lk...'],  // optional
  trustedBlinkDomains: ['jup.ag'],        // optional
});

// result.riskScore   → 0–100
// result.riskLevel   → SAFE | LOW | MEDIUM | HIGH | CRITICAL
// result.recommendation → APPROVE | CAUTION | REJECT
// result.signals     → RiskSignal[] with type, level, title, message, metadata
// result.simulation  → SimulationResult with balance changes
// result.explanation → AI-generated plain-language explanation
```

### Detectors (run automatically by `analyzeTransaction`)

| Detector | What it catches |
|---|---|
| Address poisoning | Recipient mimics a known address (prefix-suffix + Levenshtein) |
| Durable nonce | Transaction can be delayed arbitrarily after signing |
| Authority changes | Token/setAuthority, approve, closeAccount, freeze |
| Writable patterns | Multiple third-party writable token accounts (drainers) |
| Program reputation | Interactions with unknown/new programs |
| Intent classification | Classifies intent + detects anomalous instruction combos |
| Compute budget | Elevated priority fees alongside high-risk signals |
| SolPhish | Three known phishing patterns: AAT, ISA, STMT |

### Utility exports

```ts
import {
  calculateRiskScore,    // score signals manually (extension browser threats)
  scoreToRiskLevel,      // score → SAFE/LOW/MEDIUM/HIGH/CRITICAL
  scoreToRecommendation, // score → APPROVE/CAUTION/REJECT
  analyzeBlinkUrl,       // check if URL is a valid Blink + trust status
  fetchBlinkPayload,     // fetch transaction from Blink URL
} from '@txguard/core';
```

---

## `@txguard/api` — REST API

Express server providing transaction analysis endpoints.

### Start

```bash
cd apps/api
cp ../../.env.example .env   # edit with your keys
pnpm run build                # compile TypeScript
pnpm run start                # start server (port 3001)
```

Or in development with hot-reload:
```bash
pnpm run dev                  # tsx watch, no build step needed
```

### Endpoints

#### `POST /api/analyze`

```json
// Request
{
  "transaction": "AQAAAAAAAA...",   // base64 encoded transaction
  "cluster": "mainnet-beta",          // optional, default: devnet
  "addressHistory": ["addr1", "addr2"] // optional, for poisoning detection
}

// Response
{
  "riskScore": 25,
  "riskLevel": "LOW",
  "recommendation": "CAUTION",
  "signals": [...],
  "simulation": { "success": true, "balanceChanges": [...] },
  "explanation": "This transaction performs a routine swap on Jupiter..."
}
```

#### `POST /api/blink/preview`

```json
// Request
{ "url": "https://jup.ag/api/actions/swap", "account": "<wallet-address>" }

// Response
{
  "blink": { "isBlink": true, "domain": "jup.ag", "trusted": true },
  "analysis": { ... }    // full TransactionAnalysis result
}
```

#### `GET /api/health`

Returns `{ "status": "ok" }`. Also available at `/api/health/live` and `/api/health/ready`.

### Configuration

| Env Var | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `REDIS_URL` | `redis://localhost:6379` | Redis for caching (optional) |
| `API_KEY` | — | Required in production, passed as `x-api-key` header |
| `API_CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `AI_PROVIDER_PRIORITY` | `openai,anthropic,groq,ollama` | AI providers in priority order |
| `OPENAI_API_KEY` | — | OpenAI key |
| `ANTHROPIC_API_KEY` | — | Anthropic key |
| `GROQ_API_KEY` | — | Groq key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `API_TRUSTED_BLINK_DOMAINS` | — | Comma-separated custom Blink domains |
| `API_TRUSTED_MARKET_PROGRAMS` | — | Comma-separated custom market program IDs |

### Rate Limiting

- 60 requests/min per IP (configurable)
- 600 requests/min per API key (configurable)
- Atomic counters via Redis Lua scripts, with in-memory fallback

---

## `@txguard/extension` — Browser Extension

Intercepts wallet signing, analyzes transactions, and blocks threats before execution.

### Build

```bash
cd apps/extension
pnpm install
pnpm run build    # output in .output/chrome-mv3
```

Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `.output/chrome-mv3`

### Supported Wallets

Phantom, Solflare, Backpack, OKX Wallet, Coinbase Wallet, Nightly, Trust Wallet, Bitget Wallet, plus Wallet Standard API — 12+ providers.

### How It Works

```
dApp → wallet.signTransaction(tx)
  → inpage script intercepts → postMessage to content script
    → content script forwards to background worker
      → background POSTs to /api/analyze
        → returns risk score + signals
      → result sent back through chain
    → if CAUTION/REJECT: Guardian overlay shown to user
    → if APPROVE: original signing proceeds
```

### Browser Threat Detection

When enabled, the extension also scans pages for:
- **Clickjacking** — transparent overlays, cross-origin framing, click target mismatch
- **Wallet spoofing** — fake wallet UI, provider key mismatches, download prompts on non-wallet domains
- **Seed phrase harvesting** — inputs/labels asking for seed phrases or private keys
- **PhishDestroy integration** — queries `api.destroy.tools` for domain reputation (500K+ domains)

### Development

```bash
pnpm run dev      # WXT dev mode with hot-reload
pnpm run test     # vitest test suite
pnpm run lint     # tsc --noEmit
```

---

## `@txguard/web` — Web Dashboard

Paste raw transactions or Blink URLs for instant analysis.

### Start

```bash
cd apps/web
pnpm run dev      # Vite dev server (http://localhost:5173)
pnpm run build    # production build to dist/
```

### Pages

| Route | Description |
|---|---|
| `/` | Landing page with features, how-it-works, CTAs |
| `#/analyze` | Transaction analysis dashboard |
| `#/download` | Extension download + manual install guide |

### Usage

1. Paste a base64 Solana transaction or a Blink URL
2. Click "Analyze Transaction"
3. Review risk score, signals, balance changes, simulation details
4. Optionally expand "Add known addresses" for address poisoning detection

---

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌───────────┐
│  extension  │───▶│    api        │───▶│   core    │
│  (browser)  │    │  (Express)    │    │ (library) │
└─────────────┘    └──────────────┘    └───────────┘
       │                  │                   │
       │                  │              ┌────┴────┐
       │                  │              │ detectors│
┌──────┴──────┐    ┌─────┴─────┐    ┌───┴─────────┤
│    web      │    │  Redis    │    │ simulation  │
│  (Vite+React)│   │  (cache)  │    │ scoring     │
└─────────────┘    └───────────┘    │ ai explainer│
                                    └─────────────┘
```

## Monorepo Commands

```bash
pnpm install      # install all dependencies
pnpm build        # build all packages in order (core → api/extension/web)
pnpm test         # run all test suites
pnpm lint         # typecheck all packages
pnpm dev          # start all dev servers
pnpm format       # prettier across all files
```

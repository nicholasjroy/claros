# CLAUDE.md

> Project context for AI coding agents (Claude Code, Cursor, etc.) and human
> contributors. Read this first. It defines what we are building, why, the
> stack, the plan, the architecture, and the Delphi SDK surface we depend on.

---

## 1. One-line summary

**No citation, no trade.** An auditable autonomous agent that trades Delphi
(Gensyn) information markets and *structurally cannot move money* unless its
decision is backed by a traceable chain of trusted, cited evidence.

---

## 2. Challenge statement (what we are submitting against)

> Ship an autonomous agent that does real work on the open web. Your agent(s)
> need to take real action: publish, monitor, orchestrate, transact — grounded
> in real sources. Use 3+ sponsor tools. Publish your agent's output to
> `cited.md`. Monetize it with agent payment rails (x402, MPP, CDP,
> agentic.market). Submit projects on Devpost.

How we satisfy each requirement:

| Requirement              | How we meet it                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| Autonomous agent         | Single Node process loops over all open markets unattended            |
| Real action / transact   | Real on-chain `buyShares` on Gensyn testnet → real tx hash            |
| Grounded in real sources | Tavily retrieves live news + Reddit; every claim is cited             |
| Monitor / orchestrate    | Continuous market monitoring + screening + decision pipeline          |
| 3+ sponsor tools         | Gensyn/Delphi, Tavily, Senso, Gemini (4 total)                        |
| Publish to `cited.md`    | Every decision (executed *and* rejected) written with evidence chain  |
| Payment rails            | CDP server wallet as Delphi signer (private key for dev; CDP for prod)|

---

## 3. Problem

Autonomous agents are starting to control real money on-chain — but they decide
in the dark. When an AI agent places a trade, there is no standard way to see:

- what information it relied on,
- whether those sources were trustworthy, or
- whether the stated reasons actually justify the action.

This makes autonomous financial agents **impossible to audit, impossible to
trust, and dangerous to fund.** The gap is not *capability* — agents can already
trade. The gap is **accountability.**

This is a real, current, unsolved problem in on-chain / DeFi agents, where the
agent acts irreversibly on real funds.

---

## 4. Solution

A grounded, auditable trading agent for Delphi information markets that cannot
act without a citation trail. For every market it considers, the agent:

1. **Retrieves** real-world evidence (Tavily — news + Reddit).
2. **Grounds & scores** that evidence against verified sources (Senso —
   citation-trust score).
3. **Estimates** a probability for each outcome (Gemini).
4. **Compares** its estimate to the market's on-chain implied probability to
   find an **edge**.
5. **Acts only when gated:** it executes a trade (Gensyn/Delphi) *only* when the
   edge is supported by sources above a trust threshold.
6. **Publishes** every decision to `cited.md` with the full evidence chain:
   sources, trust scores, reasoning, computed edge, and the on-chain tx hash.

The output is not just a trade. It is **a trade you can audit.**

### The gate (the entire USP, one rule)

```
EXECUTE TRADE  ONLY IF:
      edge              >= EDGE_MIN          (e.g. 0.05)
  AND citationTrust     >= TRUST_MIN         (e.g. 0.7)
  AND supportingSources >= 2
```

Verification is a **precondition of the transaction**, not a log entry written
after it. Rejected trades are published too — they prove the gate is real.

---

## 5. Goal & success metric

**Success metric = auditability, NOT profit.**

Profit is unverifiable in a hackathon (testnet, mock USDC, efficient-markets
claim we cannot validate). Auditability is demonstrable live in 3 minutes: an
observer can reconstruct exactly *why* every trade happened from `cited.md`.

We win by proving the **reference pattern**: grounding → trust-scoring → gated
action → published provenance. This generalizes to any agent that touches funds.

### USP & moat (honest framing)

- **USP:** the gating mechanism. The agent *structurally cannot* trade on
  ungrounded or low-trust information. "No citation, no trade."
- **Moat:** there is no deep technical moat in a weekend build, and we do not
  claim one. The defensible position is the **artifact** (`cited.md` audit
  trail) + the **pattern** becoming table stakes for funded agents. The moat is
  "auditable-by-construction becomes standard," not a secret algorithm.

---

## 6. Stack

| Layer            | Tool                          | Role                                            | Sponsor |
| ---------------- | ----------------------------- | ----------------------------------------------- | ------- |
| Markets + execution | Delphi (Gensyn) SDK        | List markets, read probs, quote, buy on-chain   | ✅ Gensyn |
| Web grounding    | Tavily Search/Extract API     | Live news + Reddit retrieval for RAG            | ✅ Tavily |
| Citation trust   | Senso (Context OS)            | Ground sources, score citation accuracy         | ✅ Senso  |
| Reasoning        | Gemini (Google DeepMind)      | Probability estimate + natural-language rationale | ✅ DeepMind |
| Payment rail     | CDP Server Wallet             | Production signer for Delphi (TEE-secured keys)  | (Coinbase) |
| Observability    | JSONL → (optional ClickHouse) | Log decisions/trades/PnL for source-trust analysis | (optional) |

**Language: pure TypeScript, single Node process.** Rationale: the Delphi SDK is
TS-native (critical path); Tavily/Senso/Gemini are plain REST; the workload is
I/O-bound (no CPU benefit from Rust). One language, one process, fast iteration.
Rust is explicitly out of scope (noted as future work for a high-frequency
production screening/edge core extracted to Rust/WASM).

**Network: Gensyn testnet** (faucet mock USDC + bridged Sepolia ETH). Trades are
real on-chain txns with real hashes — which is what "transact" requires — without
risking real funds.

**Signer: private key for the build, CDP server wallet for production.** CDP
provisioning is a setup rabbit hole; we build on the private-key signer and keep
CDP as a one-line env swap (`DELPHI_SIGNER_TYPE=cdp_server_wallet`).

---

## 7. Architecture

Single TypeScript Node process. Orchestrator owns the loop and the gate.

```
                         ┌─────────────────────────────────┐
                         │   orchestrator (index.ts)        │
                         │   runs the loop, owns the gate   │
                         └─────────────────────────────────┘
   ┌──────────┬───────────┬──────────┬──────────┬──────────┬──────────┐
   ▼          ▼           ▼          ▼          ▼          ▼          ▼
delphi.ts  screen.ts  tavily.ts  senso.ts  gemini.ts  decide.ts  publish.ts
   │          │           │          │          │          │          │
 list/     prob∈        news +    ground +   prob       edge +    cited.md
 quote/    [.3,.7]      reddit    citation-  estimate   gate      + tx hash
 buy       liquidity    sources   trust score                  observe.ts→JSONL
 (CDP)     filter
```

### Pipeline (per cycle)

```
1. INGEST     delphi.listOpenMarkets()  → markets + on-chain implied probs
2. SCREEN     screen.filter(markets)    → prob ∈ [0.3,0.7], liquidity band   (no API/LLM)
3. RESEARCH   tavily.research(market)   → live news + reddit sources
4. GROUND     senso.ground(sources)     → scored sources + citationTrust
5. REASON     gemini.estimate(...)      → outcome probability + rationale
6. DECIDE     decide.evaluate(...)      → edge = |geminiProb − marketProb|; apply gate
7. ACT        delphi.executeBuy(...)    → on-chain buy (only if gate passes) → tx hash
8. PUBLISH    publish.toCitedMd(record) → evidence chain to cited.md
9. OBSERVE    observe.log(record)       → JSONL (optional ClickHouse) for PnL/trust analysis
```

### Module contracts (stable interfaces — stub bodies, fill later)

```ts
delphi.listOpenMarkets() → OpenMarket[]
screen.filter(markets)   → OpenMarket[]                 // deterministic, no calls
tavily.research(market)  → Source[]                     // {url,title,content,publishedAt}
senso.ground(sources)    → { scoredSources, citationTrust }
gemini.estimateProbability(market, ctx) → { prob, reasoning }
decide.evaluate(market, estimate, trust) → { action, edge, rationale }
delphi.quoteBuy(addr, idx, shares)  → BuyQuote          // read-only, no gas
delphi.executeBuy(addr, idx, shares)→ BuyResult         // on-chain, the ONLY money move
publish.toCitedMd(record)           → void
observe.log(record)                 → void
```

> Build the skeleton with all stubs first; the pipeline should *run* end-to-end
> within the first ~45 min even when Senso/ClickHouse are stubbed. Stable
> interfaces let us cut a layer under time pressure without collapse.

---

## 8. Plan (3-hour build)

### 0:00–0:45 — Setup (fire slow async waits FIRST)
- First 5 min: create throwaway wallet → `WALLET_PRIVATE_KEY`; start **Sepolia
  faucet** (slowest dep); open tabs for Delphi API key, Tavily, Senso, Gemini.
- Scaffold repo, install deps, install Delphi skill.
- Verify critical path: `scripts/get-wallet-balances.ts`, `scripts/testnet-faucet.ts`,
  `scripts/list-markets.ts open`.
- **Hard gate:** if `list-markets` doesn't print real markets, fix *only* that.

### 0:45–1:30 — Thin vertical slice (stubs allowed)
- One hardcoded market, end-to-end: delphi → tavily (real) → senso (stub trust
  0.9) → gemini (real) → decide → write `cited.md` with a **quote** as proof-of-intent.

### 1:30–2:15 — Make it real and autonomous
- `screen.ts` over ALL markets (prob band + liquidity).
- Real Senso ingest/score (keep stub if it fights).
- **Real testnet trade** on best gated market → capture tx hash → into `cited.md`.
  *(Non-negotiable proof-of-work.)*

### 2:15–2:45 — Observability (demo payoff)
- `observe.ts` → JSONL (ClickHouse only if trivially up).
- Make `cited.md` legible: per-market evidence chain; show **rejected** trades.
- Wrap orchestrator in a loop / `--once` for demo.

### 2:45–3:00 — Demo prep + buffer (sacred)
- 3-min story: "No citation, no trade." Show one executed trade (full chain + tx
  on explorer) and one rejected trade (with reason). Name the 4 sponsors.

### Triage order (when something overruns — each cut still leaves a coherent project)
1. ClickHouse → JSONL.
2. Real Senso → heuristic trust stub.
3. Multi-market screening → curated handful.
4. **NEVER cut:** one real Tavily-grounded decision + one real testnet trade with
   a tx hash in `cited.md`.

---

## 9. Parallelization note (no funded wallet yet)
There is a wallet with no funds yet. A throwaway key could be used for testing. My teammate is currently working on the wallet.

## 10. Environment variables

```bash
# Required
DELPHI_API_ACCESS_KEY=your-testnet-api-key      # from delphi-api-access.gensyn.ai
TAVILY_API_KEY=tvly-...
SENSO_API_KEY=tgr_...
GEMINI_API_KEY=...

# Signing — DEV: private key
DELPHI_SIGNER_TYPE=private_key
WALLET_PRIVATE_KEY=0xYourThrowawayKey

# Signing — PROD: CDP server wallet (swap-in)
# DELPHI_SIGNER_TYPE=cdp_server_wallet
# CDP_API_KEY_ID=...
# CDP_API_KEY_SECRET=...
# CDP_WALLET_SECRET=...
# CDP_WALLET_ADDRESS=0x...

# Network (defaults to testnet)
# DELPHI_NETWORK=testnet
```

Testnet network defaults (auto-configured by the SDK):
- RPC URL: `https://gensyn-testnet.g.alchemy.com/public`
- Chain ID: `685685`
- Gateway: `0x7b8FDBD187B0Be5e30e48B1995df574A62667147`
- USDC (collateral): `0x0724D6079b986F8e44bDafB8a09B60C0bd6A45a1`
- USDC faucet (MockToken, `requestToken()` → 1000 USDC): `0xB5876320DdA1AEE3eFC03aD02dC2e2CB4b61B7D9`
- Subgraph (Goldsky): `https://api.goldsky.com/api/public/project_cmgzfvv29eu3601tm97hzgzg5/subgraphs/test-graph/1.0.0/gn`
- App URL: `https://testnet.delphi.fyi`

---

## 11. Delphi (Gensyn) reference

> Condensed from the Delphi SDK + Agentic Trading Toolkit docs. This is the
> contract the agent depends on. **The installed `@gensyn-ai/gensyn-delphi-sdk`
> package is the source of truth** — if a method name differs, trust the package.

There is a folder named `gensysn-delphi-skills` which is a clone of delphi gensyn repo for reference.

### 11.1 What Delphi is

Delphi is Gensyn's on-chain information-market platform (an OP Stack L2 on
Ethereum). Anyone can deploy a market; humans and machines create markets, place
trades, and consume the information produced. Markets pair a question/benchmark
with outcomes, maintain a live on-chain price per outcome, and settle to a clear
outcome.

**Pricing — Dynamic Parimutuel (DPM):**
- Prices shift continuously with every trade (no order book).
- `spotImpliedProbability` reflects current consensus probability (1e18 = 100%).
- Binary market: `prob[0] + prob[1] = 1e18`.
- A spot price of 0.65 USDC/share ≈ 65% implied probability.

**Agents CANNOT create markets** — markets must be created via the Delphi UI.
Markets created outside the UI won't appear in the interface.

### 11.2 Setup

```bash
npm install @gensyn-ai/gensyn-delphi-sdk
# Install the agent skill (Claude Code / Cursor / Cline):
npx skills add https://github.com/gensyn-ai/gensyn-delphi-skills --skill delphi
```

API keys: testnet → `https://delphi-api-access.gensyn.ai/`,
mainnet → `https://api-access.delphi.fyi/`.

Client:
```ts
import { DelphiClient } from "@gensyn-ai/gensyn-delphi-sdk";
const client = new DelphiClient(); // reads .env
```

### 11.3 Units (critical)

| Quantity      | Decimals | Scale    | Convert                         |
| ------------- | -------- | -------- | ------------------------------- |
| Shares        | 18       | 1e18     | `Number(BigInt(x)) / 1e18`      |
| USDC          | 6        | 1e6      | `Number(BigInt(x)) / 1e6`       |
| Probability   | —        | 1e18=100%| `Number(x) / 1e18` → 0..1       |
| Spot price    | —        | 1e18=1.0 | `Number(x) / 1e18` USDC/share   |

Always keep `bigint` internally; convert only at the edges. Float math on
on-chain amounts causes `TokensInExceedsMax` / `TokensOutBelowMin` reverts.

### 11.4 REST API (reads — need `DELPHI_API_ACCESS_KEY` only)

```ts
// Liveness (no auth)
const { status } = await client.health();

// List markets (paginated, filterable)
const { markets } = await client.listMarkets({
  status: "open",         // "open" | "closed" | "settled"
  category: "crypto",
  orderBy: "liquidity",   // "liquidity" | "created" | "settles_at"
  verifiable: true,
  skip: 0,
  limit: 50,
});

// Single market
const market = await client.getMarket({ id: "0xMarketProxyAddress" });
```

**Market type (key fields):**
```ts
interface Market {
  id: string;             // on-chain market proxy address → getMarket({ id })
  appMarketId: string;    // UUID in the Delphi app UI
  marketUrl: string;      // direct link (use in cited.md)
  status: string;         // "open" | "closed" | "settled" ...
  category: string;
  implementation: string; // ← marketAddress for ALL trading/quote/approval calls
  metadata: unknown;      // parsed metadata (see below)
  resolvesAt: string | null;
  settledAt: string | null;
  winningOutcomeIdx: string | null;
  verifiable: boolean;
}
```

**Metadata shape:**
```ts
const meta = market.metadata as {
  question?: string;
  title?: string;
  outcomes?: string[];     // outcomes[0] is the label for outcomeIdx 0 (critical)
  resolutionCriteria?: string;
  endDate?: string;
} | null;
```

**Address fields:** `market.id` → `getMarket`. `market.implementation` →
`marketAddress` for all trading/quote/approval calls.

**Status values (API strings):** `open`, `awaiting_settlement`, `settled`,
`expired`. Contract enum: 0=open, 1=awaiting_settlement, 2=settled, 3=expired.

### 11.5 Positions & redemption

```ts
const { positions } = await client.listPositions({
  wallet: "0x...", redeemedOrLiquidated: false, skip: 0, limit: 50,
});
// shares/tokensRedeemed are string bigints:
const shares = Number(BigInt(p.shares)) / 1e18;       // 18-dec
const tokens = Number(BigInt(p.tokensRedeemed)) / 1e6; // 6-dec
// Always check BigInt(p.shares) > 0n before redeem/liquidate.

await client.redeemMarket({ marketAddress: "0x..." });           // single
await client.redeemPositions({ marketAddresses: ["0x...", ...] }); // batch
```
Markets must be `settled` before redeeming; only winning-outcome holders receive
tokens.

### 11.6 Quotes (read-only, no gas)

```ts
const { tokensIn }  = await client.quoteBuy({ marketAddress, outcomeIdx, sharesOut: BigInt(Math.round(10*1e18)) });
const { tokensOut } = await client.quoteSell({ marketAddress, outcomeIdx, sharesIn:  BigInt(Math.round(5*1e18)) });
```

### 11.7 Trading (on-chain, costs gas)

```ts
const sharesOut = BigInt(Math.round(10 * 1e18));
// 1. quote
const { tokensIn } = await client.quoteBuy({ marketAddress, outcomeIdx, sharesOut });
// 2. slippage cap (integer bps math; 200 = 2%)
const maxTokensIn = tokensIn * (10000n + 200n) / 10000n;
// 3. ensure approval (no-op if already approved)
await client.ensureTokenApproval({ marketAddress, minimumAmount: maxTokensIn });
// 4. execute
const { transactionHash } = await client.buyShares({ marketAddress, outcomeIdx, sharesOut, maxTokensIn });
```

Selling mirrors this with `quoteSell` + `minTokensOut = tokensOut*(10000n-bps)/10000n`
then `client.sellShares({...})`.

**Slippage guide:** quiet 1–2%, active 2–5%, large (>$100) 5–10%, time-sensitive 5%.

**Common contract errors:** `TokensInExceedsMax` / `TokensOutBelowMin`
(re-quote, raise slippage); `MarketNotOpen` (closed/settled); `SharesInExceedSupply`
(query balance first); `ZeroTokensIn` (sharesOut too small).

### 11.8 Gateway direct reads (advanced, via viem)

Single entry point for on-chain interactions. ABI:
`DYNAMIC_PARIMUTUEL_GATEWAY_ABI` (exported by the SDK). Gateway address:
`DELPHI_GATEWAY_CONTRACT` env / network default.

Key read functions:
| Function                   | Args                               | Returns       | Notes                |
| -------------------------- | ---------------------------------- | ------------- | -------------------- |
| `spotImpliedProbabilities` | marketProxy, outcomeIndices[]      | `uint256[]`   | 1e18 = 100%          |
| `spotPrices`               | marketProxy, outcomeIndices[]      | `uint256[]`   | 1e18 = 1.0 USDC/share|
| `balanceOf`                | marketProxy, owner, outcomeIdx     | `uint256`     | shares (18-dec)      |
| `getMarket`                | marketProxy                        | Market struct | full on-chain state  |
| `marketStatus`             | marketProxy                        | `uint8`       | 0=Open,1=Closed,2=Settled |
| `token`                    | marketProxy                        | `address`     | collateral token     |

```ts
const probs = await publicClient.readContract({
  address: gateway, abi: DYNAMIC_PARIMUTUEL_GATEWAY_ABI as Abi,
  functionName: "spotImpliedProbabilities", args: [marketProxy, [0n, 1n]],
}) as bigint[]; // probs[i] / 1e18 = implied probability
```

Access the signer's clients for custom reads/writes:
```ts
const { address, publicClient, walletClient } = await client.getSigner();
```

### 11.9 Subgraph (Goldsky — historical events, read-only)

```ts
const subgraph = client.getSubgraph();
const { buys, sells } = await subgraph.getMarketTrades("0xMarketProxy", { first: 20 });
const meta = await subgraph.getMeta(); // indexed block, freshness
```

Indexed entities: `gatewayBuys`, `gatewaySells`, `gatewayRedemptions`,
`gatewayLiquidations`, `gatewayWinnerSubmitteds`, `initializeds`. Collection
queries support `first`, `skip`, `orderBy`, `orderDirection`, `where` (with
`_gt/_lt/_gte/_lte/_in/_contains/...` operators).

Used here for **liquidity screening** (recent trade counts/volume per market)
and for post-hoc PnL/trust analysis.

```ts
// recent global buys
const data = await subgraph.query<{ gatewayBuys: any[] }>(`{
  gatewayBuys(first: 10, orderBy: timestamp_, orderDirection: desc) {
    id buyer marketProxy outcomeIdx tokensIn sharesOut timestamp_
  }
}`);
// parse: usdc = Number(BigInt(tokensIn))/1e6; shares = Number(BigInt(sharesOut))/1e18
```

### 11.10 Funding (testnet)

1. Get Sepolia ETH (Google Cloud Web3 faucet) — slowest dependency, start first.
2. Bridge to Gensyn testnet: `npx tsx scripts/bridge-eth-to-gensyn-testnet.ts <amount>`
   (OP Stack canonical bridge; arrives in minutes under "Internal txns").
3. Claim mock USDC: `npx tsx scripts/testnet-faucet.ts` (`requestToken()` → 1000 USDC).

### 11.11 Useful bundled scripts (skills repo `scripts/`)

| Script                          | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `list-markets.ts`               | List/filter markets                        |
| `get-market.ts`                 | Single market details                      |
| `quote-buy.ts` / `quote-sell.ts`| Read-only quotes                           |
| `buy-shares.ts` / `sell-shares.ts` | On-chain trades                         |
| `list-positions.ts`             | Wallet positions                           |
| `get-wallet-balances.ts`        | ETH + USDC balances (canonical balance ref)|
| `testnet-faucet.ts`             | Claim 1000 mock USDC                        |
| `bridge-eth-to-gensyn-testnet.ts` | Bridge Sepolia ETH → Gensyn testnet      |
| `list-recent-trades.ts`         | Recent trades via subgraph                 |
| `agent-tui/index.tsx`           | Read-only TUI dashboard (safe to leave on) |

---

## 12. Repo layout (target)

```
cited-agent/
  CLAUDE.md            ← this file
  .env                 ← keys (gitignored)
  .env.example
  package.json
  tsconfig.json
  src/
    index.ts           ← orchestrator + gate + loop
    delphi.ts          ← Delphi SDK wrapper (DONE)
    screen.ts          ← deterministic prob/liquidity filter
    tavily.ts          ← web grounding (news + reddit)
    senso.ts           ← ground + citation-trust score (stub-first)
    gemini.ts          ← probability estimate + rationale
    decide.ts          ← edge = |geminiProb − marketProb|; THE GATE
    publish.ts         ← cited.md writer
    observe.ts         ← JSONL log (optional ClickHouse)
    types.ts           ← shared interfaces
  cited.md             ← agent output (the deliverable)
  decisions.jsonl      ← observability log
```

---

## 13. Coding conventions for agents working in this repo

- **TypeScript only.** Single Node process. `tsx` to run.
- Keep on-chain amounts as `bigint`; convert at module edges only.
- Each sponsor integration is an isolated module with a stable signature, so any
  layer can be stubbed without breaking the pipeline.
- `executeBuy` is the **only** money-moving call. It must only be reached after
  the `decide.ts` gate passes. Never call it speculatively.
- Reads (`listOpenMarkets`, `quoteBuy`, probabilities) need no funds — build and
  test them against a throwaway key while waiting on wallet funding.
- Every cycle writes to `cited.md` AND `decisions.jsonl` — executed and rejected
  decisions alike. Rejected decisions are evidence the gate works; never silence them.
- Demo metric is **auditability, not profit.** Don't add code that claims or
  optimizes for profit; optimize for traceability of the decision.

---

## 14. Current state (2026-06-26)

### What exists

| File | Status | Notes |
|------|--------|-------|
| `src/client.ts` | ✅ Done | Delphi SDK client, unit helpers (`toUsdc`, `toShares`, `toProb`, etc.) |
| `src/list-markets.ts` | ✅ Tested | Lists markets with spot prices + implied probs; works against testnet |
| `src/get-wallet-balances.ts` | ✅ Done | ETH + USDC balance checker |
| `.env` | ⚠️ Partial | Has `DELPHI_API_ACCESS_KEY`, `DELPHI_SIGNER_TYPE`, `WALLET_PRIVATE_KEY` — **missing** `TAVILY_API_KEY`, `SENSO_API_KEY`, `GEMINI_API_KEY` |

### What is missing (entire pipeline)

`types.ts`, `screen.ts`, `tavily.ts`, `senso.ts`, `gemini.ts`, `decide.ts`,
`publish.ts`, `observe.ts`, `index.ts`, `cited.md`, `decisions.jsonl`

### Naming note

The CLAUDE.md target layout calls the Delphi wrapper `delphi.ts`; in the actual
repo it is `client.ts` (already exports `client`, `getWalletAddress`, and all
unit helpers). Do not rename it — reference it as `src/client.ts`.

### Wallet status

Teammate is funding the throwaway wallet (Sepolia ETH → bridge → Gensyn
testnet; mock USDC via faucet). Until funded, use `quoteBuy` as proof-of-intent
everywhere `executeBuy` would go.

---

## 15. 1-Hour MVP Sprint (2 people, wallet funded)

**Hard deliverable:** `cited.md` contains ≥1 executed trade (real tx hash) and ≥1
rejected trade (gate failure reason). Everything else is secondary.

**Rule:** stubs are fine everywhere except Tavily (must be real — it's the
grounding claim) and `executeBuy` (must be real — it's the "transact" claim).
Gemini and Senso can be stubbed if they fight.

---

### 0:00–0:15 — Foundation (Person 1 + Person 2 simultaneously)

**Person 1 — types + pure logic**
- `src/types.ts` — interfaces: `Source`, `ScoredSource`, `EstimateResult`, `DecisionRecord`
- `src/screen.ts` — filter `markets` to prob ∈ [0.30, 0.70]; return top 3 by closest to 0.5
- `src/decide.ts` — `evaluate(market, estimate, trust)` → gate → `{ action, edge, rationale }`
- `src/publish.ts` — append one `## Decision` block to `cited.md`
- `src/observe.ts` — append one JSON line to `decisions.jsonl`

**Person 2 — API keys + stubs**
- Confirm wallet is funded: `npx tsx src/get-wallet-balances.ts` (need ETH + USDC > 0)
- Get **Tavily** key → add `TAVILY_API_KEY` to `.env` → write `src/tavily.ts` (real)
- Get **Gemini** key → add `GEMINI_API_KEY` to `.env` → write `src/gemini.ts`
  - If no key yet: stub `{ prob: 0.65, reasoning: "stub — replace with Gemini" }`
- `src/senso.ts` — start as heuristic stub: `citationTrust = 0.85` (replace if time)

---

### 0:15–0:40 — Integration (both work on `src/index.ts`)

Wire the 9-step pipeline. Person 1 owns the file; Person 2 drops in real module
calls as they finish them.

```ts
// index.ts skeleton — fill in as modules land
import { client } from "./client.js";
import { screen }  from "./screen.js";
import { research } from "./tavily.js";
import { ground }   from "./senso.js";
import { estimate } from "./gemini.js";
import { evaluate } from "./decide.js";
import { toCitedMd } from "./publish.js";
import { log }      from "./observe.js";

async function runOnce() {
  const { markets } = await client.listMarkets({ status: "open", limit: 50, pricesAndImpliedProbabilities: true });
  const candidates = screen(markets);                        // deterministic filter
  for (const market of candidates) {
    const sources        = await research(market);           // Tavily (real)
    const { scoredSources, citationTrust } = await ground(sources); // Senso (stub ok)
    const { prob, reasoning } = await estimate(market, sources);    // Gemini (stub ok)
    const decision = evaluate(market, { prob, reasoning }, citationTrust, sources);
    let txHash: string | null = null;
    if (decision.action === "BUY") {
      const sharesOut = BigInt(Math.round(5 * 1e18));
      const { tokensIn } = await client.quoteBuy({ marketAddress: market.implementation as `0x${string}`, outcomeIdx: decision.outcomeIdx, sharesOut });
      const maxTokensIn = tokensIn * 10200n / 10000n;       // 2% slippage
      await client.ensureTokenApproval({ marketAddress: market.implementation as `0x${string}`, minimumAmount: maxTokensIn });
      const { transactionHash } = await client.buyShares({ marketAddress: market.implementation as `0x${string}`, outcomeIdx: decision.outcomeIdx, sharesOut, maxTokensIn });
      txHash = transactionHash;
      console.log("EXECUTED:", txHash);
    }
    const record = { market, sources: scoredSources, citationTrust, prob, reasoning, decision, txHash, timestamp: new Date().toISOString() };
    toCitedMd(record);
    log(record);
  }
}

runOnce().catch(console.error);
```

Add `"start": "tsx src/index.ts"` to `package.json`.

---

### 0:40–0:50 — First live run

```bash
npx tsx src/index.ts
```

- Watch logs. If gate never triggers: temporarily lower `EDGE_MIN` to `0.03`.
- If `executeBuy` reverts: re-quote (price moved), or raise slippage to `10500n / 10000n`.
- Capture first tx hash from console.

---

### 0:50–1:00 — Demo polish (sacred)

- Open `cited.md` — must show ≥1 `EXECUTED` block with tx hash and ≥1 `REJECTED` block.
- If only executed trades: temporarily raise `TRUST_MIN` to `0.99` for one run to force a rejection, then restore.
- 3-sentence demo script: (1) "No citation, no trade — here's the gate." (2) "Here's a rejected trade and why." (3) "Here's a real on-chain tx — click the hash."

---

### Triage (if something overruns)

| Cut | Effect |
|-----|--------|
| Real Senso → heuristic stub | Lose one sponsor mention; keep the gate |
| Real Gemini → stub 0.65 | Lose reasoning quality; gate still works |
| Multi-market → one hardcoded market | Lose screening demo; keep the deliverable |
| **Never cut** | Real Tavily sources + real `executeBuy` tx hash in `cited.md` |

---

### Module signatures (stable contracts — agree on these before diverging)

```ts
// types.ts
export interface Source       { url: string; title: string; content: string; publishedAt?: string }
export interface ScoredSource extends Source { trustScore: number }
export interface EstimateResult { prob: number; reasoning: string }
export interface DecisionRecord {
  market: any; sources: ScoredSource[]; citationTrust: number;
  prob: number; reasoning: string;
  decision: { action: "BUY"|"SKIP"; edge: number; rationale: string; outcomeIdx: number };
  txHash: string | null; timestamp: string;
}

// screen.ts
export function screen(markets: any[]): any[]

// tavily.ts
export async function research(market: any): Promise<Source[]>

// senso.ts
export async function ground(sources: Source[]): Promise<{ scoredSources: ScoredSource[]; citationTrust: number }>

// gemini.ts
export async function estimate(market: any, sources: Source[]): Promise<EstimateResult>

// decide.ts
export function evaluate(market: any, est: EstimateResult, citationTrust: number, sources: ScoredSource[]): { action: "BUY"|"SKIP"; edge: number; rationale: string; outcomeIdx: number }

// publish.ts
export function toCitedMd(record: DecisionRecord): void

// observe.ts
export function log(record: DecisionRecord): void
```
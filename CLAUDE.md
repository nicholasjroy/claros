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

| Requirement              | How we meet it                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Autonomous agent         | Single Node process, one random screened market per run, fully unattended             |
| Real action / transact   | Real on-chain `buyShares` on Gensyn testnet → real tx hash in `cited.md`             |
| Grounded in real sources | Gemini generates 3 research questions; Tavily retrieves live evidence for each        |
| Monitor / orchestrate    | Market screening (prob band filter) + 9-step decision pipeline per cycle              |
| 3+ sponsor tools         | Gensyn/Delphi ✅ Tavily ✅ Gemini ✅ (Senso heuristic stub — see §6)                  |
| Publish to `cited.md`    | Every decision (executed *and* rejected) written with full evidence + gate rationale  |
| Payment rails            | Private key signer for dev; CDP server wallet is a one-line env swap for prod         |

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

1. **Screens** all open markets to find genuinely uncertain ones (implied prob
   in [0.30, 0.70]), then picks one at random.
2. **Generates research questions** (Gemini) — the market question plus two
   supporting angles (recent news, historical base rates).
3. **Retrieves** live evidence for all three questions (Tavily search + extract),
   deduplicates by URL, producing a combined source pool.
4. **Scores** source trust (Senso — heuristic stub at 0.85; real API swap-in
   ready).
5. **Estimates** a probability for outcome 0 (Gemini), citing specific sources
   in its reasoning.
6. **Applies the gate:** executes a trade (Gensyn/Delphi) *only* when all three
   conditions pass (edge, trust, source count).
7. **Publishes** every decision — executed and rejected — to `cited.md` (audit
   trail) and `output/*.html` (human-readable report with clickable source links).

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

| Layer               | Tool                      | Status      | Role                                                           | Sponsor     |
| ------------------- | ------------------------- | ----------- | -------------------------------------------------------------- | ----------- |
| Markets + execution | Delphi (Gensyn) SDK       | ✅ Real      | Screen markets, read probs, quote, `buyShares` on-chain        | ✅ Gensyn    |
| Web grounding       | Tavily Search/Extract API | ✅ Real      | 3 questions per market → search + extract → deduped sources   | ✅ Tavily    |
| Research questions  | Gemini 2.5 Flash          | ✅ Real      | Generate 3 targeted queries per market question               | ✅ DeepMind  |
| Probability estimate| Gemini 2.5 Flash          | ✅ Real      | Estimate outcome probability from research context            | ✅ DeepMind  |
| Citation trust      | Senso (Context OS)        | ⚠️ Stub      | Heuristic `citationTrust = 0.85`; real API integration ready  | (Senso)     |
| Payment rail        | Private key (dev)         | ✅ Working   | `DELPHI_SIGNER_TYPE=cdp_server_wallet` for prod swap-in       | (Coinbase)  |
| Audit trail         | `cited.md`                | ✅ Real      | Every decision written with gate rationale + tx hash          | —           |
| Human report        | `output/*.html`           | ✅ Real      | Styled HTML with clickable source links per decision          | —           |
| Observability       | `decisions.jsonl`         | ✅ Real      | Machine-readable log of every decision                        | —           |

**Language: TypeScript, single Node process, `tsx` to run.**

**Network: Gensyn testnet** (chain 685685). Trades are real on-chain txns with
real hashes — which is what "transact" requires — without risking real funds.

**Important SDK note:** `market.id` is the correct `marketAddress` for all SDK
trading/quote calls (`quoteBuy`, `buyShares`, `ensureTokenApproval`). The
`market.implementation` field is the shared logic contract address — passing it
to the gateway causes `MarketProxyNotDeployedByFactory` reverts.

---

## 7. Architecture

Single TypeScript Node process. `index.ts` owns the loop and the gate.

```
                          ┌────────────────────────────────────┐
                          │         index.ts (orchestrator)     │
                          │  picks 1 random screened market     │
                          │  owns the gate + the only buyShares │
                          └────────────────────────────────────┘
      ┌──────────┬──────────┬─────────────────┬──────────┬──────────┬──────────┐
      ▼          ▼          ▼                 ▼          ▼          ▼          ▼
 client.ts  screen.ts  gemini.ts          tavily.ts  senso.ts  decide.ts  publish.ts
      │          │       │         │          │          │          │        │       │
  list/     prob∈    gen 3q   estimate    research   trust     edge +   cited.md  HTML
  quote/   [.3,.7]  questions  (prob+     (per q →   score    gate      +JSONL   report
  buy      filter              reasoning)  sources)  (stub)
```

### Pipeline (per run — `npm start`)

```
1. INGEST    client.listMarkets()             → all open markets + implied probs
2. SCREEN    screen(markets)                  → prob ∈ [0.30, 0.70]; pick 1 at random
3. QUESTION  gemini.generateResearchQuestions → 3 targeted search queries
4. RESEARCH  tavily.research(question) × 3   → sources per query; dedup by URL
5. GROUND    senso.ground(sources)            → scoredSources + citationTrust (stub: 0.85)
6. REASON    gemini.estimate(market, sources) → { prob, reasoning } citing sources by [n]
7. DECIDE    decide.evaluate(...)             → edge = |geminiProb − marketProb|; gate
8. ACT       client.buyShares(...)            → on-chain buy if gate passes → txHash
9. PUBLISH   publish.toCitedMd(record)        → cited.md evidence block
             publish.toHtml(record, questions) → output/*.html human report
10. OBSERVE  observe.log(record)              → decisions.jsonl line
```

### Actual module contracts (as implemented)

```ts
// client.ts — Delphi SDK singleton + unit helpers
client.listMarkets({ status, limit, pricesAndImpliedProbabilities }) → { markets }
client.quoteBuy({ marketAddress: market.id, outcomeIdx, sharesOut })  → { tokensIn }
client.ensureTokenApproval({ marketAddress: market.id, minimumAmount })
client.buyShares({ marketAddress: market.id, outcomeIdx, sharesOut, maxTokensIn }) → { transactionHash }

// screen.ts
screen(markets: any[]): any[]                        // prob ∈ [PROB_MIN, PROB_MAX], sort by |p − 0.5|

// gemini.ts
generateResearchQuestions(market: any): Promise<string[]>          // 3 search queries
estimate(market: any, sources: Source[]): Promise<EstimateResult>  // { prob, reasoning }

// tavily.ts
research(question: string): Promise<Source[]>        // search + extract + relevance filter

// senso.ts
ground(sources: Source[]): Promise<{ scoredSources: ScoredSource[]; citationTrust: number }>

// decide.ts
evaluate(market, est, citationTrust, sources) → { action: "BUY"|"SKIP", edge, rationale, outcomeIdx }

// publish.ts
toCitedMd(record: DecisionRecord): void              // appends to cited.md
toHtml(record: DecisionRecord, questions: string[]): void  // writes output/*.html

// observe.ts
log(record: DecisionRecord): void                    // appends to decisions.jsonl
```

---

## 8. Build status (completed)

The MVP sprint is complete. All items below are done.

| Phase | What was built | Status |
|-------|---------------|--------|
| Setup | Repo scaffold, SDK install, `list-markets.ts` verified | ✅ |
| Delphi wrapper | `client.ts` — SDK singleton, unit helpers, balance checker | ✅ |
| Screening | `screen.ts` — prob band filter [0.30, 0.70], random pick | ✅ |
| Types | `types.ts` — `Source`, `ScoredSource`, `EstimateResult`, `DecisionRecord` | ✅ |
| Gate logic | `decide.ts` — edge + trust + sourceCount gate, per-condition rationale | ✅ |
| Tavily | `tavily.ts` — search + extract + relevance filter; `research(question)` | ✅ |
| Gemini | `gemini.ts` — `generateResearchQuestions()` + `estimate()` with Gemini 2.5 Flash | ✅ |
| Senso | `senso.ts` — heuristic stub (`citationTrust = 0.85`) | ⚠️ stub |
| Orchestrator | `index.ts` — full 9-step pipeline, owns `buyShares` | ✅ |
| Audit trail | `publish.ts` — `toCitedMd()` + `toHtml()` (styled HTML with clickable links) | ✅ |
| Observability | `observe.ts` — JSONL line per decision | ✅ |
| Real trades | 4+ on-chain `buyShares` txns executed on Gensyn testnet | ✅ |
| `cited.md` | Clean — 1 EXECUTED (real Tavily sources + Gemini reasoning) + 1 REJECTED | ✅ |

### Demo script (3 minutes)

1. **"No citation, no trade."** Open `cited.md` — show the gate conditions and the
   rejected entry with a clear, evidence-based rationale.
2. **Rejected trade.** Point to the REJECTED block: `citationTrust 0.85 < TRUST_MIN 0.99` —
   the gate fired before the money moved.
3. **Executed trade.** Point to the EXECUTED block: 15 real sources → Gemini estimated
   15% vs market's 50% → edge 0.35 → BUY "No" → tx hash. Click it.
4. **Name the sponsors:** Gensyn/Delphi (market + execution), Tavily (grounding),
   Gemini (reasoning).

### To demo-reset `cited.md` cleanly

```bash
rm cited.md decisions.jsonl          # wipe audit trail
npm start                            # one real run → EXECUTED entry
TRUST_MIN=0.99 npm start             # one forced rejection → REJECTED entry
```

---

## 9. Wallet + funding (done)

Wallet is funded with Sepolia ETH (bridged to Gensyn testnet) and mock USDC
(claimed via faucet). Trades are live.

Verify at any time: `npm run get-wallet-balances`

To top up USDC if balance drops: the faucet contract gives 1000 mock USDC per
call — see §11.10.

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

## 12. Repo layout (actual)

```
claros/
  CLAUDE.md              ← this file
  .env                   ← keys (gitignored)
  package.json
  tsconfig.json
  src/
    index.ts             ← orchestrator: screen → question → research → estimate → gate → buy → publish
    client.ts            ← Delphi SDK singleton + unit helpers (toUsdc, toShares, toProb, ...)
    types.ts             ← Source, ScoredSource, EstimateResult, DecisionRecord
    screen.ts            ← prob band filter [0.30, 0.70], random pick, top-N closest to 0.5
    gemini.ts            ← generateResearchQuestions() + estimate() via Gemini 2.5 Flash
    tavily.ts            ← research(question) — search + extract + relevance filter
    senso.ts             ← ground() stub: scoredSources + citationTrust = 0.85
    decide.ts            ← evaluate() gate: edge ≥ EDGE_MIN AND trust ≥ TRUST_MIN AND sources ≥ N
    publish.ts           ← toCitedMd() appends to cited.md; toHtml() writes output/*.html
    observe.ts           ← log() appends one JSON line to decisions.jsonl
    list-markets.ts      ← standalone: list/filter markets with probs
    get-wallet-balances.ts ← standalone: ETH + USDC balance check
    research.ts          ← standalone: deep Tavily research for a question → output/*.json + .md
    quote-buy.ts         ← standalone: read-only quote
    buy-shares.ts        ← standalone: manual on-chain buy
    sell-shares.ts       ← standalone: manual on-chain sell
  cited.md               ← audit trail (the hackathon deliverable)
  decisions.jsonl        ← machine-readable decision log
  output/                ← HTML reports, one per decision run
  gensyn-delphi-skills/  ← cloned Delphi skills repo (reference only, do not edit)
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

## 14. Key implementation notes (gotchas)

### `market.id` vs `market.implementation`

**Always use `market.id` as the `marketAddress`** for all SDK calls:
`quoteBuy`, `buyShares`, `ensureTokenApproval`. 

`market.implementation` is the shared logic contract (same address for every
market). Passing it to the gateway causes
`MarketProxyNotDeployedByFactory` reverts. The API docs say use
`implementation`; the API docs are wrong for this SDK version.

### Gemini model name

Use `gemini-2.5-flash`. `gemini-2.0-flash` is deprecated and returns 404.
Override via `GEMINI_MODEL` env var.

### Tavily `research(question)` signature

`research()` takes a **question string**, not a market object. The orchestrator
calls it three times (once per Gemini-generated query) and deduplicates the
results by URL before passing them to `estimate()`.

### Gate never fires SKIP by default

With Senso stubbed at 0.85 and Tavily returning 5–15 sources per question, the
only live gate condition that can fail is `edge < EDGE_MIN`. To force a SKIP for
demo purposes: `TRUST_MIN=0.99 npm start`.

### `spotImpliedProbabilities` is `number[]` (0..1), not bigint

The `listMarkets` call with `pricesAndImpliedProbabilities: true` returns
pre-converted decimal floats on the market object. No `/ 1e18` conversion
needed — use directly as `0..1`.

---

## 15. What's left / next steps

| Item | Priority | Notes |
|------|----------|-------|
| Real Senso integration | Medium | Replace `senso.ts` heuristic stub with actual API call; `SENSO_API_KEY` needed |
| CDP server wallet | Low | Swap `DELPHI_SIGNER_TYPE=cdp_server_wallet` + CDP env vars for production |
| Loop mode | Low | Wrap `runOnce()` in `setInterval` or a cron for fully autonomous operation |
| Subgraph liquidity filter | Low | Use `getSubgraph()` trade counts to screen out illiquid markets in `screen.ts` |
| Position tracking | Low | `client.listPositions()` to track unrealised PnL per market |
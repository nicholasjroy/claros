import "dotenv/config";
import { client }    from "./client.js";
import { screen }    from "./screen.js";
import { research }  from "./tavily.js";
import { ground }    from "./senso.js";
import { estimate }  from "./gemini.js";
import { evaluate }  from "./decide.js";
import { toCitedMd } from "./publish.js";
import { log }       from "./observe.js";
import type { DecisionRecord } from "./types.js";

const SHARES       = BigInt(Math.round(Number(process.env["TRADE_SHARES"] ?? 5) * 1e18));
const SLIPPAGE_BPS = 200n; // 2%

async function runOnce(): Promise<void> {
  console.log("[claros] fetching markets...");
  const { markets } = await client.listMarkets({
    status: "open", limit: 50, skip: 0,
    pricesAndImpliedProbabilities: true,
  });

  const candidates = screen(markets);
  console.log(`[claros] ${markets.length} markets → ${candidates.length} candidates after screen`);

  for (const market of candidates) {
    const question = (market.metadata?.question ?? market.id) as string;
    console.log(`\n[claros] researching: ${question}`);

    const sources                          = await research(market);
    const { scoredSources, citationTrust } = await ground(sources);
    const { prob, reasoning }              = await estimate(market, sources);
    const decision                         = evaluate(market, { prob, reasoning }, citationTrust, scoredSources);

    let txHash: string | null = null;

    if (decision.action === "BUY") {
      const addr = market.implementation as `0x${string}`;
      const { tokensIn }   = await client.quoteBuy({ marketAddress: addr, outcomeIdx: decision.outcomeIdx, sharesOut: SHARES });
      const maxTokensIn    = tokensIn * (10000n + SLIPPAGE_BPS) / 10000n;
      await client.ensureTokenApproval({ marketAddress: addr, minimumAmount: maxTokensIn });
      const { transactionHash } = await client.buyShares({
        marketAddress: addr, outcomeIdx: decision.outcomeIdx, sharesOut: SHARES, maxTokensIn,
      });
      txHash = transactionHash;
      console.log(`[claros] EXECUTED tx: ${txHash}`);
    } else {
      console.log(`[claros] SKIPPED: ${decision.rationale}`);
    }

    const record: DecisionRecord = {
      market, sources: scoredSources, citationTrust, prob, reasoning,
      decision, txHash, timestamp: new Date().toISOString(),
    };

    toCitedMd(record);
    log(record);
  }

  console.log("\n[claros] done — see cited.md and decisions.jsonl");
}

runOnce().catch((err: unknown) => { console.error(err); process.exit(1); });

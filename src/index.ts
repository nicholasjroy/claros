import "dotenv/config";
import { client }                              from "./client.js";
import { screen }                              from "./screen.js";
import { research }                            from "./tavily.js";
import { ground }                              from "./senso.js";
import { generateResearchQuestions, estimate } from "./gemini.js";
import { evaluate }                            from "./decide.js";
import { toCitedMd, toHtml }                  from "./publish.js";
import { log }                                 from "./observe.js";
import type { DecisionRecord, Source }         from "./types.js";

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

  if (candidates.length === 0) {
    console.log("[claros] no candidates found — nothing to do");
    return;
  }

  // Pick one market at random from the screened set
  const market = candidates[Math.floor(Math.random() * candidates.length)]!;
  const marketQuestion = (market.metadata?.question ?? market.id) as string;
  console.log(`\n[claros] selected: ${marketQuestion}`);

  // Generate 3 research questions with Gemini
  console.log("[claros] generating research questions...");
  const questions = await generateResearchQuestions(market);
  questions.forEach((q, i) => console.log(`  [${i + 1}] ${q}`));

  // Research each question with Tavily, then deduplicate by URL
  console.log("[claros] researching...");
  const rawSources: Source[] = [];
  for (const q of questions) {
    const found = await research(q);
    console.log(`  → "${q.slice(0, 60)}…" — ${found.length} sources`);
    rawSources.push(...found);
  }
  const seen     = new Set<string>();
  const sources  = rawSources.filter(s => !seen.has(s.url) && seen.add(s.url));
  console.log(`[claros] ${sources.length} unique sources across all questions`);

  // Ground (Senso stub → fixed trust score)
  const { scoredSources, citationTrust } = await ground(sources);

  // Estimate probability with Gemini
  console.log("[claros] estimating probability...");
  const { prob, reasoning } = await estimate(market, sources);
  const marketProb = (market.spotImpliedProbabilities as number[] | undefined)?.[0] ?? 0.5;
  console.log(`  gemini=${(prob * 100).toFixed(1)}%  market=${(marketProb * 100).toFixed(1)}%`);

  // Gate decision
  const decision = evaluate(market, { prob, reasoning }, citationTrust, scoredSources);
  console.log(`[claros] decision: ${decision.action} — ${decision.rationale}`);

  // Execute trade if gate passes
  let txHash: string | null = null;
  if (decision.action === "BUY") {
    const addr = market.id as `0x${string}`;
    try {
      const { tokensIn }        = await client.quoteBuy({ marketAddress: addr, outcomeIdx: decision.outcomeIdx, sharesOut: SHARES });
      const maxTokensIn         = tokensIn * (10000n + SLIPPAGE_BPS) / 10000n;
      await client.ensureTokenApproval({ marketAddress: addr, minimumAmount: maxTokensIn });
      const { transactionHash } = await client.buyShares({
        marketAddress: addr, outcomeIdx: decision.outcomeIdx, sharesOut: SHARES, maxTokensIn,
      });
      txHash = transactionHash;
      console.log(`[claros] EXECUTED tx: ${txHash}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[claros] trade failed: ${msg.split("\n")[0]}`);
      decision.action    = "SKIP";
      decision.rationale = `trade reverted — ${msg.split("\n")[0]}`;
    }
  }

  const record: DecisionRecord = {
    market, sources: scoredSources, citationTrust, prob, reasoning,
    decision, txHash, timestamp: new Date().toISOString(),
  };

  toCitedMd(record);
  toHtml(record, questions);
  log(record);

  console.log("\n[claros] done — see cited.md, output/*.html, decisions.jsonl");
}

runOnce().catch((err: unknown) => { console.error(err); process.exit(1); });

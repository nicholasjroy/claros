import { appendFileSync } from "fs";
import type { DecisionRecord } from "./types.js";

const JSONL_PATH = "decisions.jsonl";

export function log(r: DecisionRecord): void {
  const line = JSON.stringify({
    timestamp: r.timestamp,
    marketId: r.market.id,
    question: (r.market.metadata?.question ?? r.market.id) as string,
    action: r.decision.action,
    outcomeIdx: r.decision.outcomeIdx,
    edge: r.decision.edge,
    citationTrust: r.citationTrust,
    sourceCount: r.sources.length,
    rationale: r.decision.rationale,
    txHash: r.txHash,
  });
  appendFileSync(JSONL_PATH, line + "\n", "utf8");
}

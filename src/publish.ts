import { appendFileSync } from "fs";
import type { DecisionRecord } from "./types.js";

const CITED_MD = "cited.md";

export function toCitedMd(r: DecisionRecord): void {
  const meta = r.market.metadata ?? {};
  const question = (meta.question ?? r.market.id) as string;
  const outcomeName = (meta.outcomes?.[r.decision.outcomeIdx] ?? `outcome ${r.decision.outcomeIdx}`) as string;
  const status = r.decision.action === "BUY" ? "✅ EXECUTED" : "❌ REJECTED";
  const txLine = r.txHash
    ? `**Tx hash:** \`${r.txHash}\``
    : `**Tx hash:** none (gate rejected)`;

  const sourcesBlock = r.sources.length > 0
    ? r.sources.map(s => `  - [${s.title}](${s.url}) — trust: ${s.trustScore.toFixed(2)}`).join("\n")
    : "  _(no sources)_";

  const block = [
    `## Decision — ${r.timestamp}`,
    ``,
    `**Market:** [${question}](${r.market.marketUrl})`,
    `**Status:** ${status}`,
    `**Outcome targeted:** ${outcomeName} (idx ${r.decision.outcomeIdx})`,
    `**Edge:** ${r.decision.edge.toFixed(4)} | **Citation trust:** ${r.citationTrust.toFixed(2)}`,
    `**Gate rationale:** ${r.decision.rationale}`,
    ``,
    `**Sources (${r.sources.length}):**`,
    sourcesBlock,
    ``,
    `**Gemini reasoning:** ${r.reasoning}`,
    ``,
    txLine,
    ``,
    `---`,
    ``,
  ].join("\n");

  appendFileSync(CITED_MD, block, "utf8");
}

import type { EstimateResult, ScoredSource } from "./types.js";

const EDGE_MIN    = Number(process.env["EDGE_MIN"]    ?? 0.05);
const TRUST_MIN   = Number(process.env["TRUST_MIN"]   ?? 0.70);
const MIN_SOURCES = Number(process.env["MIN_SOURCES"] ?? 2);

export function evaluate(
  market: any,
  est: EstimateResult,
  citationTrust: number,
  sources: ScoredSource[]
): { action: "BUY" | "SKIP"; edge: number; rationale: string; outcomeIdx: number } {
  const marketProb: number = market.spotImpliedProbabilities?.[0] ?? 0.5;
  const edge = Math.abs(est.prob - marketProb);
  // Buy the outcome we think is underpriced relative to the market
  const outcomeIdx = est.prob > marketProb ? 0 : 1;

  if (edge < EDGE_MIN) {
    return { action: "SKIP", edge, outcomeIdx,
      rationale: `edge ${edge.toFixed(3)} < EDGE_MIN ${EDGE_MIN} — insufficient edge` };
  }
  if (citationTrust < TRUST_MIN) {
    return { action: "SKIP", edge, outcomeIdx,
      rationale: `citationTrust ${citationTrust.toFixed(2)} < TRUST_MIN ${TRUST_MIN} — sources not trusted` };
  }
  if (sources.length < MIN_SOURCES) {
    return { action: "SKIP", edge, outcomeIdx,
      rationale: `only ${sources.length} source(s) < MIN_SOURCES ${MIN_SOURCES} — insufficient evidence` };
  }

  const outcomeName = market.metadata?.outcomes?.[outcomeIdx] ?? `outcome ${outcomeIdx}`;
  return {
    action: "BUY", edge, outcomeIdx,
    rationale: `edge=${edge.toFixed(3)} trust=${citationTrust.toFixed(2)} sources=${sources.length} → BUY "${outcomeName}"`,
  };
}

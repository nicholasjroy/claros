import { appendFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { DecisionRecord } from "./types.js";

const CITED_MD = "cited.md";
const OUT_DIR  = "output";

// ─── cited.md ────────────────────────────────────────────────────────────────

export function toCitedMd(r: DecisionRecord): void {
  const meta        = r.market.metadata ?? {};
  const question    = (meta.question    ?? r.market.id)                         as string;
  const outcomeName = (meta.outcomes?.[r.decision.outcomeIdx] ?? `outcome ${r.decision.outcomeIdx}`) as string;
  const status      = r.decision.action === "BUY" ? "✅ EXECUTED" : "❌ REJECTED";
  const txLine      = r.txHash
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

// ─── HTML report ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function toHtml(r: DecisionRecord, researchQuestions: string[]): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const meta        = r.market.metadata ?? {};
  const question    = (meta.question    ?? r.market.id)                         as string;
  const outcomes    = (meta.outcomes    as string[] | undefined)                 ?? ["Yes", "No"];
  const outcomeName = (outcomes[r.decision.outcomeIdx] ?? `outcome ${r.decision.outcomeIdx}`) as string;
  const marketProb  = ((r.market.spotImpliedProbabilities as number[] | undefined)?.[0] ?? 0.5);
  const executed    = r.decision.action === "BUY";
  const badgeClass  = executed ? "badge-executed" : "badge-rejected";
  const badgeText   = executed ? "✅ EXECUTED" : "❌ REJECTED";

  const txBlock = r.txHash
    ? `<div class="tx"><span class="label">On-chain tx</span><code>${esc(r.txHash)}</code><span class="chain">(Gensyn testnet · chain 685685)</span></div>`
    : `<div class="tx rejected">Gate rejected — no trade executed.</div>`;

  const questionsHtml = researchQuestions
    .map((q, i) => `<li><span class="q-num">${i + 1}</span>${esc(q)}</li>`)
    .join("\n");

  const sourcesHtml = r.sources.length > 0
    ? r.sources.map((s, i) => `
      <div class="source-card">
        <div class="source-header">
          <span class="source-num">${i + 1}</span>
          <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
        </div>
        <div class="source-meta">
          <span class="domain">${esc(domainOf(s.url))}</span>
          ${s.publishedAt ? `<span class="date">${esc(s.publishedAt.slice(0, 10))}</span>` : ""}
          <span class="trust">trust ${s.trustScore.toFixed(2)}</span>
        </div>
        <p class="source-snippet">${esc(s.content.slice(0, 400).replace(/\n+/g, " "))}…</p>
      </div>`).join("\n")
    : `<p class="no-sources">No sources passed the relevance threshold — gate should have rejected.</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claros · ${esc(question)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1117; color: #e2e8f0; line-height: 1.6; padding: 2rem 1rem; }
  .container { max-width: 860px; margin: 0 auto; }
  header { margin-bottom: 2rem; border-bottom: 1px solid #2d3748; padding-bottom: 1rem; }
  header h1 { font-size: 1.1rem; color: #63b3ed; letter-spacing: 0.05em; text-transform: uppercase; }
  header p  { font-size: 0.8rem; color: #718096; margin-top: 0.25rem; }
  .market-card { background: #1a202c; border: 1px solid #2d3748; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .market-card h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; }
  .market-card a { color: #63b3ed; text-decoration: none; font-size: 0.85rem; }
  .market-card a:hover { text-decoration: underline; }
  .market-probs { display: flex; gap: 1rem; margin-top: 0.75rem; }
  .prob-chip { background: #2d3748; border-radius: 6px; padding: 0.3rem 0.75rem; font-size: 0.85rem; }
  .prob-chip.targeted { background: #2b6cb0; }
  .badge { display: inline-block; padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; font-size: 0.9rem; margin-bottom: 1rem; }
  .badge-executed { background: #276749; color: #9ae6b4; }
  .badge-rejected { background: #742a2a; color: #fed7d7; }
  section { margin-bottom: 2rem; }
  section h3 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.08em; color: #a0aec0; margin-bottom: 0.75rem; border-bottom: 1px solid #2d3748; padding-bottom: 0.4rem; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
  .metric { background: #1a202c; border: 1px solid #2d3748; border-radius: 8px; padding: 0.75rem 1rem; }
  .metric .label { font-size: 0.75rem; color: #718096; text-transform: uppercase; }
  .metric .value { font-size: 1.3rem; font-weight: 700; color: #e2e8f0; }
  .rationale { background: #1a202c; border-left: 3px solid #4a5568; border-radius: 0 6px 6px 0; padding: 0.75rem 1rem; font-size: 0.9rem; color: #a0aec0; margin-top: 0.75rem; }
  .tx { background: #1a202c; border: 1px solid #2d3748; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.85rem; margin-top: 0.75rem; }
  .tx code { color: #68d391; font-family: monospace; word-break: break-all; }
  .tx .chain { color: #718096; font-size: 0.75rem; margin-left: 0.5rem; }
  .tx.rejected { color: #fc8181; }
  .tx .label { color: #a0aec0; margin-right: 0.5rem; }
  .q-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
  .q-list li { display: flex; align-items: flex-start; gap: 0.75rem; background: #1a202c; border: 1px solid #2d3748; border-radius: 6px; padding: 0.6rem 0.9rem; font-size: 0.9rem; }
  .q-num { background: #2b6cb0; color: #fff; border-radius: 50%; width: 1.4rem; height: 1.4rem; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  blockquote { background: #1a202c; border-left: 3px solid #63b3ed; border-radius: 0 6px 6px 0; padding: 1rem 1.25rem; font-size: 0.95rem; color: #cbd5e0; font-style: italic; }
  .source-card { background: #1a202c; border: 1px solid #2d3748; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; }
  .source-header { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.4rem; }
  .source-num { background: #4a5568; color: #e2e8f0; border-radius: 50%; width: 1.4rem; height: 1.4rem; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .source-header a { color: #63b3ed; font-weight: 500; text-decoration: none; }
  .source-header a:hover { text-decoration: underline; }
  .source-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; margin-bottom: 0.5rem; }
  .domain { color: #63b3ed; }
  .date   { color: #718096; }
  .trust  { background: #2d3748; border-radius: 4px; padding: 0.1rem 0.4rem; color: #a0aec0; }
  .source-snippet { font-size: 0.85rem; color: #a0aec0; line-height: 1.5; }
  footer { margin-top: 3rem; border-top: 1px solid #2d3748; padding-top: 1rem; font-size: 0.75rem; color: #4a5568; }
</style>
</head>
<body>
<div class="container">

<header>
  <h1>Claros · Auditable Trading Agent</h1>
  <p>No citation, no trade. &nbsp;·&nbsp; ${esc(r.timestamp)}</p>
</header>

<div class="market-card">
  <h2>${esc(question)}</h2>
  <a href="${esc(r.market.marketUrl)}" target="_blank" rel="noopener">View on Delphi ↗</a>
  <div class="market-probs">
    ${outcomes.map((o, i) => {
      const p = ((r.market.spotImpliedProbabilities as number[] | undefined)?.[i] ?? (i === 0 ? marketProb : 1 - marketProb));
      const targeted = i === r.decision.outcomeIdx;
      return `<div class="prob-chip${targeted ? " targeted" : ""}">${esc(String(o))} ${(p * 100).toFixed(1)}%${targeted ? " ← target" : ""}</div>`;
    }).join("\n    ")}
  </div>
</div>

<div class="badge ${badgeClass}">${badgeText} — ${esc(outcomeName)}</div>

<section>
  <h3>Gate metrics</h3>
  <div class="metrics">
    <div class="metric"><div class="label">Edge</div><div class="value">${r.decision.edge.toFixed(4)}</div></div>
    <div class="metric"><div class="label">Gemini prob</div><div class="value">${(r.prob * 100).toFixed(1)}%</div></div>
    <div class="metric"><div class="label">Market prob</div><div class="value">${(marketProb * 100).toFixed(1)}%</div></div>
    <div class="metric"><div class="label">Citation trust</div><div class="value">${r.citationTrust.toFixed(2)}</div></div>
    <div class="metric"><div class="label">Sources</div><div class="value">${r.sources.length}</div></div>
  </div>
  <div class="rationale">${esc(r.decision.rationale)}</div>
  ${txBlock}
</section>

<section>
  <h3>Research questions (Gemini-generated)</h3>
  <ol class="q-list">
${questionsHtml}
  </ol>
</section>

<section>
  <h3>Gemini reasoning</h3>
  <blockquote>${esc(r.reasoning)}</blockquote>
</section>

<section>
  <h3>Sources (${r.sources.length})</h3>
${sourcesHtml}
</section>

<footer>
  Generated by Claros · Gensyn testnet · chain 685685 · <a href="${esc(r.market.marketUrl)}" target="_blank" rel="noopener" style="color:#4a5568">market ↗</a>
</footer>

</div>
</body>
</html>`;

  const slug  = question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const stamp = r.timestamp.replace(/[:.]/g, "-");
  const path  = join(OUT_DIR, `${slug}-${stamp}.html`);
  writeFileSync(path, html, "utf8");
  console.log(`[claros] report → ${path}`);
}

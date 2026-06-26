/**
 * Research a Delphi market question with Tavily web search and save results to output/.
 * Usage: npx tsx src/research.ts "<question>"
 *
 * Example:
 *   npx tsx src/research.ts "Will BTC reach $110,000 by the end of 2027?"
 *
 * Requires TAVILY_API_KEY in .env (https://app.tavily.com/).
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tavily } from "@tavily/core";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npx tsx src/research.ts "<question>"');
  process.exit(1);
}

// apiKey is read from TAVILY_API_KEY automatically when omitted.
const tvly = tavily();

// --- Quality knobs -----------------------------------------------------------
const MAX_RESULTS = 15; // candidates Tavily ranks (cap is 20)
const MIN_SCORE = 0.3; // relevance floor; below this is off-topic noise
const MAX_SOURCES = 8; // hard cap on sources we keep + extract

// SEO/affiliate/aggregator domains that match on a stray number or year but
// carry no decision-grade signal. Kept short per the docs' guidance.
const EXCLUDE_DOMAINS = [
  "gobankingrates.com",
  "fool.com",
  "investopedia.com",
  "247wallst.com",
];
// -----------------------------------------------------------------------------

// autoParameters lets Tavily pick topic + timeRange from the query intent, so
// this works for any Delphi category (crypto, politics, sports, ...). We pin
// searchDepth=advanced explicitly: it returns reranked, most-relevant chunks
// (autoParameters may otherwise leave it on "basic" and degrade relevance).
const response = await tvly.search(question, {
  autoParameters: true,
  searchDepth: "advanced",
  chunksPerSource: 3,
  maxResults: MAX_RESULTS,
  includeAnswer: "advanced",
  excludeDomains: EXCLUDE_DOMAINS,
});

const allResults = response.results ?? [];

// Relevance gate: rank by score, keep only on-topic sources, cap the count.
// We deliberately do NOT fall back to "top N" when few pass — padding a thin
// result set with low-score hits is exactly what surfaced junk like NIO vehicle
// deliveries / SpaceX IPO matching on a stray "110,000" / "2027". For a trading
// gate, fewer trustworthy sources beats more noisy ones ("no citation, no trade").
const ranked = [...allResults].sort((a, b) => b.score - a.score);
const kept = ranked.filter((r) => r.score >= MIN_SCORE).slice(0, MAX_SOURCES);

// Second pass: pull clean, full article bodies for the sources that survived
// the gate. Search snippets carry site nav/boilerplate ("Best 0% APR cards…");
// Extract returns the parsed page content in markdown (docs' recommended
// two-step search→extract pattern for comprehensive, decision-grade content).
const extracted = new Map<string, string>();
if (kept.length) {
  try {
    const ex = await tvly.extract(
      kept.map((r) => r.url),
      { extractDepth: "advanced", format: "markdown" }
    );
    for (const r of ex.results ?? []) {
      if (r.rawContent) extracted.set(r.url, r.rawContent);
    }
  } catch (err) {
    console.warn(
      "Extract step failed, falling back to search snippets:",
      (err as Error).message
    );
  }
}

// Extracted pages come back as full-page markdown: the article body is wrapped
// in site nav menus, ticker chips and footers where every item is a link. Strip
// that scaffolding — drop lines that are nothing but links/images (pure nav),
// and for real prose lines keep the anchor text but discard the URLs. The source
// URL itself is preserved separately on `r.url`, so no signal is lost.
const IMG_RE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK_RE = /\[([^\]]*)\]\([^)]*\)/g;
const hasLink = (s: string) => /\[[^\]]*\]\([^)]*\)/.test(s);

const stripMarkup = (raw: string): string => {
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const noImg = line.replace(IMG_RE, "");
    // Residue = what's left after removing links + list/heading scaffolding.
    const residue = noImg
      .replace(LINK_RE, "")
      .replace(/[>#*|\d.\-\s]/g, "")
      .trim();
    // Line is pure navigation (only links + scaffolding, no prose) → drop it.
    if (!residue && hasLink(noImg)) continue;
    out.push(noImg.replace(LINK_RE, "$1"));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

// Merge: prefer the cleaned extracted body, fall back to the search snippet.
const sources = kept.map((r) => {
  const body = extracted.get(r.url);
  return {
    ...r,
    content: body ? stripMarkup(body) : r.content,
    extracted: extracted.has(r.url),
  };
});

const slug = question
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const base = `${slug || "research"}-${stamp}`;

const outDir = join(process.cwd(), "output");
mkdirSync(outDir, { recursive: true });

// Raw payload — kept sources with full extracted content, plus the gate stats
// (found/kept/dropped) for downstream/programmatic use and auditability.
const jsonPath = join(outDir, `${base}.json`);
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      question,
      autoParameters: response.autoParameters,
      answer: response.answer,
      found: allResults.length,
      kept: sources.length,
      dropped: allResults.length - sources.length,
      minScore: MIN_SCORE,
      sources,
    },
    null,
    2
  )
);

// Collapse scraped whitespace and cap length for readability.
// The full, untouched content is always preserved in the .json file.
const SNIPPET_MAX = 2500;
const clean = (s: string) => {
  const flat = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return flat.length > SNIPPET_MAX ? flat.slice(0, SNIPPET_MAX) + "…" : flat;
};
const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const dateOf = (d?: string) => {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
};

// What Tavily auto-selected for this query (topic, timeRange, ...).
const chosen = response.autoParameters
  ? Object.entries(response.autoParameters)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
  : "(defaults)";

// Human-readable summary — synthesized answer plus ranked sources.
const md = [
  `# ${question}`,
  ``,
  `_Researched ${new Date().toLocaleString()} via Tavily — auto: ${chosen}, searchDepth=advanced — ${sources.length} sources kept (of ${allResults.length} found, score ≥ ${MIN_SCORE})_`,
  ``,
  `## Answer`,
  ``,
  response.answer ?? "_(no synthesized answer returned)_",
  ``,
  `## Sources`,
  ``,
  sources.length
    ? sources
        .map((r, i) => {
          const meta = [
            domainOf(r.url),
            dateOf(r.publishedDate),
            `score ${r.score.toFixed(3)}`,
            r.extracted ? "full text" : "snippet",
          ]
            .filter(Boolean)
            .join(" · ");
          return `${i + 1}. [${r.title}](${r.url})\n\n   _${meta}_\n\n   ${clean(r.content)}`;
        })
        .join("\n")
    : `_No sources cleared the relevance floor (score ≥ ${MIN_SCORE}). Treat this market as ungrounded — do not trade on it._`,
  ``,
].join("\n");
const mdPath = join(outDir, `${base}.md`);
writeFileSync(mdPath, md);

console.log(
  `Researched "${question}" — kept ${sources.length}/${allResults.length} sources (score ≥ ${MIN_SCORE}).`
);
console.log(`  ${mdPath}`);
console.log(`  ${jsonPath}`);

import { tavily } from "@tavily/core";
import type { Source } from "./types.js";

const tvly = tavily(); // reads TAVILY_API_KEY automatically

const MAX_RESULTS    = 10;
const MIN_SCORE      = 0.3;
const MAX_SOURCES    = 5;
const EXCLUDE_DOMAINS = ["gobankingrates.com", "fool.com", "investopedia.com", "247wallst.com"];

const IMG_RE  = /!\[[^\]]*\]\([^)]*\)/g;
const LINK_RE = /\[([^\]]*)\]\([^)]*\)/g;
const hasLink = (s: string) => /\[[^\]]*\]\([^)]*\)/.test(s);

function stripMarkup(raw: string): string {
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const noImg  = line.replace(IMG_RE, "");
    const residue = noImg.replace(LINK_RE, "").replace(/[>#*|\d.\-\s]/g, "").trim();
    if (!residue && hasLink(noImg)) continue;
    out.push(noImg.replace(LINK_RE, "$1"));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function research(question: string): Promise<Source[]> {
  const response = await tvly.search(question, {
    autoParameters:  true,
    searchDepth:     "advanced",
    maxResults:      MAX_RESULTS,
    includeAnswer:   "advanced",
    excludeDomains:  EXCLUDE_DOMAINS,
  });

  const kept = (response.results ?? [])
    .sort((a, b) => b.score - a.score)
    .filter(r => r.score >= MIN_SCORE)
    .slice(0, MAX_SOURCES);

  const extracted = new Map<string, string>();
  if (kept.length) {
    try {
      const ex = await tvly.extract(kept.map(r => r.url), { extractDepth: "basic", format: "markdown" });
      for (const r of ex.results ?? []) {
        if (r.rawContent) extracted.set(r.url, stripMarkup(r.rawContent).slice(0, 3000));
      }
    } catch {
      // fall back to search snippets
    }
  }

  return kept.map(r => ({
    url:         r.url,
    title:       r.title,
    content:     extracted.get(r.url) ?? r.content,
    publishedAt: r.publishedDate,
  }));
}

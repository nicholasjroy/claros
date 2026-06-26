import type { Source, ScoredSource } from "./types.js";

// STUB — replace with real Senso API call
export async function ground(sources: Source[]): Promise<{ scoredSources: ScoredSource[]; citationTrust: number }> {
  const scoredSources: ScoredSource[] = sources.map(s => ({ ...s, trustScore: 0.85 }));
  return { scoredSources, citationTrust: 0.85 };
}

const PROB_MIN = Number(process.env["PROB_MIN"] ?? 0.30);
const PROB_MAX = Number(process.env["PROB_MAX"] ?? 0.70);
const MAX_CANDIDATES = Number(process.env["MAX_CANDIDATES"] ?? 3);

export function screen(markets: any[]): any[] {
  return markets
    .filter(m => {
      const probs: number[] | undefined = m.spotImpliedProbabilities;
      if (!probs || probs.length === 0) return false;
      const p = probs[0] ?? 0;
      return p >= PROB_MIN && p <= PROB_MAX;
    })
    .sort((a, b) => {
      const distA = Math.abs((a.spotImpliedProbabilities[0] ?? 0.5) - 0.5);
      const distB = Math.abs((b.spotImpliedProbabilities[0] ?? 0.5) - 0.5);
      return distA - distB; // closest to 0.5 first — most uncertain markets
    })
    .slice(0, MAX_CANDIDATES);
}

export interface Source {
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
}

export interface ScoredSource extends Source {
  trustScore: number;
}

export interface EstimateResult {
  prob: number; // 0..1, probability of outcome 0 being true
  reasoning: string;
}

export interface DecisionRecord {
  market: any;
  sources: ScoredSource[];
  citationTrust: number;
  prob: number;
  reasoning: string;
  decision: {
    action: "BUY" | "SKIP";
    edge: number;
    rationale: string;
    outcomeIdx: number;
  };
  txHash: string | null;
  timestamp: string;
}

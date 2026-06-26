import type { Source, EstimateResult } from "./types.js";

// STUB — replace with real Gemini API call
export async function estimate(_market: any, _sources: Source[]): Promise<EstimateResult> {
  return { prob: 0.65, reasoning: "STUB — replace with real Gemini call" };
}

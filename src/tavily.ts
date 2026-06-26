import type { Source } from "./types.js";

// STUB — replace with real Tavily API call
export async function research(_market: any): Promise<Source[]> {
  return [
    { url: "https://example.com/stub-1", title: "Stub source 1", content: "stub content", publishedAt: new Date().toISOString() },
    { url: "https://example.com/stub-2", title: "Stub source 2", content: "stub content", publishedAt: new Date().toISOString() },
  ];
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Source, EstimateResult } from "./types.js";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const model  = genAI.getGenerativeModel({
  model: process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash",
});

function parseJson<T>(text: string): T {
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  if (!match) throw new Error(`Gemini returned unparseable JSON:\n${text}`);
  return JSON.parse(match[0]) as T;
}

export async function generateResearchQuestions(market: any): Promise<string[]> {
  const question = (market.metadata?.question ?? market.id) as string;
  const outcomes = (market.metadata?.outcomes as string[] | undefined) ?? ["Yes", "No"];

  const prompt = `You are a research analyst for a prediction market.

Market: "${question}"
Outcomes: ${outcomes.join(" / ")}

Generate exactly 3 web search queries to research this market:
1. The market question rephrased as a clear search query
2. A query about recent news or events directly relevant to this outcome
3. A query about historical context, base rates, or expert forecasts relevant to this outcome

Return ONLY a JSON array of 3 strings. No explanation, no markdown fences.`;

  const result = await model.generateContent(prompt);
  const questions = parseJson<string[]>(result.response.text().trim());
  if (!Array.isArray(questions) || questions.length < 2) {
    throw new Error(`Expected array of questions, got: ${JSON.stringify(questions)}`);
  }
  return questions.slice(0, 3);
}

export async function estimate(market: any, sources: Source[]): Promise<EstimateResult> {
  const question   = (market.metadata?.question ?? market.id) as string;
  const outcomes   = (market.metadata?.outcomes as string[] | undefined) ?? ["Yes", "No"];
  const marketProb = (market.spotImpliedProbabilities as number[] | undefined)?.[0] ?? 0.5;

  const ctx = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 600)}`)
    .join("\n\n---\n\n");

  const prompt = `You are a prediction market analyst. Estimate the probability of the first outcome.

Market question: "${question}"
Outcome 0 ("${outcomes[0]}"): current market implied probability = ${(marketProb * 100).toFixed(1)}%
Outcome 1 ("${outcomes[1] ?? "No"}"): ${((1 - marketProb) * 100).toFixed(1)}%

Research context:
${ctx}

Based ONLY on the evidence above, provide:
- prob: your probability estimate for "${outcomes[0]}" (0.0 to 1.0)
- reasoning: 2-3 sentences citing specific sources by number (e.g. "According to [1]...")

Return ONLY valid JSON: {"prob": 0.XX, "reasoning": "..."}`;

  const result  = await model.generateContent(prompt);
  const parsed  = parseJson<{ prob: number; reasoning: string }>(result.response.text().trim());
  const prob    = Math.max(0.01, Math.min(0.99, Number(parsed.prob)));
  return { prob, reasoning: String(parsed.reasoning) };
}

import { z } from "zod";
import type { Env } from "../env";

const SYSTEM_PROMPT = `You are an expert, empathetic automotive mechanic explaining a vehicle recall to an average car owner. Your job is to translate this bureaucratic government recall notice into simple, urgent (but not panic-inducing) language.

Rules:
1. Explain what the part is and what it does in plain English
2. Explain the consequence — what could actually happen if this isn't fixed
3. Explain the remedy — exactly what the dealership will do, and that it's FREE
4. Keep each section to 2-3 sentences maximum
5. Use second person ("your vehicle", "you should")
6. Never invent details not present in the source text

Output ONLY valid JSON with exactly these three keys:
{
  "summary": "...",
  "consequence": "...",
  "remedy": "..."
}

Do not include any text outside the JSON object. No markdown, no code fences, no preamble.`;

const EnrichmentResultSchema = z.object({
  summary: z.string().min(1),
  consequence: z.string().min(1),
  remedy: z.string().min(1),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema> & {
  model: string;
  score: number;
};

function scoreEnrichment(text: string): number {
  let score = 1.0;
  // Penalize for very short responses
  if (text.length < 50) score -= 0.3;
  // Penalize for very long responses (likely hallucination or preamble)
  if (text.length > 1000) score -= 0.2;
  // Penalize if JSON structure looks suspicious
  if (!text.includes('"summary"') || !text.includes('"consequence"')) score -= 0.5;
  return Math.max(0, score);
}

function parseEnrichmentJson(text: string, model: string): EnrichmentResult | null {
  try {
    const parsed = JSON.parse(text.trim());
    const validated = EnrichmentResultSchema.parse(parsed);
    return {
      ...validated,
      model,
      score: scoreEnrichment(text),
    };
  } catch {
    return null;
  }
}

const AI_CALL_TIMEOUT_MS = 45_000;

async function aiRunWithTimeout(env: Env, model: string, messages: any[], maxTokens: number): Promise<string> {
  const result = await Promise.race([
    (env.AI as any).run(model, { messages, max_tokens: maxTokens }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI_CALL_TIMEOUT")), AI_CALL_TIMEOUT_MS)),
  ]);
  return (result as { response?: string }).response ?? "";
}

async function tryWorkersAiEnrichment(env: Env, userMessage: string, model: string): Promise<EnrichmentResult | null> {
  try {
    const text = await aiRunWithTimeout(env, model, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ], 500);
    const parsed = parseEnrichmentJson(text, model);
    if (parsed) return parsed;
    // Retry with correction prompt
    const retryText = await aiRunWithTimeout(env, model, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
      { role: "assistant", content: text },
      { role: "user", content: "Please respond in valid JSON only." },
    ], 500);
    return parseEnrichmentJson(retryText, model);
  } catch {
    return null;
  }
}

export async function enrichRecall(
  env: Env,
  summaryRaw: string,
  consequenceRaw: string,
  remedyRaw: string,
  component: string
): Promise<EnrichmentResult | null> {
  const userMessage = `Component: ${component}

Summary: ${summaryRaw}

Consequence: ${consequenceRaw}

Remedy: ${remedyRaw}`;

  // Primary: fast 8B model — plenty for government-to-plain-English translation
  const primaryResult = await tryWorkersAiEnrichment(env, userMessage, "@cf/meta/llama-3.1-8b-instruct-fp8");
  if (primaryResult) return primaryResult;

  // Fallback: tiny 3B model — fast, should never hit rate limits
  const fallbackResult = await tryWorkersAiEnrichment(env, userMessage, "@cf/meta/llama-3.2-3b-instruct");
  if (fallbackResult) return fallbackResult;

  return null;
}

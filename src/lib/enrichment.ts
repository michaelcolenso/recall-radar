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

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

function parseEnrichmentJson(text: string): EnrichmentResult | null {
  try {
    const parsed = JSON.parse(text.trim());
    return EnrichmentResultSchema.parse(parsed);
  } catch {
    return null;
  }
}

async function tryWorkersAiEnrichment(env: Env, userMessage: string, model: string): Promise<EnrichmentResult | null> {
  try {
    const result = await (env.AI as any).run(model, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
    });
    const text = (result as { response?: string }).response ?? "";
    const parsed = parseEnrichmentJson(text);
    if (parsed) return parsed;
    // Retry
    const retry = await (env.AI as any).run(model, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
        { role: "assistant", content: text },
        { role: "user", content: "Please respond in valid JSON only." },
      ],
      max_tokens: 500,
    });
    const retryText = (retry as { response?: string }).response ?? "";
    return parseEnrichmentJson(retryText);
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

  // Try Workers AI first (primary)
  const primaryResult = await tryWorkersAiEnrichment(env, userMessage, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  if (primaryResult) return primaryResult;

  // Fallback to a faster/smaller model
  const fallbackResult = await tryWorkersAiEnrichment(env, userMessage, "@cf/meta/llama-3.1-8b-instruct");
  if (fallbackResult) return fallbackResult;

  return null;
}

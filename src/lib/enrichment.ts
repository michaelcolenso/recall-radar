import { z } from "zod";

const EnrichmentResultSchema = z.object({
  summary: z.string().min(1),
  consequence: z.string().min(1),
  remedy: z.string().min(1),
});

export interface EnrichmentResult {
  summary: string;
  consequence: string;
  remedy: string;
}

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

function buildUserPrompt(recall: {
  component: string;
  summaryRaw: string;
  consequenceRaw: string;
  remedyRaw: string;
}): string {
  return `Recall Component: ${recall.component}

Original Summary: ${recall.summaryRaw}

Original Consequence: ${recall.consequenceRaw}

Original Remedy: ${recall.remedyRaw}`;
}

async function callAnthropicApi(
  systemPrompt: string,
  userPrompt: string,
  isRetry = false,
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  messages.push({ role: "user", content: userPrompt });

  if (isRetry) {
    messages.push({
      role: "assistant",
      content: "I need to provide valid JSON.",
    });
    messages.push({
      role: "user",
      content:
        "Your response was not valid JSON. Please respond with ONLY the JSON object, no other text.",
    });
  }

  const response = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 500,
    temperature: 0.3,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return content.text;
}

async function callOpenAIApi(
  systemPrompt: string,
  userPrompt: string,
  isRetry = false,
): Promise<string> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

  if (isRetry) {
    messages.push({
      role: "assistant",
      content: "I need to provide valid JSON.",
    });
    messages.push({
      role: "user",
      content:
        "Your response was not valid JSON. Please respond with ONLY the JSON object, no other text.",
    });
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    temperature: 0.3,
    messages,
  });

  return response.choices[0]?.message?.content ?? "";
}

function parseEnrichmentResponse(
  text: string,
): EnrichmentResult | null {
  try {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return EnrichmentResultSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function enrichRecall(recall: {
  component: string;
  summaryRaw: string;
  consequenceRaw: string;
  remedyRaw: string;
}): Promise<EnrichmentResult | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    throw new Error(
      "No LLM API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    );
  }

  const userPrompt = buildUserPrompt(recall);
  const useAnthropic = !!anthropicKey;

  const callApi = useAnthropic ? callAnthropicApi : callOpenAIApi;

  // First attempt
  try {
    const text = await callApi(SYSTEM_PROMPT, userPrompt, false);
    const result = parseEnrichmentResponse(text);
    if (result) return result;

    // Retry once with correction message
    const retryText = await callApi(SYSTEM_PROMPT, userPrompt, true);
    const retryResult = parseEnrichmentResponse(retryText);
    if (retryResult) return retryResult;

    console.warn(
      `  Warning: LLM returned invalid JSON after retry for component: ${recall.component}`,
    );
    return null;
  } catch (err) {
    console.warn(
      `  Warning: enrichRecall failed for component ${recall.component}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

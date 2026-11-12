import { z } from "zod";

const SYSTEM_PROMPT = `You are an expert, empathetic automotive mechanic explaining a vehicle recall to an average car owner. Translate bureaucratic government recall notices into simple, urgent (but not panic-inducing) language.

─── RULES ───
1. Explain what the part is and what it does in plain English. If the car owner might not know the part, use analogies (e.g. "the CV joint is like a flexible elbow that connects your transmission to your wheels").
2. Explain the consequence — what could actually happen if this isn't fixed. Be specific about the real-world scenario without exaggerating.
3. Explain the remedy — exactly what the dealership will do, and that it's FREE.
4. Keep each section to 2-3 sentences maximum. Prefer short, direct sentences.
5. Use second person ("your vehicle", "you should", "your dealer").
6. NEVER invent: part numbers, recall dates, VIN ranges, affected vehicle counts, or dollar amounts. Only use information explicitly stated in the source text.
7. NEVER use passive bureaucratic language. Convert "may experience a condition" → "could fail" or "could cause".
9. campaign_date and current_date are supplied with the source. If a notice mailing date is in the past, say letters were scheduled to be mailed on the explicit source date; do not claim they were delivered. Tell the reader to contact their dealer now to confirm repair availability. Never say "in the coming months" or "soon". Anchor timing to the explicit month and year in the filing; if none is supplied, do not invent one.
8. If the component involves airbags, seatbelts, or brakes — use a slightly more urgent tone (these are life-critical). If it's a software update or label issue — keep it factual and calm.

─── EXAMPLE ───

Source:
Component: FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP
Summary: Toyota Motor Engineering & Manufacturing (Toyota) is recalling certain 2020-2021 Toyota Camry vehicles. The fuel pump may fail, causing the engine to stall while driving, increasing the risk of a crash.
Consequence: If the fuel pump fails, the engine may stall while driving, increasing the risk of a crash.
Remedy: Dealers will replace the fuel pump with an improved one, free of charge. Owner notification letters are expected to be mailed March 15, 2021.

Output:
{
  "summary": "The fuel pump in your Camry is the part that sends gasoline from the tank to your engine. In certain 2020-2021 models, this pump can fail without warning while you're driving.",
  "consequence": "If the pump fails on the road, your engine will suddenly shut off — you'll lose power steering and power brakes. This could make it hard to control your vehicle and increase the chance of a collision.",
  "remedy": "Your Toyota dealer will swap out the faulty fuel pump for a redesigned, more reliable version — at no cost to you. The repair is free, and you should schedule it after confirming repair availability with your dealer."
}

─── OUTPUT FORMAT ───
Respond with ONLY a valid JSON object. No markdown, no code fences, no preamble, no trailing text. Exactly this structure:

{"summary":"...","consequence":"...","remedy":"..."}`;

const EnrichmentResultSchema = z.object({
  summary: z.string().min(1),
  consequence: z.string().min(1),
  remedy: z.string().min(1),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema> & {
  model: string;
  score: number;
};

function scoreEnrichment(enriched: { summary: string; consequence: string; remedy: string }): number {
  const { summary, consequence, remedy } = enriched;
  let score = 1.0;

  // ─── Length checks ──────────────────────────────────────────────
  // Too short — likely truncated or empty
  if (summary.length < 30) score -= 0.2;
  if (consequence.length < 20) score -= 0.2;
  if (remedy.length < 20) score -= 0.2;

  // Too long — likely preamble, hallucination, or code-fence leakage
  if (summary.length > 800) score -= 0.15;
  if (consequence.length > 600) score -= 0.15;
  if (remedy.length > 600) score -= 0.15;

  // ─── Bureaucratic language detection ───────────────────────────
  // Penalize for passive/regulatory phrases the LLM should have rewritten
  const bureaucraticPatterns = [
    /may experience a condition/i,
    /subject to the recall/i,
    /pursuant to/i,
    /in accordance with/i,
    /motor vehicle safety standard/i,
    /without charge/i,  // fine but should use "free" per rules
    /owner notification letters/i,
    /dealers? will be instructed/i,
  ];
  for (const pattern of bureaucraticPatterns) {
    const fullText = `${summary} ${consequence} ${remedy}`;
    if (pattern.test(fullText)) score -= 0.05;
  }

  // ─── Hallucination markers ─────────────────────────────────────
  // Penalize if the output contains things we explicitly told the LLM not to invent
  const hallucinationPatterns = [
    /\bVIN\b/i,                        // VIN ranges not in source
    /\baffects?\s+\d[\d,]*\s+vehicles/i, // vehicle counts not in source
    /\$\d[\d,]*/,                       // dollar amounts not in source
    /\bNHTSA Campaign/i,               // should not repeat campaign number
    /\bPart\s*#?\s*[A-Z0-9-]{4,}/i,   // part numbers not in source
  ];
  for (const pattern of hallucinationPatterns) {
    const fullText = `${summary} ${consequence} ${remedy}`;
    if (pattern.test(fullText)) score -= 0.1;
  }

  // ─── Semantic redundancy check ──────────────────────────────────
  // If summary and consequence are nearly identical, the LLM didn't differentiate
  if (summary.length > 30 && consequence.length > 20) {
    const shorter = summary.length < consequence.length ? summary : consequence;
    const longer = summary.length < consequence.length ? consequence : summary;
    // Simple overlap ratio
    const words = new Set(shorter.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const longerWords = longer.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (longerWords.length > 0) {
      const overlapCount = longerWords.filter((w) => words.has(w)).length;
      const overlapRatio = overlapCount / longerWords.length;
      if (overlapRatio > 0.7) score -= 0.2;
    }
  }

  // ─── Contraindications: "free" mention ─────────────────────────
  // The remedy should mention it's free — if not, slight penalty
  if (!remedy.toLowerCase().includes("free") && !remedy.toLowerCase().includes("no cost")) {
    score -= 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

function parseEnrichmentJson(text: string, model: string): EnrichmentResult | null {
  const extracted = extractJsonObject(text);
  if (!extracted) return null;
  try {
    const parsed = JSON.parse(extracted);
    const validated = EnrichmentResultSchema.parse(parsed);
    return {
      ...validated,
      model,
      score: scoreEnrichment(validated),
    };
  } catch {
    return null;
  }
}

export function extractJsonObject(text: string): string | null {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return stripped.slice(start, end + 1);
}

const AI_CALL_TIMEOUT_MS = 45_000;

export async function withAiTimeout<T>(operation:()=>Promise<T>,timeoutMs=AI_CALL_TIMEOUT_MS):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("AI_CALL_TIMEOUT")),timeoutMs);})]);}
 finally{if(timer!==undefined)clearTimeout(timer);}
}

async function aiRunWithTimeout(env: Env, model: string, messages: unknown[], maxTokens: number): Promise<string> {
  const result = await withAiTimeout(()=>env.AI.run(model, { messages, max_tokens: maxTokens } as unknown as Record<string, unknown>));
  return (result as { response?: string }).response ?? "";
}

async function tryWorkersAiEnrichment(env: Env, userMessage: string, model: string): Promise<EnrichmentResult | null> {
  try {
    const text = await aiRunWithTimeout(env, model, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ], 900);
    const parsed = parseEnrichmentJson(text, model);
    if (parsed) return parsed;
    // Retry with correction prompt
    const retryText = await aiRunWithTimeout(env, model, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
      { role: "assistant", content: text },
      { role: "user", content: "Please respond in valid JSON only." },
    ], 900);
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
  component: string,
  campaignDate: string | null = null,
  currentDate = new Date().toISOString().slice(0,10)
): Promise<EnrichmentResult | null> {
  const userMessage = `campaign_date: ${campaignDate ?? "unknown"}\ncurrent_date: ${currentDate}\nComponent: ${component}

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

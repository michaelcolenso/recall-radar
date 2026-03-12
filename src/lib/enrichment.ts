import type { Env } from "../env";

export async function enrichRecall(env: Env, rawSummary: string, component: string): Promise<string | null> {
  const prompt = `Rewrite this vehicle recall in plain English in 2-3 short sentences.\nComponent: ${component}\nRecall: ${rawSummary}`;

  for (const model of [env.WORKERS_AI_MODEL_PRIMARY, env.WORKERS_AI_MODEL_FALLBACK]) {
    try {
      const result = await env.AI.run(model as any, {
        prompt,
        max_tokens: 220,
        temperature: 0.2
      });
      const response = (result as { response?: string }).response;
      if (response && response.length >= 24) return response.trim();
    } catch {
      continue;
    }
  }

  return null;
}

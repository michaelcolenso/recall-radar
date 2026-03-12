import type { Env } from "../env";
import { enrichRecall } from "../lib/enrichment";

export class EnrichmentWorkflow {
  async run(event: { payload?: { batchSize?: number } }, step: { do<T>(name: string, fn: () => Promise<T>): Promise<T> }, env: Env): Promise<{ ok: true; enriched: number }> {
    const batchSize = event.payload?.batchSize ?? 25;

    const recalls = await step.do("load-unenriched", async () =>
      env.DB.prepare("SELECT id, summary_raw, component FROM recalls WHERE enriched_at IS NULL ORDER BY id ASC LIMIT ?").bind(batchSize)
        .all<{ id: number; summary_raw: string; component: string }>())
;

    let enriched = 0;
    for (const row of recalls.results) {
      const summary = await enrichRecall(env, row.summary_raw, row.component);
      if (!summary) continue;
      await env.DB.prepare("UPDATE recalls SET summary_enriched = ?, enriched_at = unixepoch() WHERE id = ?")
        .bind(summary, row.id).run();
      enriched++;
    }

    return { ok: true, enriched };
  }
}

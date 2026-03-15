import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { enrichRecall } from "../lib/enrichment";
import type { Env } from "../env";

interface EnrichmentParams {
  batchSize?: number;
  targetMake?: string;
  concurrency?: number;
}

export class EnrichmentWorkflow extends WorkflowEntrypoint<Env, EnrichmentParams> {
  async run(event: WorkflowEvent<EnrichmentParams>, step: WorkflowStep) {
    const batchSize = event.payload.batchSize ?? 50;
    const concurrency = event.payload.concurrency ?? 3;
    const targetMake = event.payload.targetMake;
    const startedAt = new Date().toISOString();
    let totalEnriched = 0;
    let offset = 0;

    while (true) {
      const rows = await step.do(`fetch-unenriched-batch-${offset}`, async () => {
        let query: string;
        let params: unknown[];

        if (targetMake) {
          query = `SELECT r.id, r.summary_raw, r.consequence_raw, r.remedy_raw, r.component
                   FROM recalls r
                   JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
                   JOIN models m ON m.id = vy.model_id
                   JOIN makes mk ON mk.id = m.make_id
                   WHERE r.enriched_at IS NULL AND mk.name = ?
                   ORDER BY r.created_at ASC LIMIT ?`;
          params = [targetMake, batchSize];
        } else {
          query = `SELECT id, summary_raw, consequence_raw, remedy_raw, component
                   FROM recalls WHERE enriched_at IS NULL ORDER BY created_at ASC LIMIT ?`;
          params = [batchSize];
        }

        const result = await this.env.DB.prepare(query).bind(...params)
          .all<{ id: number; summary_raw: string; consequence_raw: string; remedy_raw: string; component: string }>();
        return result.results;
      });

      if (rows.length === 0) break;

      // Process in chunks of `concurrency`
      const chunks: typeof rows[] = [];
      for (let i = 0; i < rows.length; i += concurrency) {
        chunks.push(rows.slice(i, i + concurrency));
      }

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const chunkEnriched = await step.do(`enrich-batch-${offset}-chunk-${chunkIdx}`, async () => {
          const results = await Promise.allSettled(
            chunk.map(async (row) => {
              const enriched = await enrichRecall(
                this.env,
                row.summary_raw,
                row.consequence_raw,
                row.remedy_raw,
                row.component
              );
              if (!enriched) {
                console.warn(`Enrichment failed for recall ${row.id}, will retry next run`);
                return 0;
              }
              const now = new Date().toISOString();
              await this.env.DB.prepare(
                `UPDATE recalls SET
                   summary_enriched = ?, consequence_enriched = ?, remedy_enriched = ?,
                   enriched_at = ?, updated_at = ?
                 WHERE id = ?`
              ).bind(enriched.summary, enriched.consequence, enriched.remedy, now, now, row.id).run();
              return 1;
            })
          );
          return results.reduce((acc, r) => acc + (r.status === "fulfilled" ? r.value : 0), 0);
        });
        totalEnriched += chunkEnriched;
      }

      if (rows.length < batchSize) break;
      offset += batchSize;
    }

    // Log enrichment run
    await step.do("log-enrichment-run", async () => {
      await this.env.DB.prepare(
        `INSERT INTO ingestion_logs (run_type, target_make, status, records_found, records_saved, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind("enrichment", targetMake ?? null, "completed", totalEnriched, totalEnriched, startedAt, new Date().toISOString()).run();
    });

    return { ok: true, enriched: totalEnriched };
  }
}

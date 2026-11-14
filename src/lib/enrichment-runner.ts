import type {WorkflowStep} from 'cloudflare:workers';
import {enrichRecall} from './enrichment';
export interface EnrichmentParams {batchSize?:number;targetMake?:string;concurrency?:number;maxBatches?:number}
/** Bounded durable batches. Effects and pacing remain inside Workflow steps. */
export async function runEnrichment(env:Env,params:EnrichmentParams,step:WorkflowStep,enrich:typeof enrichRecall=enrichRecall):Promise<{ok:boolean;enriched:number;failures:number;batchLimitReached:boolean}>{
    const batchSize = Math.max(1,Math.min(Math.floor(params.batchSize ?? 8),8));
    const maxBatches=Math.max(1,Math.min(Math.floor(params.maxBatches ?? 250),250));
    const targetMake = params.targetMake;
    const startedAt = await step.do("enrichment-start-time",async()=>new Date().toISOString());
    let totalEnriched = 0, totalFailures=0, totalFound=0;
    let batchNumber = 0;

    // Delay between batches to let Workers AI rate limits reset
    const BATCH_DELAY_MS = 3_000;

    while (batchNumber<maxBatches) {
      const rows = await step.do(`fetch-unenriched-batch-${batchNumber}`, async () => {
        // Max enrichment attempts before marking a recall as permanently failed.
        // After this many tries, the recall is skipped on future runs.
        const MAX_ATTEMPTS = 3;

        let query: string;
        let params: unknown[];

        if (targetMake) {
          query = `SELECT r.id, r.summary_raw, r.consequence_raw, r.remedy_raw, r.component, r.report_received_date
                   FROM recalls r
                   JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
                   JOIN models m ON m.id = vy.model_id
                   JOIN makes mk ON mk.id = m.make_id
                   WHERE r.enriched_at IS NULL
                     AND mk.name = ?
                     AND r.id NOT IN (
                       SELECT recall_id FROM enrichment_failures
                       WHERE resolved = 0
                       GROUP BY recall_id
                       HAVING SUM(attempts) >= ?
                     )
                   ORDER BY r.created_at ASC
                   LIMIT ?`;
          params = [targetMake, MAX_ATTEMPTS, batchSize];
        } else {
          query = `SELECT r.id, r.summary_raw, r.consequence_raw, r.remedy_raw, r.component, r.report_received_date
                   FROM recalls r
                   WHERE r.enriched_at IS NULL
                     AND r.id NOT IN (
                       SELECT recall_id FROM enrichment_failures
                       WHERE resolved = 0
                       GROUP BY recall_id
                       HAVING SUM(attempts) >= ?
                     )
                   ORDER BY r.created_at ASC
                   LIMIT ?`;
          params = [MAX_ATTEMPTS, batchSize];
        }

        const result = await env.DB.prepare(query).bind(...params)
          .all<{ id: number; summary_raw: string; consequence_raw: string; remedy_raw: string; component: string; report_received_date: string | null }>();
        return result.results;
      });

      if (rows.length === 0) break;

      // One step covers the whole fetched batch. One step per recall blows the
      // workflow step cap before a 3,900-row backfill can finish.
      const chunkEnriched = await step.do(`enrich-batch-${batchNumber}`, {timeout:"30 minutes"},async () => {
        let enrichedInChunk = 0, failedInChunk=0;
        for (const row of rows) {
          try {
            const enriched = await enrich(
              env,
              row.summary_raw,
              row.consequence_raw,
              row.remedy_raw,
              row.component,
              row.report_received_date
            );
            const now = new Date().toISOString();

            if (!enriched || enriched.score < 0.5) {
              const errorMsg = !enriched ? "LLM returned null or malformed JSON" : `Low quality score: ${enriched.score}`;
              console.warn(`Enrichment issue for recall ${row.id}: ${errorMsg}`);
              await env.DB.prepare(
                `INSERT INTO enrichment_failures (recall_id, error, attempts, last_attempt_at)
                 VALUES (?, ?, 1, ?)
                 ON CONFLICT(recall_id) DO UPDATE SET
                   attempts = enrichment_failures.attempts + 1,
                   last_attempt_at = excluded.last_attempt_at,
                   error = excluded.error,
                   resolved = 0`
              ).bind(row.id, errorMsg, now).run();
              failedInChunk++;
              continue;
            }

            await env.DB.prepare(
              `UPDATE recalls SET
                 summary_enriched = ?, consequence_enriched = ?, remedy_enriched = ?,
                 enrichment_quality_score = ?, enrichment_model = ?,
                 enriched_at = ?, updated_at = ?
               WHERE id = ?`
            ).bind(
              enriched.summary, enriched.consequence, enriched.remedy,
              Math.round(enriched.score * 100), enriched.model,
              now, now, row.id
            ).run();

            await env.DB.prepare(
              "UPDATE enrichment_failures SET resolved = 1 WHERE recall_id = ?"
            ).bind(row.id).run();
            enrichedInChunk++;
          } catch (err) {
            console.error(`Enrichment error for recall ${row.id}: ${String(err)}`);
            await env.DB.prepare(`INSERT INTO enrichment_failures(recall_id,error,attempts,last_attempt_at) VALUES(?,?,1,?) ON CONFLICT(recall_id) DO UPDATE SET attempts=enrichment_failures.attempts+1,error=excluded.error,last_attempt_at=excluded.last_attempt_at,resolved=0`).bind(row.id,String(err).slice(0,500),new Date().toISOString()).run();
            failedInChunk++;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        return {enriched:enrichedInChunk,failed:failedInChunk};
      });
      totalEnriched += chunkEnriched.enriched;totalFailures+=chunkEnriched.failed;totalFound+=rows.length;

      if (rows.length < batchSize) break;
      batchNumber += 1;

      // Pause between batches to let rate limits reset
      if (batchNumber < maxBatches) {
        await step.sleep(`enrichment-pause-${batchNumber}`,BATCH_DELAY_MS);
      }
    }

    // Log enrichment run
    await step.do("log-enrichment-run", async () => {
      await env.DB.prepare(
        `INSERT INTO ingestion_logs (run_type, target_make, status, records_found, records_saved, started_at, completed_at, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind("enrichment", targetMake ?? null, totalFailures?"completed-with-errors":"completed", totalFound, totalEnriched, startedAt, new Date().toISOString(), totalFailures?`${totalFailures} enrichment attempts failed`:null).run();
    });

    return { ok: totalFailures===0, enriched: totalEnriched, failures:totalFailures, batchLimitReached:batchNumber>=maxBatches };
}

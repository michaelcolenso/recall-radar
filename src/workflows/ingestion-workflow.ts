import { z } from "zod";
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { POPULAR_MAKES, DEFAULT_YEAR_START, DEFAULT_YEAR_END } from "../lib/constants";
import { fetchAllMakes, fetchModelsForMake, fetchRecallsForVehicle } from "../lib/nhtsa-client";
import { classifySeverity } from "../lib/severity";
import { slugify, parseNhtsaDate } from "../lib/utils";
import type { Env } from "../env";

const IngestionParamsSchema = z.object({
  mode: z.enum(["full", "makes-only", "single-make", "delta", "backfill"]),
  targetMake: z.string().optional(),
  yearStart: z.number().int().min(1966).max(new Date().getFullYear() + 2).optional(),
  yearEnd: z.number().int().min(1966).max(new Date().getFullYear() + 2).optional(),
  // delta mode: skip vehicle_year rows checked within this many hours (default 144 = 6 days)
  deltaThresholdHours: z.number().int().min(1).max(8760).optional(),
}).refine(
  (d) => d.yearStart == null || d.yearEnd == null || d.yearStart <= d.yearEnd,
  { message: "yearStart must be <= yearEnd" }
);

type IngestionParams = z.infer<typeof IngestionParamsSchema>;

interface StaleRow {
  model_id: number;
  year: number;
  model_name: string;
  model_slug: string;
  make_name: string;
  make_id: number;
}

const MODELS_PER_BATCH = 5;

export class IngestionWorkflow extends WorkflowEntrypoint<Env, IngestionParams> {
  async run(event: WorkflowEvent<IngestionParams>, step: WorkflowStep) {
    const startedAt = new Date().toISOString();

    const parseResult = IngestionParamsSchema.safeParse(event.payload);
    if (!parseResult.success) {
      await this._logRun(startedAt, "unknown", undefined, "failed", 0, 0, parseResult.error.message);
      return { ok: false, error: parseResult.error.message };
    }

    const { mode, targetMake, yearStart, yearEnd, deltaThresholdHours } = parseResult.data;

    // backfill defaults to full history; full/delta default to rolling window in cron (set by caller)
    const startYear = (mode === "backfill")
      ? (yearStart ?? DEFAULT_YEAR_START)
      : (yearStart ?? DEFAULT_YEAR_START);
    const endYear = yearEnd ?? DEFAULT_YEAR_END;

    // ── Step 1: Fetch all makes from vPIC ──────────────────────────
    const allMakes = await step.do("fetch-all-makes", {
      retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
      timeout: "60 seconds",
    }, fetchAllMakes);

    // ── Step 2: Filter and upsert makes ───────────────────────────
    const filteredMakes = await step.do("filter-and-upsert-makes", async () => {
      const targetMakeList = mode === "single-make" && targetMake
        ? [targetMake.toUpperCase()]
        : [...POPULAR_MAKES];

      const filtered = allMakes.filter((m) =>
        targetMakeList.includes(m.Make_Name.toUpperCase())
      );

      for (const make of filtered) {
        const makeSlug = slugify(make.Make_Name);
        const now = new Date().toISOString();
        await this.env.DB.prepare(
          `INSERT INTO makes (name, slug, nhtsa_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (slug) DO UPDATE SET updated_at = excluded.updated_at, nhtsa_id = excluded.nhtsa_id`
        ).bind(make.Make_Name, makeSlug, make.Make_ID, now, now).run();
      }

      return filtered;
    });

    if (mode === "makes-only") {
      await step.do("log-ingestion-run", () =>
        this._logRun(startedAt, mode, targetMake, "completed", filteredMakes.length, filteredMakes.length)
      );
      return { ok: true };
    }

    const allErrors: string[] = [];
    let totalRecordsSaved = 0;

    // ── Delta mode: process only stale vehicle-year combos ─────────
    if (mode === "delta") {
      const thresholdIso = new Date(
        Date.now() - (deltaThresholdHours ?? 144) * 3_600_000
      ).toISOString();

      const makeNames = filteredMakes.map((m) => m.Make_Name);
      const placeholders = makeNames.map(() => "?").join(",");

      const staleRows = await step.do("fetch-stale-combos", async () => {
        const result = await this.env.DB.prepare(`
          SELECT vy.model_id, vy.year,
                 m.name AS model_name, m.slug AS model_slug,
                 mk.name AS make_name, mk.id AS make_id
          FROM vehicle_years vy
          JOIN models m ON m.id = vy.model_id
          JOIN makes mk ON mk.id = m.make_id
          WHERE mk.name IN (${placeholders})
            AND (vy.last_ingested_at IS NULL OR vy.last_ingested_at < ?)
          ORDER BY vy.last_ingested_at ASC
          LIMIT 5000
        `).bind(...makeNames, thresholdIso).all<StaleRow>();
        return result.results;
      });

      // Batch stale rows using same recall-upsert logic
      const batches: StaleRow[][] = [];
      for (let i = 0; i < staleRows.length; i += MODELS_PER_BATCH) {
        batches.push(staleRows.slice(i, i + MODELS_PER_BATCH));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const result = await step.do(`delta-batch-${batchIdx}`, async () => {
          let count = 0;
          const batchErrors: string[] = [];
          for (const row of batch) {
            try {
              const recalls = await fetchRecallsForVehicle(row.make_name, row.model_name, row.year);
              const now = new Date().toISOString();

              await this.env.DB.prepare(
                `INSERT INTO vehicle_years (model_id, year, created_at, updated_at, last_ingested_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (model_id, year) DO UPDATE SET
                   updated_at = excluded.updated_at,
                   last_ingested_at = excluded.last_ingested_at`
              ).bind(row.model_id, row.year, now, now, now).run();

              if (recalls.length === 0) continue;

              const vyRecord = await this.env.DB.prepare(
                "SELECT id FROM vehicle_years WHERE model_id = ? AND year = ?"
              ).bind(row.model_id, row.year).first<{ id: number }>();
              if (!vyRecord) continue;

              for (const recall of recalls) {
                await this.env.DB.prepare(
                  `INSERT INTO recalls (
                     vehicle_year_id, nhtsa_campaign_number, report_received_date,
                     component, manufacturer, summary_raw, consequence_raw, remedy_raw,
                     severity_level, created_at, updated_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (nhtsa_campaign_number) DO UPDATE SET
                     updated_at = excluded.updated_at,
                     component = excluded.component,
                     manufacturer = excluded.manufacturer`
                ).bind(
                  vyRecord.id,
                  recall.NHTSACampaignNumber,
                  parseNhtsaDate(recall.ReportReceivedDate),
                  recall.Component,
                  recall.Manufacturer || null,
                  recall.Summary,
                  recall.Consequence,
                  recall.Remedy,
                  classifySeverity(recall.Component),
                  now,
                  now
                ).run();
                count++;
              }
            } catch (err) {
              const msg = `${row.make_name} ${row.model_name} ${row.year}: ${String(err)}`;
              console.error(msg);
              batchErrors.push(msg);
            }
          }
          return { count, errors: batchErrors };
        });
        totalRecordsSaved += result.count;
        allErrors.push(...result.errors);
      }

      const finalStatus = allErrors.length > 0 ? "completed-with-errors" : "completed";
      const errorSummary = allErrors.length > 0
        ? `${allErrors.length} errors: ${allErrors.slice(0, 5).join("; ")}${allErrors.length > 5 ? " …" : ""}`
        : undefined;

      await step.do("log-ingestion-run", () =>
        this._logRun(startedAt, mode, targetMake, finalStatus, totalRecordsSaved, totalRecordsSaved, errorSummary)
      );
      return { ok: true, recordsSaved: totalRecordsSaved };
    }

    // ── Full / backfill / single-make: iterate all models × years ──
    for (const make of filteredMakes) {
      const makeSlug = slugify(make.Make_Name);

      const models = await step.do(`fetch-models-${makeSlug}`, {
        retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
        timeout: "60 seconds",
      }, () => fetchModelsForMake(make.Make_ID));

      const upsertedModels = await step.do(`upsert-models-${makeSlug}`, async () => {
        const makeRecord = await this.env.DB.prepare("SELECT id FROM makes WHERE slug = ?")
          .bind(makeSlug).first<{ id: number }>();
        if (!makeRecord) return [];

        const result: Array<{ modelId: number; modelName: string; modelSlug: string; makeDbId: number }> = [];
        const now = new Date().toISOString();

        for (const model of models) {
          const modelSlug = slugify(model.Model_Name);
          await this.env.DB.prepare(
            `INSERT INTO models (make_id, name, slug, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (make_id, slug) DO UPDATE SET updated_at = excluded.updated_at`
          ).bind(makeRecord.id, model.Model_Name, modelSlug, now, now).run();

          const modelRecord = await this.env.DB.prepare("SELECT id FROM models WHERE make_id = ? AND slug = ?")
            .bind(makeRecord.id, modelSlug).first<{ id: number }>();
          if (modelRecord) {
            result.push({ modelId: modelRecord.id, modelName: model.Model_Name, modelSlug, makeDbId: makeRecord.id });
          }
        }
        return result;
      });

      const batches: typeof upsertedModels[] = [];
      for (let i = 0; i < upsertedModels.length; i += MODELS_PER_BATCH) {
        batches.push(upsertedModels.slice(i, i + MODELS_PER_BATCH));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const result = await step.do(`recalls-${makeSlug}-batch-${batchIdx}`, async () => {
          let count = 0;
          const batchErrors: string[] = [];
          for (const model of batch) {
            for (let year = startYear; year <= endYear; year++) {
              try {
                const recalls = await fetchRecallsForVehicle(make.Make_Name, model.modelName, year);
                const now = new Date().toISOString();

                // Always upsert vehicle_year and stamp last_ingested_at, even for 0 recalls
                await this.env.DB.prepare(
                  `INSERT INTO vehicle_years (model_id, year, created_at, updated_at, last_ingested_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT (model_id, year) DO UPDATE SET
                     updated_at = excluded.updated_at,
                     last_ingested_at = excluded.last_ingested_at`
                ).bind(model.modelId, year, now, now, now).run();

                if (recalls.length === 0) continue;

                const vyRecord = await this.env.DB.prepare(
                  "SELECT id FROM vehicle_years WHERE model_id = ? AND year = ?"
                ).bind(model.modelId, year).first<{ id: number }>();
                if (!vyRecord) continue;

                for (const recall of recalls) {
                  await this.env.DB.prepare(
                    `INSERT INTO recalls (
                       vehicle_year_id, nhtsa_campaign_number, report_received_date,
                       component, manufacturer, summary_raw, consequence_raw, remedy_raw,
                       severity_level, created_at, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (nhtsa_campaign_number) DO UPDATE SET
                       updated_at = excluded.updated_at,
                       component = excluded.component,
                       manufacturer = excluded.manufacturer`
                  ).bind(
                    vyRecord.id,
                    recall.NHTSACampaignNumber,
                    parseNhtsaDate(recall.ReportReceivedDate),
                    recall.Component,
                    recall.Manufacturer || null,
                    recall.Summary,
                    recall.Consequence,
                    recall.Remedy,
                    classifySeverity(recall.Component),
                    now,
                    now
                  ).run();
                  count++;
                }
              } catch (err) {
                const msg = `${make.Make_Name} ${model.modelName} ${year}: ${String(err)}`;
                console.error(msg);
                batchErrors.push(msg);
              }
            }
          }
          return { count, errors: batchErrors };
        });
        totalRecordsSaved += result.count;
        allErrors.push(...result.errors);
      }
    }

    const finalStatus = allErrors.length > 0 ? "completed-with-errors" : "completed";
    const errorSummary = allErrors.length > 0
      ? `${allErrors.length} errors: ${allErrors.slice(0, 5).join("; ")}${allErrors.length > 5 ? " …" : ""}`
      : undefined;

    await step.do("log-ingestion-run", () =>
      this._logRun(startedAt, mode, targetMake, finalStatus, totalRecordsSaved, totalRecordsSaved, errorSummary)
    );

    return { ok: true, recordsSaved: totalRecordsSaved };
  }

  private async _logRun(
    startedAt: string,
    runType: string,
    targetMake: string | undefined,
    status: string,
    recordsFound: number,
    recordsSaved: number,
    errorMessage?: string
  ) {
    await this.env.DB.prepare(
      `INSERT INTO ingestion_logs
         (run_type, target_make, status, records_found, records_saved, error_message, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      runType, targetMake ?? null, status, recordsFound, recordsSaved,
      errorMessage ?? null, startedAt, new Date().toISOString()
    ).run();
  }
}

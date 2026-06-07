import { z } from "zod";
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { POPULAR_MAKES, DEFAULT_YEAR_START, YEAR_MAX } from "../lib/constants";
import { fetchAllMakes, fetchModelsForMake, fetchRecallsForVehicle } from "../lib/nhtsa-client";
import { classifySeverity } from "../lib/severity";
import { scoreVehicleYear } from "../lib/risk-score";
import { slugify, parseNhtsaDate } from "../lib/utils";

const IngestionParamsSchema = z
  .object({
    mode: z.enum(["full", "makes-only", "single-make", "delta", "backfill"]),
    targetMake: z.string().optional(),
    yearStart: z.number().int().min(1966).max(YEAR_MAX).optional(),
    yearEnd: z.number().int().min(1966).max(YEAR_MAX).optional(),
    // delta mode: skip vehicle_year rows checked within this many hours (default 144 = 6 days)
    deltaThresholdHours: z.number().int().min(1).max(8760).optional(),
  })
  .refine((d) => d.yearStart == null || d.yearEnd == null || d.yearStart <= d.yearEnd, {
    message: "yearStart must be <= yearEnd",
  });

export type IngestionParams = z.infer<typeof IngestionParamsSchema>;

interface StaleRow {
  model_id: number;
  year: number;
  model_name: string;
  make_name: string;
}

const MODELS_PER_BATCH = 5;
const NHTSA_RATE_LIMIT_MS = 300;

export class IngestionWorkflow extends WorkflowEntrypoint<Env, IngestionParams> {
  async run(event: WorkflowEvent<IngestionParams>, step: WorkflowStep) {
    const startedAt = new Date().toISOString();

    const parseResult = IngestionParamsSchema.safeParse(event.payload);
    if (!parseResult.success) {
      await this._logRun(startedAt, "unknown", undefined, "failed", 0, 0, parseResult.error.message);
      return { ok: false, error: parseResult.error.message };
    }

    const { mode, targetMake, yearStart, yearEnd, deltaThresholdHours } = parseResult.data;

    const startYear = yearStart ?? DEFAULT_YEAR_START;
    // new Date() is safe here — run() executes in a live request context, not at module init time
    const endYear = yearEnd ?? new Date().getFullYear() + 1;

    // ── Step 1: Fetch all makes from vPIC ──────────────────────────
    const allMakes = await step.do(
      "fetch-all-makes",
      {
        retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
        timeout: "60 seconds",
      },
      fetchAllMakes,
    );

    // ── Step 2: Filter and upsert makes ───────────────────────────
    const filteredMakes = await step.do("filter-and-upsert-makes", async () => {
      const targetMakeList = mode === "single-make" && targetMake ? [targetMake.toUpperCase()] : [...POPULAR_MAKES];

      const filtered = allMakes.filter((m) => targetMakeList.includes(m.Make_Name.toUpperCase()));

      const batch = filtered.map((make) => {
        const makeSlug = slugify(make.Make_Name);
        const now = new Date().toISOString();
        return this.env.DB.prepare(
          `INSERT INTO makes (name, slug, nhtsa_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (slug) DO UPDATE SET updated_at = excluded.updated_at, nhtsa_id = excluded.nhtsa_id`,
        ).bind(make.Make_Name, makeSlug, make.Make_ID, now, now);
      });

      if (batch.length > 0) {
        await this.env.DB.batch(batch);
      }

      return filtered;
    });

    if (mode === "makes-only") {
      await step.do("log-ingestion-run", () =>
        this._logRun(startedAt, mode, targetMake, "completed", filteredMakes.length, filteredMakes.length),
      );
      return { ok: true };
    }

    const allErrors: string[] = [];
    let totalRecordsSaved = 0;

    // ── Delta mode: process only stale vehicle-year combos ─────────
    if (mode === "delta") {
      const thresholdIso = new Date(Date.now() - (deltaThresholdHours ?? 144) * 3_600_000).toISOString();

      // Ensure models are up to date before searching for stale/missing combos.
      // Without this, a fresh DB (or newly added models) can never be ingested in delta mode.
      for (const make of filteredMakes) {
        const makeSlug = slugify(make.Make_Name);

        const models = await step.do(`delta-fetch-models-${makeSlug}`, {
          retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
          timeout: "60 seconds",
        }, () => fetchModelsForMake(make.Make_ID));

        await step.do(`delta-upsert-models-${makeSlug}`, async () => {
          const makeRecord = await this.env.DB.prepare("SELECT id FROM makes WHERE slug = ?")
            .bind(makeSlug).first<{ id: number }>();
          if (!makeRecord) return;

          const now = new Date().toISOString();
          for (const model of models) {
            const modelSlug = slugify(model.Model_Name);
            await this.env.DB.prepare(
              `INSERT INTO models (make_id, name, slug, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (make_id, slug) DO UPDATE SET updated_at = excluded.updated_at`
            ).bind(makeRecord.id, model.Model_Name, modelSlug, now, now).run();
          }
        });
      }

      const makeNames = filteredMakes.map((m) => m.Make_Name);
      if (makeNames.length === 0) {
        await step.do("log-ingestion-run", () =>
          this._logRun(startedAt, mode, targetMake, "completed", 0, 0)
        );
        return { ok: true, recordsSaved: 0 };
      }

      const placeholders = makeNames.map(() => "?").join(",");

      const staleRows = await step.do("fetch-stale-combos", async () => {
        const result = await this.env.DB.prepare(
          `SELECT vy.model_id, vy.year,
                  m.name AS model_name, m.slug AS model_slug,
                  mk.name AS make_name, mk.id AS make_id
           FROM vehicle_years vy
           JOIN models m ON m.id = vy.model_id
           JOIN makes mk ON mk.id = m.make_id
           WHERE mk.name IN (${placeholders})
             AND (vy.last_ingested_at IS NULL OR vy.last_ingested_at < ?)
           ORDER BY vy.last_ingested_at ASC
           LIMIT 5000`
        )
          .bind(...makeNames, thresholdIso)
          .all<StaleRow>();
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
              await new Promise((r) => setTimeout(r, NHTSA_RATE_LIMIT_MS));
              const recalls = await fetchRecallsForVehicle(row.make_name, row.model_name, row.year);
              const now = new Date().toISOString();

              await this.env.DB.prepare(
                `INSERT INTO vehicle_years (model_id, year, created_at, updated_at, last_ingested_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (model_id, year) DO UPDATE SET
                   updated_at = excluded.updated_at,
                   last_ingested_at = excluded.last_ingested_at`,
              )
                .bind(row.model_id, row.year, now, now, now)
                .run();

              if (recalls.length === 0) continue;

              const vyRecord = await this.env.DB.prepare("SELECT id FROM vehicle_years WHERE model_id = ? AND year = ?")
                .bind(row.model_id, row.year)
                .first<{ id: number }>();
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
                     manufacturer = excluded.manufacturer`,
                )
                  .bind(
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
                    now,
                  )
                  .run();
                count++;
              }

              // Update risk score for this vehicle year
              try {
                await scoreVehicleYear(this.env.DB, vyRecord.id);
              } catch (scoreErr) {
                console.error(`Failed to score vehicle_year ${vyRecord.id}: ${String(scoreErr)}`);
              }
            } catch (err) {
              const msg = `${row.make_name} ${row.model_name} ${row.year}: ${String(err)}`;
              console.error(msg);
              batchErrors.push(msg);
            }
          }
          return { count, errors: batchErrors };
        });
        totalRecordsSaved += result.count ?? 0;
        if (Array.isArray(result.errors)) {
          allErrors.push(...result.errors);
        }
      }

      const finalStatus = allErrors.length > 0 ? "completed-with-errors" : "completed";
      const errorSummary =
        allErrors.length > 0
          ? `${allErrors.length} errors: ${allErrors.slice(0, 5).join("; ")}${allErrors.length > 5 ? " …" : ""}`
          : undefined;

      await step.do("log-ingestion-run", () =>
        this._logRun(startedAt, mode, targetMake, finalStatus, totalRecordsSaved, totalRecordsSaved, errorSummary),
      );
      return { ok: true, recordsSaved: totalRecordsSaved };
    }

    // ── Full / backfill / single-make: iterate all models × years ──
    for (const make of filteredMakes) {
      const makeSlug = slugify(make.Make_Name);

      const models = await step.do(
        `fetch-models-${makeSlug}`,
        {
          retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
          timeout: "60 seconds",
        },
        () => fetchModelsForMake(make.Make_ID),
      );

      const upsertedModels = await step.do(`upsert-models-${makeSlug}`, async () => {
        const makeRecord = await this.env.DB.prepare("SELECT id FROM makes WHERE slug = ?")
          .bind(makeSlug)
          .first<{ id: number }>();
        if (!makeRecord) return [];

        const now = new Date().toISOString();
        const batch: D1PreparedStatement[] = [];
        const modelData: Array<{ name: string; slug: string }> = [];

        for (const model of models) {
          const modelSlug = slugify(model.Model_Name);
          batch.push(
            this.env.DB.prepare(
              `INSERT INTO models (make_id, name, slug, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (make_id, slug) DO UPDATE SET updated_at = excluded.updated_at`,
            ).bind(makeRecord.id, model.Model_Name, modelSlug, now, now),
          );
          modelData.push({ name: model.Model_Name, slug: modelSlug });
        }

        if (batch.length > 0) {
          // Perform all inserts in one batch
          await this.env.DB.batch(batch);
        }

        // Fetch back all IDs in a second batch to ensure we have them correctly
        const idQueries = modelData.map((m) =>
          this.env.DB.prepare("SELECT id FROM models WHERE make_id = ? AND slug = ?").bind(makeRecord.id, m.slug),
        );
        const idResults = await this.env.DB.batch<{ id: number }>(idQueries);

        return modelData
          .map((m, idx) => ({
            modelId: idResults[idx].results[0]?.id || 0,
            modelName: m.name,
            modelSlug: m.slug,
            makeDbId: makeRecord.id,
          }))
          .filter((m) => m.modelId > 0);
      });

      // One step per model year — keeps each step well under the 1000 subrequest limit
      for (const model of upsertedModels) {
        const years: number[] = [];
        for (let y = startYear; y <= endYear; y++) years.push(y);

        for (const year of years) {
          const result = await step.do(`recalls-${makeSlug}-${model.modelSlug}-${year}`, async () => {
            const now = new Date().toISOString();

            if (mode === "backfill") {
              const existing = await this.env.DB.prepare(
                "SELECT last_ingested_at FROM vehicle_years WHERE model_id = ? AND year = ?",
              )
                .bind(model.modelId, year)
                .first<{ last_ingested_at: string | null }>();
              if (existing?.last_ingested_at) return { count: 0, errors: [] };
            }

            try {
              // fetchRecallsForVehicle already includes a 300ms delay
              const recalls = await fetchRecallsForVehicle(make.Make_Name, model.modelName, year);

              // Upsert vehicle_year and get its ID back in one query
              const vy = await this.env.DB.prepare(
                `INSERT INTO vehicle_years (model_id, year, created_at, updated_at, last_ingested_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (model_id, year) DO UPDATE SET
                   updated_at = excluded.updated_at,
                   last_ingested_at = excluded.last_ingested_at
                 RETURNING id`,
              )
                .bind(model.modelId, year, now, now, now)
                .first<{ id: number }>();

              if (vy && recalls.length > 0) {
                const recallStmts = recalls.map((recall) =>
                  this.env.DB.prepare(
                    `INSERT INTO recalls (
                       vehicle_year_id, nhtsa_campaign_number, report_received_date,
                       component, manufacturer, summary_raw, consequence_raw, remedy_raw,
                       severity_level, created_at, updated_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (nhtsa_campaign_number) DO UPDATE SET
                       updated_at = excluded.updated_at,
                       component = excluded.component,
                       manufacturer = excluded.manufacturer`,
                  ).bind(
                    vy.id,
                    recall.NHTSACampaignNumber,
                    parseNhtsaDate(recall.ReportReceivedDate),
                    recall.Component,
                    recall.Manufacturer || null,
                    recall.Summary,
                    recall.Consequence,
                    recall.Remedy,
                    classifySeverity(recall.Component),
                    now,
                    now,
                  ),
                );
                await this.env.DB.batch(recallStmts);

                // Update risk score for this vehicle year
                try {
                  await scoreVehicleYear(this.env.DB, vy.id);
                } catch (scoreErr) {
                  console.error(`Failed to score vehicle_year ${vy.id}: ${String(scoreErr)}`);
                }
              }

              return { count: recalls.length, errors: [] };
            } catch (err) {
              return { count: 0, errors: [`${make.Make_Name} ${model.modelName} ${year}: ${String(err)}`] };
            }
          });

          totalRecordsSaved += result.count ?? 0;
          if (Array.isArray(result.errors)) {
            allErrors.push(...result.errors);
          }
        }
      }
    }

    const finalStatus = allErrors.length > 0 ? "completed-with-errors" : "completed";
    const errorSummary =
      allErrors.length > 0
        ? `${allErrors.length} errors: ${allErrors.slice(0, 5).join("; ")}${allErrors.length > 5 ? " …" : ""}`
        : undefined;

    await step.do("log-ingestion-run", () =>
      this._logRun(startedAt, mode, targetMake, finalStatus, totalRecordsSaved, totalRecordsSaved, errorSummary),
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
    errorMessage?: string,
  ) {
    await this.env.DB.prepare(
      `INSERT INTO ingestion_logs
         (run_type, target_make, status, records_found, records_saved, error_message, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        runType,
        targetMake ?? null,
        status,
        recordsFound,
        recordsSaved,
        errorMessage ?? null,
        startedAt,
        new Date().toISOString(),
      )
      .run();
  }
}

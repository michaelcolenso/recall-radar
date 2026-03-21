import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import {
  POPULAR_MAKES,
  DEFAULT_YEAR_START,
  DEFAULT_YEAR_END,
} from "../lib/constants";
import {
  fetchAllMakes,
  fetchModelsForMake,
  fetchRecallsForVehicle,
} from "../lib/nhtsa-client";
import { classifySeverity } from "../lib/severity";
import { slugify, parseNhtsaDate } from "../lib/utils";
import type { Env } from "../env";

interface IngestionParams {
  mode: "full" | "makes-only" | "single-make";
  targetMake?: string;
  yearStart?: number;
  yearEnd?: number;
}

const MODELS_PER_BATCH = 5;

export class IngestionWorkflow extends WorkflowEntrypoint<
  Env,
  IngestionParams
> {
  async run(event: WorkflowEvent<IngestionParams>, step: WorkflowStep) {
    const { mode, targetMake, yearStart, yearEnd } = event.payload;
    const startYear = yearStart ?? DEFAULT_YEAR_START;
    const endYear = yearEnd ?? DEFAULT_YEAR_END;
    const startedAt = new Date().toISOString();

    // Step 1: Fetch all makes from vPIC
    const allMakes = await step.do(
      "fetch-all-makes",
      {
        retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
        timeout: "60 seconds",
      },
      fetchAllMakes
    );

    // Step 2: Filter to popular makes (or target make) and upsert into D1
    const filteredMakes = await step.do(
      "filter-and-upsert-makes",
      async () => {
        const targetMakeList =
          mode === "single-make" && targetMake
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
          )
            .bind(make.Make_Name, makeSlug, make.Make_ID, now, now)
            .run();
        }

        return filtered;
      }
    );

    if (mode === "makes-only") {
      await step.do("log-ingestion-run", () =>
        this._logRun(
          startedAt,
          mode,
          targetMake,
          "completed",
          filteredMakes.length,
          filteredMakes.length
        )
      );
      return { ok: true };
    }

    let totalRecordsSaved = 0;

    // Steps 3–6: Per-make model fetch and recall ingestion
    for (const make of filteredMakes) {
      const makeSlug = slugify(make.Make_Name);

      // Fetch models for this make
      const models = await step.do(
        `fetch-models-${makeSlug}`,
        {
          retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
          timeout: "60 seconds",
        },
        () => fetchModelsForMake(make.Make_ID)
      );

      // Upsert models into D1
      const upsertedModels = await step.do(
        `upsert-models-${makeSlug}`,
        async () => {
          const makeRecord = await this.env.DB.prepare(
            "SELECT id FROM makes WHERE slug = ?"
          )
            .bind(makeSlug)
            .first<{ id: number }>();
          if (!makeRecord) return [];

          const result: Array<{
            modelId: number;
            modelName: string;
            modelSlug: string;
            makeDbId: number;
          }> = [];
          const now = new Date().toISOString();

          for (const model of models) {
            const modelSlug = slugify(model.Model_Name);
            await this.env.DB.prepare(
              `INSERT INTO models (make_id, name, slug, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (make_id, slug) DO UPDATE SET updated_at = excluded.updated_at`
            )
              .bind(makeRecord.id, model.Model_Name, modelSlug, now, now)
              .run();

            const modelRecord = await this.env.DB.prepare(
              "SELECT id FROM models WHERE make_id = ? AND slug = ?"
            )
              .bind(makeRecord.id, modelSlug)
              .first<{ id: number }>();
            if (modelRecord) {
              result.push({
                modelId: modelRecord.id,
                modelName: model.Model_Name,
                modelSlug,
                makeDbId: makeRecord.id,
              });
            }
          }
          return result;
        }
      );

      // Batch models for recall ingestion (5 per batch to manage step count)
      const batches: (typeof upsertedModels)[] = [];
      for (let i = 0; i < upsertedModels.length; i += MODELS_PER_BATCH) {
        batches.push(upsertedModels.slice(i, i + MODELS_PER_BATCH));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const saved = await step.do(
          `recalls-${makeSlug}-batch-${batchIdx}`,
          async () => {
            let count = 0;
            for (const model of batch) {
              for (let year = startYear; year <= endYear; year++) {
                try {
                  const recalls = await fetchRecallsForVehicle(
                    make.Make_Name,
                    model.modelName,
                    year
                  );
                  if (recalls.length === 0) continue;

                  // Upsert vehicle_years row
                  const now = new Date().toISOString();
                  await this.env.DB.prepare(
                    `INSERT INTO vehicle_years (model_id, year, created_at, updated_at)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT (model_id, year) DO UPDATE SET updated_at = excluded.updated_at`
                  )
                    .bind(model.modelId, year, now, now)
                    .run();

                  const vyRecord = await this.env.DB.prepare(
                    "SELECT id FROM vehicle_years WHERE model_id = ? AND year = ?"
                  )
                    .bind(model.modelId, year)
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
                         manufacturer = excluded.manufacturer`
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
                        now
                      )
                      .run();
                    count++;
                  }
                } catch (err) {
                  // Log error and continue — single failures don't abort the batch
                  console.error(
                    `Failed ${make.Make_Name} ${model.modelName} ${year}:`,
                    err
                  );
                }
              }
            }
            return count;
          }
        );
        totalRecordsSaved += saved;
      }
    }

    // Log the completed run
    await step.do("log-ingestion-run", () =>
      this._logRun(
        startedAt,
        mode,
        targetMake,
        "completed",
        totalRecordsSaved,
        totalRecordsSaved
      )
    );

    return { ok: true, recordsSaved: totalRecordsSaved };
  }

  private async _logRun(
    startedAt: string,
    runType: string,
    targetMake: string | undefined,
    status: string,
    recordsFound: number,
    recordsSaved: number
  ) {
    await this.env.DB.prepare(
      `INSERT INTO ingestion_logs (run_type, target_make, status, records_found, records_saved, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        runType,
        targetMake ?? null,
        status,
        recordsFound,
        recordsSaved,
        startedAt,
        new Date().toISOString()
      )
      .run();
  }
}

import { POPULAR_MAKES, DEFAULT_YEAR_END, DEFAULT_YEAR_START } from "../lib/constants";
import { fetchMakes, fetchModels, fetchRecalls } from "../lib/nhtsa-client";
import { classifySeverity } from "../lib/severity";
import { slugify } from "../lib/utils";
import type { Env } from "../env";

export class IngestionWorkflow {
  async run(event: { payload?: { makes?: string[]; startYear?: number; endYear?: number } }, step: { do<T>(name: string, fn: () => Promise<T>): Promise<T> }, env: Env): Promise<{ ok: true }> {
    const targetMakes = event.payload?.makes ?? POPULAR_MAKES;
    const startYear = event.payload?.startYear ?? DEFAULT_YEAR_START;
    const endYear = event.payload?.endYear ?? DEFAULT_YEAR_END;

    const sourceMakes = await step.do("fetch-makes", fetchMakes);
    const filtered = sourceMakes.filter((m) => targetMakes.includes(m.Make_Name));

    for (const make of filtered) {
      const makeSlug = slugify(make.Make_Name);
      await step.do(`upsert-make-${makeSlug}`, async () => {
        await env.DB.prepare("INSERT INTO makes (nhtsa_make_id, name, slug) VALUES (?, ?, ?) ON CONFLICT(nhtsa_make_id) DO UPDATE SET name = excluded.name, slug = excluded.slug")
          .bind(make.Make_ID, make.Make_Name, makeSlug).run();
      });

      const makeRecord = await env.DB.prepare("SELECT id FROM makes WHERE nhtsa_make_id = ?").bind(make.Make_ID).first<{ id: number }>();
      if (!makeRecord) continue;

      const models = await step.do(`fetch-models-${makeSlug}`, () => fetchModels(make.Make_Name));
      for (const model of models.slice(0, 20)) {
        const modelSlug = slugify(model.Model_Name);
        await env.DB.prepare("INSERT INTO models (make_id, nhtsa_model_id, name, slug) VALUES (?, ?, ?, ?) ON CONFLICT(make_id, nhtsa_model_id) DO UPDATE SET name = excluded.name, slug = excluded.slug")
          .bind(makeRecord.id, model.Model_ID, model.Model_Name, modelSlug).run();

        const modelRecord = await env.DB.prepare("SELECT id FROM models WHERE make_id = ? AND nhtsa_model_id = ?")
          .bind(makeRecord.id, model.Model_ID).first<{ id: number }>();
        if (!modelRecord) continue;

        for (let year = startYear; year <= endYear; year++) {
          const recalls = await fetchRecalls(make.Make_Name, model.Model_Name, year);
          if (recalls.length === 0) continue;

          await env.DB.prepare("INSERT INTO vehicle_years (make_id, model_id, year) VALUES (?, ?, ?) ON CONFLICT(make_id, model_id, year) DO NOTHING")
            .bind(makeRecord.id, modelRecord.id, year).run();

          for (const recall of recalls) {
            await env.DB.prepare(`INSERT INTO recalls (campaign_number, nhtsa_id, make_id, model_id, year, component, consequence, remedy, summary_raw, severity)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(campaign_number) DO UPDATE SET consequence = excluded.consequence, remedy = excluded.remedy, summary_raw = excluded.summary_raw, severity = excluded.severity`)
              .bind(
                recall.NHTSACampaignNumber,
                recall.NHTSAActionNumber,
                makeRecord.id,
                modelRecord.id,
                year,
                recall.Component,
                recall.Consequence,
                recall.Remedy,
                recall.Summary,
                classifySeverity(recall.Component)
              ).run();
          }
        }
      }
    }

    return { ok: true };
  }
}

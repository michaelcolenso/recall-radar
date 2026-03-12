import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const makes = sqliteTable("makes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nhtsaMakeId: integer("nhtsa_make_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date())
}, (t) => ({
  makeSlugIdx: uniqueIndex("makes_slug_idx").on(t.slug),
  makeNhtsaIdx: uniqueIndex("makes_nhtsa_idx").on(t.nhtsaMakeId)
}));

export const models = sqliteTable("models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  makeId: integer("make_id").notNull(),
  nhtsaModelId: integer("nhtsa_model_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull()
}, (t) => ({
  makeModelSlugIdx: uniqueIndex("models_make_slug_idx").on(t.makeId, t.slug),
  makeModelNhtsaIdx: uniqueIndex("models_make_nhtsa_idx").on(t.makeId, t.nhtsaModelId)
}));

export const vehicleYears = sqliteTable("vehicle_years", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  makeId: integer("make_id").notNull(),
  modelId: integer("model_id").notNull(),
  year: integer("year").notNull()
}, (t) => ({
  vehicleYearUnique: uniqueIndex("vehicle_years_unique_idx").on(t.makeId, t.modelId, t.year)
}));

export const recalls = sqliteTable("recalls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignNumber: text("campaign_number").notNull(),
  nhtsaId: text("nhtsa_id").notNull(),
  makeId: integer("make_id").notNull(),
  modelId: integer("model_id").notNull(),
  year: integer("year").notNull(),
  component: text("component").notNull(),
  consequence: text("consequence").notNull(),
  remedy: text("remedy").notNull(),
  summaryRaw: text("summary_raw").notNull(),
  summaryEnriched: text("summary_enriched"),
  severity: text("severity").notNull(),
  enrichedAt: integer("enriched_at", { mode: "timestamp" })
}, (t) => ({
  recallCampaignIdx: uniqueIndex("recalls_campaign_idx").on(t.campaignNumber),
  recallLookupIdx: uniqueIndex("recalls_make_model_year_idx").on(t.makeId, t.modelId, t.year, t.nhtsaId)
}));

import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ─── MAKES ──────────────────────────────────────────────────────
export const makes = sqliteTable("makes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  nhtsaId: integer("nhtsa_id").unique(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_makes_slug").on(table.slug),
]);

// ─── MODELS ─────────────────────────────────────────────────────
export const models = sqliteTable("models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  makeId: integer("make_id").notNull().references(() => makes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("idx_models_make_slug").on(table.makeId, table.slug),
  index("idx_models_make_id").on(table.makeId),
  index("idx_models_slug").on(table.slug),
]);

// ─── VEHICLE YEARS ──────────────────────────────────────────────
export const vehicleYears = sqliteTable("vehicle_years", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: integer("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("idx_vy_model_year").on(table.modelId, table.year),
  index("idx_vy_model_id").on(table.modelId),
  index("idx_vy_year").on(table.year),
]);

// ─── RECALLS ────────────────────────────────────────────────────
export const severityLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export type SeverityLevel = typeof severityLevels[number];

export const recalls = sqliteTable("recalls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleYearId: integer("vehicle_year_id").notNull().references(() => vehicleYears.id, { onDelete: "cascade" }),
  nhtsaCampaignNumber: text("nhtsa_campaign_number").notNull().unique(),
  reportReceivedDate: text("report_received_date"),
  component: text("component").notNull(),
  manufacturer: text("manufacturer"),

  // Raw NHTSA text (verbatim government language — NEVER overwrite)
  summaryRaw: text("summary_raw").notNull(),
  consequenceRaw: text("consequence_raw").notNull(),
  remedyRaw: text("remedy_raw").notNull(),

  // LLM-enriched text (NULL until enrichment runs)
  summaryEnriched: text("summary_enriched"),
  consequenceEnriched: text("consequence_enriched"),
  remedyEnriched: text("remedy_enriched"),
  enrichedAt: text("enriched_at"),

  // Auto-classified severity
  severityLevel: text("severity_level", { enum: severityLevels }).notNull().default("UNKNOWN"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_recalls_vy_id").on(table.vehicleYearId),
  index("idx_recalls_campaign").on(table.nhtsaCampaignNumber),
  index("idx_recalls_component").on(table.component),
  index("idx_recalls_severity").on(table.severityLevel),
]);

// ─── INGESTION LOGS ─────────────────────────────────────────────
export const ingestionLogs = sqliteTable("ingestion_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runType: text("run_type").notNull(),
  targetMake: text("target_make"),
  status: text("status").notNull(),
  recordsFound: integer("records_found").default(0),
  recordsSaved: integer("records_saved").default(0),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  index("idx_logs_type_status").on(table.runType, table.status),
]);

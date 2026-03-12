CREATE TABLE IF NOT EXISTS makes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nhtsa_make_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make_id INTEGER NOT NULL,
  nhtsa_model_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE(make_id, slug),
  UNIQUE(make_id, nhtsa_model_id)
);

CREATE TABLE IF NOT EXISTS vehicle_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make_id INTEGER NOT NULL,
  model_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  UNIQUE(make_id, model_id, year)
);

CREATE TABLE IF NOT EXISTS recalls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_number TEXT NOT NULL,
  nhtsa_id TEXT NOT NULL,
  make_id INTEGER NOT NULL,
  model_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  component TEXT NOT NULL,
  consequence TEXT NOT NULL,
  remedy TEXT NOT NULL,
  summary_raw TEXT NOT NULL,
  summary_enriched TEXT,
  severity TEXT NOT NULL,
  enriched_at INTEGER,
  UNIQUE(make_id, model_id, year, nhtsa_id)
);

CREATE INDEX IF NOT EXISTS recalls_campaign_idx ON recalls(campaign_number);
CREATE INDEX IF NOT EXISTS recalls_enrichment_idx ON recalls(enriched_at, year);

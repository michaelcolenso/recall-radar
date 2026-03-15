# RecallRadar — Complete Agentic Build Instructions

> **Purpose**: Self-contained instruction set for an agentic coding assistant (Claude Code, Cursor Agent, Copilot Workspace, etc.) to build a production-grade Programmatic SEO web application from scratch, running entirely on the Cloudflare Developer Platform. Follow every phase in sequence. Do not skip steps. Do not improvise architecture — follow these specs exactly.
> 
> **Estimated build time**: 10-15 hours of focused agentic execution across 7 phases.

-----

## REQUIRED READING — Developer Documentation

Before writing any code, read these docs to understand the platform primitives. Do not rely on training data — these APIs change frequently.

### Cloudflare Workers & Runtime

|Doc                 |What to learn                                          |URL                                                         |
|--------------------|-------------------------------------------------------|------------------------------------------------------------|
|Workers Get Started |Project setup, wrangler CLI, deploy flow               |https://developers.cloudflare.com/workers/get-started/guide/|
|Workers Runtime APIs|`fetch`, `scheduled`, env bindings, execution context  |https://developers.cloudflare.com/workers/runtime-apis/     |
|Workers Limits      |CPU time (30s paid), memory (128MB), bundle size (10MB)|https://developers.cloudflare.com/workers/platform/limits/  |

### Hono on Workers (HTTP framework)

|Doc            |What to learn                                                       |URL                                                     |
|---------------|--------------------------------------------------------------------|--------------------------------------------------------|
|Hono on Workers|Setup, bindings as generics, `c.env`, `export default app`          |https://hono.dev/docs/getting-started/cloudflare-workers|
|Hono Routing   |Path parameters, groups, middleware, error handling                 |https://hono.dev/docs/api/routing                       |
|Hono Context   |`c.req`, `c.res`, `c.json()`, `c.html()`, `c.text()`, `c.notFound()`|https://hono.dev/docs/api/context                       |

### Drizzle ORM (type-safe database access)

|Doc                    |What to learn                                           |URL                                             |
|-----------------------|--------------------------------------------------------|------------------------------------------------|
|Drizzle with D1        |D1 adapter setup, `drizzle(env.DB)`, query patterns     |https://orm.drizzle.team/docs/get-started/d1-new|
|Drizzle Schema (SQLite)|`sqliteTable`, column types, indexes, unique constraints|https://orm.drizzle.team/docs/schemas/sqlite    |
|Drizzle Kit            |`drizzle-kit generate`, migration files, config         |https://orm.drizzle.team/docs/kit-overview      |

### Cloudflare D1 (serverless SQLite)

|Doc           |What to learn                                          |URL                                                  |
|--------------|-------------------------------------------------------|-----------------------------------------------------|
|D1 Get Started|Create DB, bindings, wrangler commands                 |https://developers.cloudflare.com/d1/get-started/    |
|D1 Worker API |`env.DB.prepare()`, batch queries, transactions        |https://developers.cloudflare.com/d1/worker-api/     |
|D1 Limits     |10GB per DB, 50k rows per query, 100k writes/day (free)|https://developers.cloudflare.com/d1/platform/limits/|

### Cloudflare Workflows (durable execution)

|Doc                      |What to learn                                              |URL                                                                  |
|-------------------------|-----------------------------------------------------------|---------------------------------------------------------------------|
|Workflows Guide          |`step.do()`, retry config, memoization, params             |https://developers.cloudflare.com/workflows/get-started/guide/       |
|Rules of Workflows       |What can/can’t run inside steps, closures, serialization   |https://developers.cloudflare.com/workflows/build/rules-of-workflows/|
|Workers API for Workflows|`env.WORKFLOW.create()`, `instance.status()`, cron triggers|https://developers.cloudflare.com/workflows/build/workers-api/       |

### Cloudflare Agents SDK (stateful Durable Objects)

|Doc                 |What to learn                                      |URL                                                                         |
|--------------------|---------------------------------------------------|----------------------------------------------------------------------------|
|Agents Overview     |Agent class, state, scheduling, WebSocket          |https://developers.cloudflare.com/agents/                                   |
|Agents API Reference|`Agent` class, `this.setState()`, `this.schedule()`|https://developers.cloudflare.com/agents/api-reference/agents-api/          |
|State & Sync        |`this.sql`, built-in SQLite, state persistence     |https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/|
|Scheduling          |`this.schedule()`, alarms, cron patterns           |https://developers.cloudflare.com/agents/api-reference/schedule-tasks/      |

### Workers KV (edge key-value cache)

|Doc           |What to learn                                     |URL                                              |
|--------------|--------------------------------------------------|-------------------------------------------------|
|KV Get Started|Namespace creation, `env.KV.get()`, `env.KV.put()`|https://developers.cloudflare.com/kv/get-started/|
|KV API        |TTL, metadata, list operations                    |https://developers.cloudflare.com/kv/api/        |

### Workers AI (on-platform LLM)

|Doc                   |What to learn                               |URL                                                 |
|----------------------|--------------------------------------------|----------------------------------------------------|
|Workers AI            |`env.AI.run()`, model catalog, binding setup|https://developers.cloudflare.com/workers-ai/       |
|Text Generation Models|Llama 3.3 70B, model IDs, token limits      |https://developers.cloudflare.com/workers-ai/models/|

### NHTSA API (the data source)

|Doc              |What to learn                           |URL                            |
|-----------------|----------------------------------------|-------------------------------|
|NHTSA Recalls API|Vehicle recall lookup by make/model/year|https://www.nhtsa.gov/nhtsa-api|
|vPIC API         |Get all vehicle makes and models        |https://vpic.nhtsa.dot.gov/api/|

-----

## PROJECT OVERVIEW

**RecallRadar** is a high-traffic programmatic SEO application that:

1. **Ingests** raw vehicle recall data from the NHTSA (National Highway Traffic Safety Administration) government APIs
1. **Enriches** the raw bureaucratic text using an LLM to make it human-readable
1. **Stores** everything in a Cloudflare D1 (SQLite) database
1. **Serves** it via edge-rendered, KV-cached HTML pages optimized for Google indexing
1. **Orchestrates** pipelines via Cloudflare Workflows (durable execution with auto-retry)
1. **Monitors** via a stateful Cloudflare Agent with built-in SQL and scheduling

**Business model**: Capture long-tail search traffic for queries like “2020 Toyota Camry recalls”, “Ford F-150 brake recall”, etc. — thousands of unique pages generated programmatically from structured data.

**Target search queries** (each becomes a unique page):

- `{Year} {Make} {Model} recalls` (e.g., “2020 Toyota Camry recalls”)
- `{Make} recalls` (e.g., “Ford recalls”)
- `{Make} {Model} recalls` (e.g., “Honda CR-V recalls”)

-----

## ARCHITECTURE

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE NETWORK                      │
│                                                                  │
│  ┌─────────────┐    ┌──────────┐    ┌────────────────────────┐  │
│  │  Hono Worker │───>│ D1 (SQL) │    │   Workers KV (cache)   │  │
│  │  (SSR pages) │    └──────────┘    │   Rendered HTML pages  │  │
│  │  (API routes)│                     └────────────────────────┘  │
│  └─────────────┘                                                 │
│         │                                                        │
│  ┌──────┴──────────────────────┐                                 │
│  │       Pipeline Agent        │     ┌─────────────────────────┐ │
│  │  (Durable Object + SQLite)  │────>│  Ingestion Workflow     │ │
│  │  - Scheduling               │     │  (durable, auto-retry)  │ │
│  │  - Run history              │     │  NHTSA API → D1         │ │
│  │  - WebSocket admin UI       │     └─────────────────────────┘ │
│  │  - Stats dashboard          │                                 │
│  │                             │     ┌─────────────────────────┐ │
│  │                             │────>│  Enrichment Workflow    │ │
│  │                             │     │  (durable, auto-retry)  │ │
│  │                             │     │  D1 → LLM → D1         │ │
│  └─────────────────────────────┘     └─────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐                                                │
│  │ Cron Trigger  │  Monday 2AM: ingestion / Monday 4AM: enrich   │
│  └──────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
          ▲                              ▲
          │ HTTP requests                │ NHTSA API calls
          │ (users + Googlebot)          │ (government data)
```

### Tech Stack (Do Not Deviate)

|Layer                |Technology                                                   |Notes                                        |
|---------------------|-------------------------------------------------------------|---------------------------------------------|
|HTTP Framework       |Hono v4 on Workers                                           |Lightweight, fast, full TypeScript           |
|Database             |Cloudflare D1                                                |SQLite semantics, global read replicas       |
|ORM                  |Drizzle ORM + drizzle-kit                                    |Schema-first, D1 adapter, edge-safe          |
|Ingestion Pipeline   |Cloudflare Workflows                                         |Durable steps with automatic retry           |
|Enrichment Pipeline  |Cloudflare Workflows                                         |Per-recall LLM calls as durable steps        |
|Pipeline Orchestrator|Agents SDK                                                   |Stateful admin agent, scheduling, monitoring |
|LLM Enrichment       |Anthropic Claude 3.5 Haiku (primary) OR Workers AI (fallback)|Workers AI for zero-egress cost option       |
|Page Cache           |Workers KV                                                   |Edge-cached HTML with stale-while-revalidate |
|Styling              |Tailwind CSS (CDN or static build)                           |Pre-built HTML templates rendered server-side|
|Validation           |Zod                                                          |Validate all external API responses          |
|Language             |TypeScript (strict mode)                                     |Everywhere — no plain JS files               |
|Package Manager      |npm                                                          |Standard lockfile                            |
|Deployment           |Wrangler                                                     |CLI for deploy, D1 management, secrets       |

### Architecture Decision Records

**Why Hono on Workers, not Next.js?** Workers cold-start in ~1ms vs Next.js ~100ms+. D1 is co-located with the Worker, so DB queries are sub-millisecond. No ISR complexity — Workers KV gives us the same stale-while-revalidate pattern natively. For pSEO serving templated HTML from structured data, Hono is faster, simpler, and natively integrated.

**Why D1 (SQLite) over PostgreSQL?** D1 is zero-config, co-located with Workers for sub-ms queries, supports global read replicas, and costs nothing at small scale. The 10GB limit is plenty for this dataset. SQLite’s single-writer model is fine since writes come from a singleton Workflow, not concurrent users.

**Why Drizzle over Prisma?** Prisma on D1 requires an adapter and preview features. Drizzle has first-class D1 support with no adapters, generates standard SQLite migrations, and has a smaller bundle size (critical for Workers’ 10MB limit).

**Why Cloudflare Workflows for pipelines?** The NHTSA ingestion pipeline takes 15-60 minutes for a full run. Workers have a 30-second CPU limit per request. Each Workflow `step.do()` is automatically retried on failure, memoized (completed steps are skipped on restart), and observable in the dashboard.

**Why separate raw + enriched columns?** We never want to lose the original government text. If the LLM produces a bad enrichment, we fall back to raw. The raw text is also a trust signal for users who want to see the official language.

-----

## REPOSITORY STRUCTURE (Create This Exactly)

```
recall-radar/
├── src/
│   ├── index.ts                              # Main Worker entry (Hono app + scheduled handler)
│   ├── env.ts                                # Env type definition for all bindings
│   ├── agents/
│   │   └── pipeline-agent.ts                 # Admin Agent (scheduling, monitoring, RPC)
│   ├── workflows/
│   │   ├── ingestion-workflow.ts             # NHTSA data ingestion (durable execution)
│   │   └── enrichment-workflow.ts            # LLM enrichment (durable execution)
│   ├── routes/
│   │   ├── pages.ts                          # HTML page routes (SSR + KV cache)
│   │   ├── api.ts                            # Admin JSON API routes
│   │   └── seo.ts                            # sitemap.xml, robots.txt
│   ├── templates/
│   │   ├── layout.ts                         # Base HTML shell (head, nav, footer)
│   │   ├── home.ts                           # Homepage template
│   │   ├── make-page.ts                      # Make landing page
│   │   ├── model-page.ts                     # Model landing page
│   │   ├── year-page.ts                      # Vehicle year page (THE MONEY PAGE)
│   │   └── components/
│   │       ├── recall-card.ts                # Individual recall card
│   │       ├── severity-badge.ts             # Color-coded severity indicator
│   │       ├── breadcrumbs.ts                # Navigation breadcrumbs
│   │       ├── dealer-lead-gen.ts            # Monetization placeholder
│   │       └── json-ld.ts                    # Structured data helpers
│   ├── lib/
│   │   ├── nhtsa-client.ts                   # NHTSA API wrapper with Zod schemas
│   │   ├── enrichment.ts                     # LLM enrichment function (Anthropic or Workers AI)
│   │   ├── severity.ts                       # Component string → severity classifier
│   │   ├── cache.ts                          # KV page cache read-through helper
│   │   ├── utils.ts                          # slugify, date parsing, HTML escaping
│   │   └── constants.ts                      # Popular makes list, year ranges
│   └── db/
│       ├── schema.ts                         # Drizzle schema definition (all tables)
│       ├── client.ts                         # Drizzle client factory from D1 binding
│       └── migrations/                       # Generated by drizzle-kit
├── public/
│   └── styles.css                            # Compiled Tailwind CSS
├── drizzle.config.ts                         # Drizzle Kit configuration
├── wrangler.jsonc                            # Cloudflare Workers config (bindings, crons, etc.)
├── .dev.vars                                 # Local env vars (git-ignored)
├── .dev.vars.example                         # Template for env vars
├── tsconfig.json
├── package.json
└── README.md
```

-----

## PHASE 1: Project Initialization & Database Schema

### Step 1.1: Initialize the Project

```bash
npm create cloudflare@latest recall-radar -- --template "cloudflare/workers"
cd recall-radar
```

Choose TypeScript, “Worker only” template.

### Step 1.2: Install Dependencies

```bash
# Core framework
npm install hono

# Database
npm install drizzle-orm
npm install -D drizzle-kit better-sqlite3

# Agents SDK
npm install agents

# Validation
npm install zod

# LLM (Anthropic for enrichment)
npm install @anthropic-ai/sdk

# Dev
npm install -D @cloudflare/workers-types wrangler
```

### Step 1.3: Configure Wrangler

Write `wrangler.jsonc`:

```jsonc
{
  "name": "recall-radar",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-01",
  "compatibility_flags": ["nodejs_compat"],

  // D1 Database
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "recall-radar-db",
      "database_id": "<your-database-id>"
    }
  ],

  // Workers KV (page cache)
  "kv_namespaces": [
    {
      "binding": "PAGE_CACHE",
      "id": "<your-kv-namespace-id>"
    }
  ],

  // Workers AI
  "ai": {
    "binding": "AI"
  },

  // Workflows
  "workflows": [
    {
      "name": "ingestion-workflow",
      "binding": "INGESTION_WORKFLOW",
      "class_name": "IngestionWorkflow"
    },
    {
      "name": "enrichment-workflow",
      "binding": "ENRICHMENT_WORKFLOW",
      "class_name": "EnrichmentWorkflow"
    }
  ],

  // Agent (Durable Object)
  "durable_objects": {
    "bindings": [
      {
        "name": "PIPELINE_AGENT",
        "class_name": "PipelineAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["PipelineAgent"]
    }
  ],

  // Cron Triggers
  "triggers": {
    "crons": [
      "0 2 * * 1",
      "0 4 * * 1"
    ]
  },

  // Static assets
  "assets": {
    "directory": "./public"
  },

  // Environment variables
  "vars": {
    "SITE_URL": "https://recallradar.com",
    "ENVIRONMENT": "production"
  }
}
```

### Step 1.4: Create the D1 Database and KV Namespace

```bash
npx wrangler d1 create recall-radar-db
# Copy the database_id into wrangler.jsonc

npx wrangler kv namespace create PAGE_CACHE
# Copy the id into wrangler.jsonc
```

### Step 1.5: Define the Environment Type

Write `src/env.ts`:

```typescript
import type { DrizzleD1Database } from "drizzle-orm/d1";

export interface Env {
  DB: D1Database;
  PAGE_CACHE: KVNamespace;
  AI: Ai;
  INGESTION_WORKFLOW: Workflow;
  ENRICHMENT_WORKFLOW: Workflow;
  PIPELINE_AGENT: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  ADMIN_TOKEN: string;
  SITE_URL: string;
  ENVIRONMENT: string;
}
```

### Step 1.6: Define the Drizzle Schema

Write `src/db/schema.ts`:

```typescript
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
```

**IMPORTANT D1/SQLite constraints:**

- No `SERIAL` type — use `integer().primaryKey({ autoIncrement: true })`
- No native `BOOLEAN` — use INTEGER (0/1)
- No native `TIMESTAMP` — store as ISO 8601 TEXT strings
- Upserts use SQLite `ON CONFLICT` syntax

### Step 1.7: Drizzle Client Factory

Write `src/db/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
```

### Step 1.8: Drizzle Kit Config

Write `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
});
```

### Step 1.9: Generate and Apply Migrations

```bash
npx drizzle-kit generate
npx wrangler d1 execute recall-radar-db --local --file=src/db/migrations/0000_initial.sql
npx wrangler d1 execute recall-radar-db --remote --file=src/db/migrations/0000_initial.sql
```

### Step 1.10: Verify Phase 1

```bash
npx wrangler d1 execute recall-radar-db --local \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Expected output: `makes`, `models`, `vehicle_years`, `recalls`, `ingestion_logs`.

-----

## PHASE 2: Data Ingestion via Cloudflare Workflow

### Conceptual Briefing

The ingestion pipeline calls two NHTSA APIs to populate the database. Cloudflare Workflows replace hand-rolled retry logic. Each `step.do()` is:

- Automatically retried on failure (configurable: count, backoff, timeout)
- Memoized — if the workflow restarts, completed steps are skipped
- Observable in the Cloudflare dashboard

### Step 2.1: Popular Makes List

Write `src/lib/constants.ts`:

```typescript
export const POPULAR_MAKES = [
  "ACURA", "AUDI", "BMW", "BUICK", "CADILLAC", "CHEVROLET", "CHRYSLER",
  "DODGE", "FORD", "GMC", "HONDA", "HYUNDAI", "INFINITI", "JEEP",
  "KIA", "LAND ROVER", "LEXUS", "LINCOLN", "MAZDA", "MERCEDES-BENZ",
  "MINI", "MITSUBISHI", "NISSAN", "PORSCHE", "RAM", "SUBARU",
  "TESLA", "TOYOTA", "VOLKSWAGEN", "VOLVO",
] as const;

export const DEFAULT_YEAR_START = 2015;
export const DEFAULT_YEAR_END = new Date().getFullYear() + 1;
```

### Step 2.2: NHTSA Client

Write `src/lib/nhtsa-client.ts` — a wrapper around three NHTSA API endpoints. Every response MUST be validated with Zod.

**Endpoint 1 — Get All Makes (vPIC API)**

```
GET https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json
```

Returns `{ Count: number, Results: [{ Make_ID: number, Make_Name: string }] }` — note **capital** `Results`.

**Endpoint 2 — Get Models for Make (vPIC API)**

```
GET https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/{makeId}?format=json
```

Returns `{ Count: number, Results: [{ Make_ID, Make_Name, Model_ID, Model_Name }] }` — capital `Results`.

**Endpoint 3 — Get Recalls for Vehicle (Recalls API)**

```
GET https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}
```

Returns `{ Count: number, results: [{ ... }] }` — note **lowercase** `results` (different from vPIC!).

Recall result fields to extract:

- `NHTSACampaignNumber` — the unique recall ID
- `ReportReceivedDate` — format “DD/MM/YYYY”
- `Component` — e.g., “FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP”
- `Manufacturer`
- `Summary` — raw bureaucratic text
- `Consequence` — raw consequence text
- `Remedy` — raw remedy text

**Rate limiting**: Add a 300ms delay between consecutive API calls. Wrap each call with a 15-second timeout and retry logic (3 retries, exponential backoff from 2 seconds).

### Step 2.3: Severity Classifier

Write `src/lib/severity.ts`:

```typescript
const SEVERITY_MAP: Record<string, SeverityLevel> = {
  // CRITICAL — life-threatening
  "ENGINE": "CRITICAL",
  "FUEL SYSTEM": "CRITICAL",
  "BRAKE": "CRITICAL",
  "STEERING": "CRITICAL",
  "POWER TRAIN": "CRITICAL",

  // HIGH — serious safety concern
  "AIR BAG": "HIGH",
  "SEAT BELT": "HIGH",
  "SUSPENSION": "HIGH",
  "TIRE": "HIGH",
  "WHEEL": "HIGH",

  // MEDIUM — reduced visibility/control
  "ELECTRICAL": "MEDIUM",
  "LIGHTING": "MEDIUM",
  "VISIBILITY": "MEDIUM",
  "WINDSHIELD WIPER": "MEDIUM",

  // LOW — cosmetic or minor
  "LABEL": "LOW",
  "SEAT": "LOW",
  "EXTERIOR LIGHTING": "LOW",
};

export function classifySeverity(component: string): SeverityLevel {
  const upper = component.toUpperCase();
  for (const [keyword, level] of Object.entries(SEVERITY_MAP)) {
    if (upper.includes(keyword)) return level;
  }
  return "UNKNOWN";
}
```

### Step 2.4: Slugify Utility

Write `src/lib/utils.ts`:

```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseNhtsaDate(dateStr: string): string | null {
  // NHTSA uses "DD/MM/YYYY" format
  const parts = dateStr?.split("/");
  if (!parts || parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

### Step 2.5: Ingestion Workflow

Write `src/workflows/ingestion-workflow.ts`:

**Parameters:**

```typescript
interface IngestionParams {
  mode: "full" | "makes-only" | "single-make";
  targetMake?: string;
  yearStart?: number;
  yearEnd?: number;
}
```

**Workflow steps (each is a `step.do()`):**

1. **`fetch-all-makes`** — Call vPIC API, return makes array. Retry config: 3 retries, exponential backoff from 2s, 60s timeout.
1. **`filter-and-upsert-makes`** — Filter to popular makes (or target make), upsert into D1 `makes` table using `INSERT ... ON CONFLICT (slug) DO UPDATE SET updated_at = ...`. Return filtered make list.
1. **`fetch-models-{makeSlug}`** (one step PER make) — Call vPIC models API for this make. If make #12 fails, makes 1–11 are already persisted.
1. **`upsert-models-{makeSlug}`** (one step PER make) — Upsert into D1 `models` table.
1. **`recalls-{makeSlug}-batch-{n}`** — For each make, batch models into groups of 5. For each model in the batch, iterate years from `yearStart` to `yearEnd`:
- Call the Recalls API
- If recalls exist, upsert `vehicle_years` row
- Upsert each recall with auto-classified severity
- Add 300ms courtesy delay between API calls
- If a single model-year fails, log error and continue (do NOT fail the batch)
1. **`log-ingestion-run`** — Write to `ingestion_logs` table with final counts.

**All database writes MUST be upserts** — `INSERT ... ON CONFLICT ... DO UPDATE`. The workflow must be safe to re-run at any time.

**Step limit awareness**: Workers Paid allows 10,000 steps per Workflow. For 30 makes × ~40 models × 10 years, you need batching. Use `MODELS_PER_BATCH = 5` to keep step count manageable. Use smaller year ranges per run if needed.

### Step 2.6: Admin API Routes

Write `src/routes/api.ts`:

```
POST /api/admin/ingest   — triggers IngestionWorkflow with params from request body
GET  /api/admin/ingest/:id — returns workflow status
POST /api/admin/enrich   — triggers EnrichmentWorkflow
GET  /api/admin/enrich/:id — returns workflow status
```

Authenticate all admin routes with `Authorization: Bearer {ADMIN_TOKEN}`.

### Step 2.7: Cron Trigger Handler

In `src/index.ts`, export the `scheduled` handler:

```typescript
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 2 * * 1") {
      // Monday 2 AM UTC — ingestion
      await env.INGESTION_WORKFLOW.create({
        params: {
          mode: "full",
          yearStart: new Date().getFullYear() - 2,
          yearEnd: new Date().getFullYear() + 1,
        },
      });
    }
    if (event.cron === "0 4 * * 1") {
      // Monday 4 AM UTC — enrichment
      await env.ENRICHMENT_WORKFLOW.create({
        params: { batchSize: 100, concurrency: 3 },
      });
    }
  },
};
```

### Step 2.8: Verify Phase 2

```bash
npx wrangler dev

# Trigger ingestion
curl -X POST http://localhost:8787/api/admin/ingest \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"mode": "single-make", "targetMake": "TOYOTA", "yearStart": 2023, "yearEnd": 2024}'

# Check status
curl http://localhost:8787/api/admin/ingest/<workflow-id> \
  -H "Authorization: Bearer your-admin-token"

# Verify data
npx wrangler d1 execute recall-radar-db --local \
  --command "SELECT COUNT(*) FROM recalls"
```

-----

## PHASE 3: LLM Enrichment Pipeline

### Step 3.1: Enrichment Function

Write `src/lib/enrichment.ts`:

**System prompt** (use exactly this):

```
You are an expert, empathetic automotive mechanic explaining a vehicle recall to an average car owner. Your job is to translate this bureaucratic government recall notice into simple, urgent (but not panic-inducing) language.

Rules:
1. Explain what the part is and what it does in plain English
2. Explain the consequence — what could actually happen if this isn't fixed
3. Explain the remedy — exactly what the dealership will do, and that it's FREE
4. Keep each section to 2-3 sentences maximum
5. Use second person ("your vehicle", "you should")
6. Never invent details not present in the source text

Output ONLY valid JSON with exactly these three keys:
{
  "summary": "...",
  "consequence": "...",
  "remedy": "..."
}

Do not include any text outside the JSON object. No markdown, no code fences, no preamble.
```

**Primary model**: Anthropic Claude 3.5 Haiku (`claude-3-5-haiku-20241022`), `max_tokens: 500`, `temperature: 0.3`.

**Fallback model**: Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via `env.AI.run()`.

**Retry logic**: If JSON parsing fails, retry once with “respond in valid JSON only” appended. If still fails, return `null` (skip this recall, it will be retried on next enrichment run).

**Validate output** with Zod:

```typescript
const EnrichmentResultSchema = z.object({
  summary: z.string().min(1),
  consequence: z.string().min(1),
  remedy: z.string().min(1),
});
```

### Step 3.2: Enrichment Workflow

Write `src/workflows/enrichment-workflow.ts`:

**Parameters:**

```typescript
interface EnrichmentParams {
  batchSize?: number;     // Default: 50
  targetMake?: string;    // Optional: only enrich this make
  concurrency?: number;   // Default: 3
}
```

**Steps:**

1. **`fetch-unenriched-batch-{offset}`** — Query recalls where `enriched_at IS NULL`, ordered by `created_at ASC`, `LIMIT batchSize`.
1. **`enrich-batch-{n}-chunk-{m}`** — Process `concurrency` recalls in parallel with `Promise.allSettled`. For each:
- Call `enrichRecall()` with the raw text
- On success: UPDATE recall row with enriched text + set `enriched_at` to current ISO datetime
- On failure: log warning, skip (will be retried next run)
1. Repeat batches until no more unenriched recalls remain.
1. **`log-enrichment-run`** — Write counts to `ingestion_logs`.

### Step 3.3: Verify Phase 3

```bash
curl -X POST http://localhost:8787/api/admin/enrich \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 5}'

# Verify enriched text
npx wrangler d1 execute recall-radar-db --local \
  --command "SELECT summary_enriched FROM recalls WHERE enriched_at IS NOT NULL LIMIT 1"
```

-----

## PHASE 4: Frontend — Hono SSR + KV Page Cache

### Design Approach

Render HTML strings server-side in Hono route handlers. Cache the rendered output in Workers KV with TTLs. No React, no client-side JS, no hydration. Pages are pure HTML + Tailwind CSS — exactly what Googlebot wants.

### Step 4.1: KV Cache Helper

Write `src/lib/cache.ts`:

```typescript
export async function getCachedOrRender(
  kv: KVNamespace,
  cacheKey: string,
  ttlSeconds: number,
  renderFn: () => Promise<string>
): Promise<string> {
  const cached = await kv.get(cacheKey);
  if (cached) return cached;

  const html = await renderFn();
  await kv.put(cacheKey, html, { expirationTtl: ttlSeconds });
  return html;
}
```

### Step 4.2: HTML Templates

All templates are TypeScript functions that return HTML strings. Use Hono’s `html` tagged template literal or plain string concatenation.

**Layout** (`src/templates/layout.ts`):

- HTML5 doctype, charset, viewport meta
- Tailwind CSS via CDN (`<link>` to `https://cdn.tailwindcss.com`)
- Navigation bar with site name + search link
- Footer with data attribution + last updated date
- Slots for: `title`, `description`, `canonical`, `body`, `jsonLd`

**Severity Badge Colors:**

```typescript
const SEVERITY_CONFIG = {
  CRITICAL: { label: "Critical Safety Issue", bg: "bg-red-600", text: "text-white" },
  HIGH:     { label: "High Priority",         bg: "bg-orange-500", text: "text-white" },
  MEDIUM:   { label: "Moderate Concern",      bg: "bg-yellow-500", text: "text-black" },
  LOW:      { label: "Minor Issue",           bg: "bg-slate-400", text: "text-white" },
  UNKNOWN:  { label: "Under Review",          bg: "bg-gray-300", text: "text-gray-700" },
};
```

**Recall Card**: Use enriched text when available, fall back to raw. Show a subtle “(Simplified)” or “(Original NHTSA language)” indicator.

**Dealer Lead Gen Placeholder**: Render a visually distinct card with zip code input + “Find Nearby Dealers” CTA. Non-functional for now — it’s a monetization slot for the future.

### Step 4.3: Page Routes

Write `src/routes/pages.ts` with these routes:

**`GET /`** — Homepage

- Hero: “Is Your Car Safe?”
- Stats bar: total recalls, vehicles covered, makes tracked
- Grid of all makes as clickable cards linking to `/{makeSlug}`
- KV cache TTL: 86400 (24 hours)

**`GET /:makeSlug`** — Make Landing Page

- Breadcrumb: Home > {Make}
- H1: “{Make} Vehicle Recalls & Safety Issues”
- Grid of models with year ranges and recall counts per model
- KV cache TTL: 86400

**`GET /:makeSlug/:modelSlug`** — Model Landing Page

- Breadcrumb: Home > {Make} > {Model}
- H1: “{Make} {Model} Recalls by Year”
- Grid of year cards with recall counts and highest severity badge
- KV cache TTL: 86400

**`GET /:makeSlug/:modelSlug/:year`** — THE MONEY PAGE

- Breadcrumb: Home > {Make} > {Model} > {Year}
- H1: “{Year} {Make} {Model} Recalls”
- Summary stats: total count, highest severity, date range
- Dealer lead gen monetization block
- All recall cards sorted by severity (CRITICAL first) then date
- JSON-LD: FAQPage + BreadcrumbList schemas
- KV cache TTL: 43200 (12 hours)

**404 handling**: Return a styled “Vehicle Not Found” page for unknown slugs. Include links to browse by make.

### Step 4.4: Cache-Control Headers

Set on every page response:

```typescript
c.header("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
```

The `s-maxage` controls how long Cloudflare’s CDN caches pages. `stale-while-revalidate` serves the cached version while fetching a fresh one in the background.

### Step 4.5: Verify Phase 4

```bash
npx wrangler dev
# Navigate to:
# /                     — homepage with make grid
# /toyota               — Toyota models
# /toyota/camry         — Camry year cards
# /toyota/camry/2020    — recall cards with severity badges
```

-----

## PHASE 5: Technical SEO

This is critical for the business model. Every page must be optimized for Google.

### Step 5.1: Dynamic Metadata

For the money page (`/:makeSlug/:modelSlug/:year`):

**Title tag**: `{Year} {Make} {Model} Recalls: {TopComponent} Issues Explained | RecallRadar`

Where `{TopComponent}` is the first segment of the component string from the most severe recall. If no recalls: `{Year} {Make} {Model} Recall & Safety Information | RecallRadar`

**Meta description**: `Check {count} known recalls for the {Year} {Make} {Model}. Get plain-English explanations of {topComponent} issues and find out how to get free repairs at your local dealer.`

**Canonical URL**: `https://recallradar.com/{makeSlug}/{modelSlug}/{year}`

**Open Graph**: og:title, og:description, og:type=“article”, og:url

### Step 5.2: JSON-LD Structured Data

Inject two JSON-LD schemas into every money page via `<script type="application/ld+json">`:

**Schema 1: FAQPage** (targets Google FAQ rich snippets)

Map each recall into a Question/Answer pair:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the {Component} recall for the {Year} {Make} {Model}? (Campaign #{CampaignNumber})",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{enrichedSummary} {enrichedConsequence} {enrichedRemedy}"
      }
    }
  ]
}
```

Use enriched text if available, fall back to raw.

**Schema 2: BreadcrumbList**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://recallradar.com" },
    { "@type": "ListItem", "position": 2, "name": "{Make}", "item": "https://recallradar.com/{makeSlug}" },
    { "@type": "ListItem", "position": 3, "name": "{Model}", "item": "https://recallradar.com/{makeSlug}/{modelSlug}" },
    { "@type": "ListItem", "position": 4, "name": "{Year}", "item": "https://recallradar.com/{makeSlug}/{modelSlug}/{year}" }
  ]
}
```

### Step 5.3: Sitemap

Write `src/routes/seo.ts`:

**`GET /sitemap.xml`** — Query D1 for ALL makes, models, and vehicle years. Generate XML sitemap:

- Homepage: priority 1.0, changefreq daily
- Makes: priority 0.8, changefreq weekly
- Models: priority 0.7, changefreq weekly
- Vehicle years (money pages): priority 0.9, changefreq weekly

Cache the sitemap in KV for 24 hours.

If URL count exceeds 50,000, implement a sitemap index with split files (`/sitemap-makes.xml`, `/sitemap-years-1.xml`, etc.).

**`GET /robots.txt`**:

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://recallradar.com/sitemap.xml
```

### Step 5.4: Verify Phase 5

1. Visit `/sitemap.xml` — confirm all Make/Model/Year URLs are listed
1. Visit `/robots.txt` — confirm it references the sitemap
1. View page source on a vehicle year page — confirm JSON-LD scripts are valid
1. Validate JSON-LD at https://validator.schema.org/

-----

## PHASE 6: Pipeline Agent (Admin + Monitoring)

### Step 6.1: Pipeline Agent

Write `src/agents/pipeline-agent.ts` — extends `Agent` from `agents` package.

**Persistent state** via `this.setState()`:

```typescript
interface PipelineState {
  lastIngestionRun: string | null;     // ISO datetime
  lastEnrichmentRun: string | null;
  activeWorkflows: Array<{
    id: string;
    type: "ingestion" | "enrichment";
    startedAt: string;
    status: string;
  }>;
}
```

**Built-in SQLite** (`this.sql`) for run history:

```sql
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL,
  type TEXT NOT NULL,
  params TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  result TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
```

**RPC methods** the agent exposes:

- `triggerIngestion(params)` — create IngestionWorkflow instance, log in SQLite
- `triggerEnrichment(params)` — create EnrichmentWorkflow instance, log in SQLite
- `getStatus()` — return current state + last 10 pipeline runs
- `getStats()` — query D1 for total makes, models, vehicle years, recalls, enrichment coverage

### Step 6.2: Wire Agent into API Routes

Update `src/routes/api.ts` to route admin commands through the PipelineAgent instead of directly creating workflows. The agent becomes the single orchestration point.

-----

## PHASE 7: Deployment & Configuration

### Step 7.1: Environment Variables

`.dev.vars.example`:

```env
CLOUDFLARE_ACCOUNT_ID=abc123
CLOUDFLARE_DATABASE_ID=def456
CLOUDFLARE_D1_TOKEN=your-api-token
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_TOKEN=your-secret-admin-token
```

Production secrets via `wrangler secret put`:

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ADMIN_TOKEN
```

### Step 7.2: npm Scripts

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply recall-radar-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply recall-radar-db --remote",
    "db:studio": "drizzle-kit studio",
    "cf-typegen": "wrangler types"
  }
}
```

### Step 7.3: Deploy

```bash
# Generate DB migrations and apply to remote D1
npx drizzle-kit generate
npx wrangler d1 migrations apply recall-radar-db --remote

# Deploy Worker + Workflows + Agent
npx wrangler deploy

# Trigger initial ingestion
curl -X POST https://recallradar.com/api/admin/ingest \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"mode": "single-make", "targetMake": "TOYOTA", "yearStart": 2020}'

# After ingestion completes, trigger enrichment
curl -X POST https://recallradar.com/api/admin/enrich \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50}'
```

### Step 7.4: Custom Domain

```bash
npx wrangler domains add recallradar.com
```

-----

## TESTING & VALIDATION CHECKLIST

### Database Integrity

- [ ] All tables created in D1 (`wrangler d1 execute`)
- [ ] `makes` table has ~30 popular makes with unique slugs
- [ ] `recalls` table has unique campaign numbers, no duplicates
- [ ] Severity levels are auto-populated for common components

### Ingestion Workflow

- [ ] POST `/api/admin/ingest` starts the workflow and returns instance ID
- [ ] GET `/api/admin/ingest/:id` shows progress
- [ ] Running ingestion twice does NOT create duplicates (upserts work)
- [ ] Failed NHTSA calls retry with backoff; single failures don’t abort pipeline
- [ ] Workflow observable in Cloudflare dashboard

### Enrichment Workflow

- [ ] POST `/api/admin/enrich` starts enrichment
- [ ] LLM returns valid JSON with summary/consequence/remedy
- [ ] Enriched text is plain English, not government jargon
- [ ] Failed enrichments are skipped, not fatal
- [ ] Only processes rows where `enriched_at IS NULL`

### Frontend

- [ ] Homepage renders with make grid and stats
- [ ] `/{makeSlug}` shows all models for that make
- [ ] `/{makeSlug}/{modelSlug}/{year}` shows recall cards with severity badges
- [ ] Enriched text displayed when available; raw text fallback works
- [ ] No broken HTML; valid semantic structure

### SEO

- [ ] Title tags match pattern: `{Year} {Make} {Model} Recalls: {Component} Issues Explained`
- [ ] Meta descriptions are unique per page with recall counts
- [ ] JSON-LD FAQPage schema validates at validator.schema.org
- [ ] JSON-LD BreadcrumbList present on all pages
- [ ] `/sitemap.xml` lists all Make/Model/Year URLs
- [ ] `/robots.txt` references sitemap
- [ ] Canonical URLs set on all pages

### Performance

- [ ] Vehicle year pages cached in KV with 12-hour TTL
- [ ] Make/model pages cached with 24-hour TTL
- [ ] D1 queries use indexes (no full table scans)
- [ ] Cache-Control headers present on all page responses

### Cron Triggers

- [ ] Weekly ingestion cron fires on Monday 2 AM UTC
- [ ] Weekly enrichment cron fires on Monday 4 AM UTC
- [ ] Test locally: `wrangler dev --test-scheduled` then hit `/__scheduled`

-----

## ERROR RECOVERY PROCEDURES

**D1 migration fails**: Check the SQL in `src/db/migrations/`. D1 uses SQLite dialect, not PostgreSQL. Run `npx wrangler d1 execute recall-radar-db --local --file=path/to/migration.sql` to debug.

**Ingestion workflow crashes mid-run**: Check workflow status via the admin API. All writes are upserts, so it’s safe to re-trigger. Completed steps are memoized and won’t re-run.

**Workers AI / Anthropic returns garbage**: The enrichment function catches parse errors and returns null. Unenriched recalls (where `enriched_at IS NULL`) will be retried on the next enrichment run. To force re-enrichment of a specific recall, set its `enriched_at` back to NULL in D1.

**NHTSA API is down**: Workflow steps automatically retry 3× with exponential backoff. If still failing after all retries, the step fails and the Workflow pauses. Resume manually once the API is back.

**Sitemap too large**: If URL count exceeds 50,000, split into a sitemap index: `/sitemap-index.xml` pointing to `/sitemap-makes.xml`, `/sitemap-years-1.xml`, etc.

**D1 row limits hit**: D1 supports up to 10GB per database. If you approach this limit, archive older fiscal year data to R2 (Cloudflare object storage) and keep only the last 5-10 years in D1.

**Durable Object errors**: Check `wrangler tail` for live logs. If a DO gets wedged, deploy a new migration tag in `wrangler.jsonc`.

**KV cache stale after data refresh**: After each ingestion/enrichment run, invalidate relevant KV keys. Or set shorter TTLs and rely on `stale-while-revalidate` to handle freshness.

-----

## POST-LAUNCH PRIORITIES

1. **Submit sitemap to Google Search Console** on day 1
1. **Manually request indexing** for the top 50 highest-value pages (popular makes × recent years)
1. **Monitor Google Search Console** for indexing status — target 100+ pages indexed within 60 days
1. **Add internal linking density** — every page should link to 5+ related pages
1. **Create one link-magnet page** (e.g., “Most Recalled Cars of 2025”) and promote on LinkedIn/Reddit
1. **Add GA4 or Plausible analytics** to track organic traffic growth
1. **Build the email capture** — gated “Vehicle Safety Report” PDF for lead gen
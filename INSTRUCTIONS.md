# RecallRadar — Agentic Build Instructions for Cloudflare Workers + Agents

> **For**: An agentic coding assistant (Claude Code, Cursor Agent, Copilot Workspace, Windsurf, etc.)
> 
> **What you are building**: A production-grade Programmatic SEO web application that ingests U.S. government vehicle recall data, enriches it with AI, and serves tens of thousands of SEO-optimized pages from the Cloudflare edge.
> 
> **Rule**: Read the linked documentation BEFORE writing code for each phase. The Cloudflare platform has specific patterns and constraints. Do not guess — read the docs first.

-----

## TABLE OF CONTENTS

1. [Pre-Build: Read These Docs First](#pre-build-read-these-docs-first)
1. [Project Overview](#project-overview)
1. [Architecture & Tech Stack](#architecture--tech-stack)
1. [Repository Structure](#repository-structure)
1. [Phase 1: Project Init & D1 Database Schema](#phase-1-project-initialization--d1-database-schema)
1. [Phase 2: Ingestion Workflow](#phase-2-data-ingestion-via-cloudflare-workflow)
1. [Phase 3: LLM Enrichment Workflow](#phase-3-llm-enrichment-via-cloudflare-workflow)
1. [Phase 4: Hono SSR Frontend + KV Cache](#phase-4-frontend--hono-ssr--kv-page-cache)
1. [Phase 5: Technical SEO](#phase-5-technical-seo)
1. [Phase 6: Pipeline Agent (Admin + Monitoring)](#phase-6-pipeline-agent-admin--monitoring)
1. [Phase 7: Deployment & Verification](#phase-7-deployment--verification)
1. [Error Recovery](#error-recovery)
1. [Architecture Decision Records](#architecture-decision-records)

-----

## PRE-BUILD: READ THESE DOCS FIRST

**CRITICAL**: Before writing ANY code, you MUST read these documentation pages to understand the platform primitives. Each link is annotated with what to look for.

### Cloudflare Workers (the compute layer)

|Doc                   |What to learn                                                      |URL                                                              |
|----------------------|-------------------------------------------------------------------|-----------------------------------------------------------------|
|Workers Overview      |Understand V8 isolate model, env bindings, module syntax           |https://developers.cloudflare.com/workers/                       |
|Workers Get Started   |Project scaffolding with `create-cloudflare`, wrangler.jsonc config|https://developers.cloudflare.com/workers/get-started/guide/     |
|Wrangler Configuration|All binding types, cron triggers, migrations, environment variables|https://developers.cloudflare.com/workers/wrangler/configuration/|
|Workers Runtime APIs  |`fetch`, `scheduled`, `ExecutionContext`, environment bindings     |https://developers.cloudflare.com/workers/runtime-apis/          |

### Cloudflare D1 (the database)

|Doc                  |What to learn                                                                  |URL                                                         |
|---------------------|-------------------------------------------------------------------------------|------------------------------------------------------------|
|D1 Overview          |SQLite semantics, 10GB per database, read replicas                             |https://developers.cloudflare.com/d1/                       |
|D1 Get Started       |Create database, run schema, local vs remote execution                         |https://developers.cloudflare.com/d1/get-started/           |
|D1 Worker Binding API|`env.DB.prepare()`, `.bind()`, `.run()`, `.all()`, `.first()`, batch operations|https://developers.cloudflare.com/d1/worker-api/            |
|D1 SQL Statements    |SQLite-compatible SQL, supported PRAGMAs, FTS5, JSON functions                 |https://developers.cloudflare.com/d1/sql-api/sql-statements/|
|D1 Data Import       |Load data from SQL files, CSV import                                           |https://developers.cloudflare.com/d1/import-export/import/  |

### Cloudflare Workflows (durable execution for pipelines)

|Doc                      |What to learn                                                        |URL                                                                     |
|-------------------------|---------------------------------------------------------------------|------------------------------------------------------------------------|
|Workflows Overview       |What durable execution means, step-based programming model           |https://developers.cloudflare.com/workflows/                            |
|Build Your First Workflow|`WorkflowEntrypoint`, `step.do()`, `step.sleep()`, retry config      |https://developers.cloudflare.com/workflows/get-started/guide/          |
|Workers API for Workflows|`WorkflowStep`, `WorkflowEvent`, `NonRetryableError`, step limits    |https://developers.cloudflare.com/workflows/build/workers-api/          |
|Rules of Workflows       |Idempotency, state hibernation, no in-memory state between steps     |https://developers.cloudflare.com/workflows/build/rules-of-workflows/   |
|Trigger Workflows        |`env.MY_WORKFLOW.create()`, `.get()`, `.status()`, bindings          |https://developers.cloudflare.com/workflows/build/trigger-workflows/    |
|Sleeping and Retrying    |Backoff strategies, `WorkflowStepConfig`, timeout config             |https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/|
|Build a Durable AI Agent |Agent + Workflow integration, `AgentWorkflow`, `broadcastToClients()`|https://developers.cloudflare.com/workflows/get-started/durable-agents/ |

### Cloudflare Agents SDK (stateful orchestration)

|Doc                       |What to learn                                                              |URL                                                                         |
|--------------------------|---------------------------------------------------------------------------|----------------------------------------------------------------------------|
|Agents Overview           |What agents are, Durable Object foundation, SQL + state                    |https://developers.cloudflare.com/agents/                                   |
|Agents Quick Start        |Create an agent, `this.setState`, `this.sql`, wrangler config              |https://developers.cloudflare.com/agents/getting-started/quick-start/       |
|Agents API Reference      |Full `Agent` class API, lifecycle methods, properties                      |https://developers.cloudflare.com/agents/api-reference/agents-api/          |
|Agent Class Internals     |How Agent extends DurableObject, state storage, SQL API, RPC               |https://developers.cloudflare.com/agents/concepts/agent-class/              |
|Store and Sync State      |`setState()`, `onStateChanged()`, `this.sql` template tag, when to use each|https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/|
|Schedule Tasks            |`this.schedule()`, cron strings, `onScheduledTask()`                       |https://developers.cloudflare.com/agents/api-reference/schedule-tasks/      |
|Run Workflows from Agents |`runWorkflow()`, `AgentWorkflow`, progress callbacks, state updates        |https://developers.cloudflare.com/agents/api-reference/run-workflows/       |
|Callable Methods          |`@callable()` decorator, RPC from clients, stream support                  |https://developers.cloudflare.com/agents/api-reference/callable-methods/    |
|Configuration             |Durable Object bindings, migrations, `new_sqlite_classes`                  |https://developers.cloudflare.com/agents/api-reference/configuration/       |
|Workflows Concept (Agents)|Agent + Workflow patterns, durable vs non-durable operations               |https://developers.cloudflare.com/agents/concepts/workflows/                |

### Workers KV (edge cache)

|Doc           |What to learn                                                       |URL                                              |
|--------------|--------------------------------------------------------------------|-------------------------------------------------|
|KV Overview   |Eventually consistent key-value store, edge caching                 |https://developers.cloudflare.com/kv/            |
|KV Get Started|Create namespace, `env.KV.get()`, `.put()`, `.delete()`, TTL options|https://developers.cloudflare.com/kv/get-started/|

### Hono (HTTP framework)

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

### NHTSA API (the data source)

|Doc                 |What to learn                           |URL                            |
|--------------------|----------------------------------------|-------------------------------|
|NHTSA Recalls API   |Vehicle recall lookup by make/model/year|https://www.nhtsa.gov/nhtsa-api|
|vPIC API (All Makes)|Get all vehicle makes and models        |https://vpic.nhtsa.dot.gov/api/|

### GitHub Reference Projects

|Repo             |Why to study it                                |URL                                         |
|-----------------|-----------------------------------------------|--------------------------------------------|
|Agents Starter   |Reference for Agent + WebSocket + tools pattern|https://github.com/cloudflare/agents-starter|
|Agents SDK source|Canonical patterns, examples directory         |https://github.com/cloudflare/agents        |

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

## ARCHITECTURE & TECH STACK

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

### Stack Table

|Layer              |Technology                    |Why                                                          |
|-------------------|------------------------------|-------------------------------------------------------------|
|HTTP Framework     |**Hono v4** on Workers        |Ultra-fast, familiar Express-like API, native Workers support|
|Database           |**Cloudflare D1**             |Serverless SQLite, global read replicas, zero provisioning   |
|ORM                |**Drizzle ORM** (D1 adapter)  |Type-safe, lightweight, edge-compatible (no binary engine)   |
|Ingestion Pipeline |**Cloudflare Workflows**      |Durable steps with automatic retry, survives crashes         |
|Enrichment Pipeline|**Cloudflare Workflows**      |Per-recall LLM calls as individually retryable steps         |
|Admin Orchestrator |**Agents SDK**                |Stateful Durable Object with SQL, scheduling, WebSocket      |
|LLM Enrichment     |**Anthropic Claude 3.5 Haiku**|Cost-effective for high volume, JSON mode                    |
|Page Cache         |**Workers KV**                |Edge-cached HTML, TTL-based expiration (ISR equivalent)      |
|Validation         |**Zod**                       |Validate all external API responses                          |
|Language           |**TypeScript** (strict mode)  |Everywhere — no plain JS files                               |
|Deployment         |**Wrangler**                  |CLI for deploy, D1 management, secrets                       |

**Do NOT use**: Next.js, Prisma, PostgreSQL, Vercel, Supabase, or any external database. Everything runs on Cloudflare.

-----

## REPOSITORY STRUCTURE

Create this structure exactly:

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
│   │   ├── enrichment.ts                     # LLM enrichment function (Anthropic)
│   │   ├── severity.ts                       # Component string → severity classifier
│   │   ├── cache.ts                          # KV page cache read-through helper
│   │   ├── utils.ts                          # slugify, date parsing, HTML escaping
│   │   └── constants.ts                      # Popular makes list, year ranges
│   └── db/
│       ├── schema.ts                         # Drizzle schema definition (all tables)
│       └── migrations/
│           └── 0000_initial.sql              # Generated by drizzle-kit
├── public/
│   └── styles.css                            # Compiled Tailwind CSS (build artifact)
├── drizzle.config.ts                         # Drizzle Kit configuration
├── wrangler.jsonc                            # Cloudflare Workers config (bindings, crons, etc.)
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

-----

## PHASE 1: Project Initialization & D1 Database Schema

### Step 1.1: Scaffold the project

```bash
npm create cloudflare@latest recall-radar -- --type=worker --lang=ts
cd recall-radar
```

### Step 1.2: Install all dependencies

```bash
# HTTP framework
npm install hono

# Database ORM
npm install drizzle-orm
npm install -D drizzle-kit

# Agents SDK
npm install agents

# LLM client
npm install @anthropic-ai/sdk

# Validation
npm install zod

# Tailwind (build-time CSS only)
npm install -D tailwindcss @tailwindcss/cli
```

### Step 1.3: Create D1 database and KV namespace

```bash
npx wrangler d1 create recall-radar-db
npx wrangler kv namespace create PAGE_CACHE
```

Save the returned `database_id` and `id` values for `wrangler.jsonc`.

### Step 1.4: Write `wrangler.jsonc`

This is the central configuration file. It declares ALL bindings — D1, KV, Workflows, Durable Objects (Agent), cron triggers, and environment variables.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "recall-radar",
  "main": "src/index.ts",
  "compatibility_date": "2025-05-01",
  "compatibility_flags": ["nodejs_compat"],

  // D1 Database
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "recall-radar-db",
      "database_id": "<paste-your-database-id>"
    }
  ],

  // KV for page cache
  "kv_namespaces": [
    {
      "binding": "PAGE_CACHE",
      "id": "<paste-your-kv-namespace-id>"
    }
  ],

  // Workflows (durable execution for pipelines)
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

  // Agent (Durable Object with built-in SQLite)
  "durable_objects": {
    "bindings": [
      {
        "name": "PIPELINE_AGENT",
        "class_name": "PipelineAgent"
      }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["PipelineAgent"] }
  ],

  // Weekly cron triggers
  "triggers": {
    "crons": ["0 2 * * 1", "0 4 * * 1"]
  },

  // Public env vars (non-secret)
  "vars": {
    "SITE_URL": "https://recallradar.com"
  }

  // SECRETS (set via `wrangler secret put`):
  // - ANTHROPIC_API_KEY
  // - ADMIN_TOKEN
}
```

### Step 1.5: Write the Env type (`src/env.ts`)

Every binding declared in `wrangler.jsonc` must appear here for TypeScript:

```typescript
export interface Env {
  DB: D1Database;
  PAGE_CACHE: KVNamespace;
  INGESTION_WORKFLOW: Workflow;
  ENRICHMENT_WORKFLOW: Workflow;
  PIPELINE_AGENT: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  ADMIN_TOKEN: string;
  SITE_URL: string;
}
```

### Step 1.6: Write the Drizzle schema (`src/db/schema.ts`)

**IMPORTANT D1/SQLite constraints to know:**

- No `SERIAL` type — use `integer().primaryKey({ autoIncrement: true })`
- No native `BOOLEAN` — use `INTEGER` (0/1)
- No native `TIMESTAMP` — store as ISO 8601 `TEXT` strings
- `ON CONFLICT` / upsert patterns use SQLite syntax

Define these tables:

#### `makes` table

- `id` INTEGER PRIMARY KEY autoincrement
- `name` TEXT NOT NULL UNIQUE — e.g., “TOYOTA”
- `slug` TEXT NOT NULL UNIQUE — e.g., “toyota”
- `nhtsa_id` INTEGER UNIQUE — NHTSA Make_ID for API lookups
- `created_at` TEXT (ISO datetime)
- `updated_at` TEXT (ISO datetime)
- Index on `slug`

#### `models` table

- `id` INTEGER PRIMARY KEY autoincrement
- `make_id` INTEGER NOT NULL → references `makes.id` CASCADE
- `name` TEXT NOT NULL — e.g., “Camry”
- `slug` TEXT NOT NULL — e.g., “camry”
- `created_at`, `updated_at` TEXT
- UNIQUE constraint on `(make_id, slug)`
- Indexes on `make_id`, `slug`

#### `vehicle_years` table

- `id` INTEGER PRIMARY KEY autoincrement
- `model_id` INTEGER NOT NULL → references `models.id` CASCADE
- `year` INTEGER NOT NULL
- `created_at`, `updated_at` TEXT
- UNIQUE constraint on `(model_id, year)`
- Indexes on `model_id`, `year`

#### `recalls` table — the core data table

- `id` INTEGER PRIMARY KEY autoincrement
- `vehicle_year_id` INTEGER NOT NULL → references `vehicle_years.id` CASCADE
- `nhtsa_campaign_number` TEXT NOT NULL UNIQUE — the canonical recall ID
- `report_received_date` TEXT (ISO datetime, nullable)
- `component` TEXT NOT NULL — e.g., “FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP”
- `manufacturer` TEXT (nullable)
- `summary_raw` TEXT NOT NULL — verbatim NHTSA bureaucratic language
- `consequence_raw` TEXT NOT NULL
- `remedy_raw` TEXT NOT NULL
- `summary_enriched` TEXT (nullable — populated by enrichment workflow)
- `consequence_enriched` TEXT (nullable)
- `remedy_enriched` TEXT (nullable)
- `enriched_at` TEXT (nullable — ISO datetime, set when enrichment completes)
- `severity_level` TEXT NOT NULL DEFAULT “UNKNOWN” — one of: CRITICAL, HIGH, MEDIUM, LOW, UNKNOWN
- `created_at`, `updated_at` TEXT
- Indexes on `vehicle_year_id`, `nhtsa_campaign_number`, `component`, `severity_level`

#### `ingestion_logs` table — audit trail

- `id` INTEGER PRIMARY KEY autoincrement
- `run_type` TEXT NOT NULL
- `target_make` TEXT (nullable)
- `status` TEXT NOT NULL
- `records_found` INTEGER DEFAULT 0
- `records_saved` INTEGER DEFAULT 0
- `error_message` TEXT (nullable)
- `started_at` TEXT NOT NULL
- `completed_at` TEXT (nullable)
- Index on `(run_type, status)`

### Step 1.7: Generate and apply the migration

```bash
npx drizzle-kit generate
npx wrangler d1 execute recall-radar-db --local --file=src/db/migrations/0000_initial.sql
npx wrangler d1 execute recall-radar-db --remote --file=src/db/migrations/0000_initial.sql
```

### Step 1.8: Verify Phase 1

```bash
npx wrangler d1 execute recall-radar-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

You should see: `makes`, `models`, `vehicle_years`, `recalls`, `ingestion_logs` (plus any Drizzle migration tracking tables).

-----

## PHASE 2: Data Ingestion via Cloudflare Workflow

### Conceptual briefing

The ingestion pipeline calls two NHTSA APIs to populate the database. **Cloudflare Workflows** replace the hand-rolled retry logic from the original spec. Each `step.do()` is:

- Automatically retried on failure (configurable: count, backoff, timeout)
- Memoized — if the workflow restarts, completed steps are skipped
- Observable in the Cloudflare dashboard

**Read these docs before coding this phase:**

- https://developers.cloudflare.com/workflows/get-started/guide/
- https://developers.cloudflare.com/workflows/build/rules-of-workflows/
- https://developers.cloudflare.com/workflows/build/workers-api/

### Step 2.1: NHTSA Client (`src/lib/nhtsa-client.ts`)

Build a wrapper around three NHTSA API endpoints. Every response MUST be validated with Zod.

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

**Endpoint 3 — Get Recalls by Vehicle (Recalls API)**

```
GET https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}
```

Returns `{ Count: number, results: [{ NHTSACampaignNumber, ReportReceivedDate, Component, Summary, Consequence, Remedy, Manufacturer }] }` — **lowercase** `results`.

**Critical details:**

- URL-encode make and model parameters (vehicle names contain spaces, hyphens, ampersands)
- Use a 30-second `AbortController` timeout per request
- Do NOT build a custom retry/backoff system — Workflows handle this
- Write Zod schemas for each response shape and `.parse()` the JSON

### Step 2.2: Utility Functions (`src/lib/utils.ts`)

**`slugify(name: string): string`** — Convert vehicle names to URL-safe slugs:

- Lowercase → replace non-alphanumeric (except hyphens) with hyphens → collapse consecutive hyphens → trim edges
- Must pass: `"F-150 Lightning" → "f-150-lightning"`, `"MERCEDES-BENZ" → "mercedes-benz"`, `"CR-V" → "cr-v"`, `"RAV4" → "rav4"`

**`classifySeverity(component: string): SeverityLevel`** — Keyword matching in priority order:

- CRITICAL: ENGINE, FUEL SYSTEM, BRAKES, STEERING, POWER TRAIN
- HIGH: AIR BAGS, SEAT BELTS, CHILD SEAT, SUSPENSION, STRUCTURE
- MEDIUM: ELECTRICAL, LIGHTING, VISIBILITY, WINDSHIELD, TIRES
- LOW: LABELS, EQUIPMENT, EXTERIOR LIGHTING
- UNKNOWN: anything else

**`parseNhtsaDate(raw: string | null): string | null`** — Handle multiple date formats:

- `"01/15/2024"` → ISO string (MM/DD/YYYY)
- `"/Date(1705276800000)/"` → ISO string (.NET JSON date)
- `null` → `null`

### Step 2.3: Constants (`src/lib/constants.ts`)

Define `POPULAR_MAKES` — a `Set<string>` of ~35 major passenger-vehicle brands. NHTSA returns 1,100+ makes including trailers and buses; we filter to these:

```
ACURA, ALFA ROMEO, AUDI, BMW, BUICK, CADILLAC, CHEVROLET, CHRYSLER,
DODGE, FIAT, FORD, GENESIS, GMC, HONDA, HYUNDAI, INFINITI, JAGUAR,
JEEP, KIA, LAND ROVER, LEXUS, LINCOLN, MAZDA, MERCEDES-BENZ, MINI,
MITSUBISHI, NISSAN, PORSCHE, RAM, RIVIAN, SUBARU, TESLA, TOYOTA,
VOLKSWAGEN, VOLVO
```

Also define `DEFAULT_YEAR_START = 2015` and `DEFAULT_YEAR_END = new Date().getFullYear()`.

### Step 2.4: Ingestion Workflow (`src/workflows/ingestion-workflow.ts`)

**Read first:** https://developers.cloudflare.com/workflows/build/workers-api/

This Workflow accepts parameters:

```typescript
interface IngestionParams {
  mode: "full" | "makes-only" | "single-make";
  targetMake?: string;        // For single-make mode
  yearStart?: number;
  yearEnd?: number;
  allMakes?: boolean;         // Include non-popular makes
  limitMakes?: number;        // Cap number of makes
  dryRun?: boolean;           // Skip actual recall fetching
}
```

**Workflow steps (each is a `step.do()`):**

1. **`fetch-all-makes`** — Call vPIC API, return makes array. Retry config: 3 retries, exponential backoff from 2s, 60s timeout.
1. **`filter-and-upsert-makes`** — Filter to popular/target, upsert into D1 `makes` table using `INSERT ... ON CONFLICT (slug) DO UPDATE`. Return filtered make list.
1. **`fetch-models-{makeSlug}`** (one step PER make) — Call vPIC models API for this make. If make #12 fails, makes 1–11 are already persisted.
1. **`upsert-models-{makeSlug}`** (one step PER make) — Upsert into D1 `models` table.
1. **`recalls-{makeSlug}-batch-{n}`** — For each make, batch models into groups of 5. For each model in the batch, iterate years from `yearStart` to `yearEnd`:
- Call the Recalls API
- If recalls exist, upsert `vehicle_years` row
- Upsert each recall with auto-classified severity
- Add 300ms courtesy delay between years
- If a single model-year fails, log error and continue (do NOT fail the batch)
1. **`log-ingestion-run`** — Write to `ingestion_logs` table with final counts.

**All database writes MUST be upserts** — `INSERT ... ON CONFLICT ... DO UPDATE`. The workflow must be safe to re-run.

**Step limit awareness**: Workers Paid allows 10,000 steps per Workflow. For 35 makes × ~40 models × 10 years, you need batching. Use `MODELS_PER_BATCH = 5` to keep step count manageable. If you need more, use smaller year ranges per run.

### Step 2.5: Admin API to trigger ingestion

In `src/routes/api.ts`, create:

```
POST /api/admin/ingest   — triggers IngestionWorkflow with params from request body
GET  /api/admin/ingest/:id — returns workflow status
```

Authenticate with `Authorization: Bearer {ADMIN_TOKEN}`.

### Step 2.6: Cron trigger

In the Worker’s `scheduled` handler, trigger ingestion on `0 2 * * 1` (Monday 2 AM UTC).

-----

## PHASE 3: LLM Enrichment via Cloudflare Workflow

### Step 3.1: Enrichment Function (`src/lib/enrichment.ts`)

Takes raw NHTSA text, returns human-readable JSON via Claude Haiku.

**System prompt** (use exactly):

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

**Config**: Model `claude-3-5-haiku-20241022`, `max_tokens: 500`, `temperature: 0.3`.

**Retry**: If JSON parsing fails, retry once with “respond in valid JSON only” appended. If still fails, return `null` (skip this recall).

### Step 3.2: Enrichment Workflow (`src/workflows/enrichment-workflow.ts`)

Parameters:

```typescript
interface EnrichmentParams {
  batchSize?: number;        // Default: 50
  targetMake?: string;
  concurrency?: number;      // Default: 3
  dryRun?: boolean;
}
```

**Steps:**

1. **`fetch-unenriched-batch-{offset}`** — Query recalls where `enriched_at IS NULL`, ordered by `created_at ASC`, `LIMIT batchSize`.
1. **`enrich-batch-{n}-chunk-{m}`** — Process `concurrency` recalls in parallel with `Promise.allSettled`. For each:
- Call `enrichRecall()` with the Anthropic API key
- On success: UPDATE recall row with enriched text + set `enriched_at`
- On failure: log warning, skip
1. Repeat batches until no more unenriched recalls remain.
1. **`log-enrichment-run`** — Write counts to `ingestion_logs`.

### Step 3.3: Cron trigger

Trigger enrichment on `0 4 * * 1` (Monday 4 AM UTC, 2 hours after ingestion).

-----

## PHASE 4: Frontend — Hono SSR + KV Page Cache

### Design approach

Instead of a React framework, you render HTML strings server-side in Hono route handlers and cache the output in Workers KV. This gives you ISR-equivalent behavior:

- **Cache HIT**: ~0ms, served from the nearest Cloudflare edge node
- **Cache MISS**: Render from D1 query, store in KV with TTL, return
- **TTL expiry**: Next request triggers a fresh render

### Step 4.1: KV Cache Helper (`src/lib/cache.ts`)

Build a `cachedPage()` function:

```typescript
async function cachedPage(
  env: Env,
  cacheKey: string,
  options: { ttl: number },
  render: () => Promise<string>
): Promise<Response>
```

- Check `env.PAGE_CACHE.get(cacheKey)`
- If found, return with `X-Cache: HIT` header
- If miss, call `render()`, `env.PAGE_CACHE.put(cacheKey, html, { expirationTtl })`, return with `X-Cache: MISS`
- Set `Cache-Control: public, max-age={ttl}, stale-while-revalidate=3600`

### Step 4.2: HTML Templates

Build template functions that return HTML strings. Use Tailwind CSS classes. No React, no JSX — plain template literals.

**Layout** (`src/templates/layout.ts`):

- HTML shell with `<head>` (charset, viewport, title, description, canonical, OG tags, JSON-LD injection slots, stylesheet link)
- Sticky header with site name + search input
- Main content area
- Footer with NHTSA disclaimer

**Component: Severity Badge** — Color-coded `<span>` with Tailwind classes:

- CRITICAL: `bg-red-600 text-white` → “Critical Safety Issue”
- HIGH: `bg-orange-500 text-white` → “High Priority”
- MEDIUM: `bg-yellow-500 text-black` → “Moderate Concern”
- LOW: `bg-slate-400 text-white` → “Minor Issue”
- UNKNOWN: `bg-gray-300 text-gray-700` → “Under Review”

**Component: Recall Card** — Displays one recall with severity badge, campaign number, component, date, and enriched text (falling back to raw text with “Original NHTSA language” note).

**Component: Dealer Lead Gen** — Monetization placeholder: zip code input + “Find Nearby Dealers” CTA button. Visual distinction (blue background card). Non-functional for now.

### Step 4.3: Page Routes (`src/routes/pages.ts`)

Create a Hono router with these routes:

**`GET /`** — Homepage

- Hero: “Is Your Car Safe?”
- Stats from D1: total recalls, vehicles, makes
- Grid of all makes as clickable cards linking to `/{makeSlug}`
- KV cache TTL: 86400 (24 hours)

**`GET /:makeSlug`** — Make landing page

- Breadcrumb: Home > {Make}
- H1: “{Make} Vehicle Recalls & Safety Issues”
- Grid of models with year ranges and recall counts
- D1 query joins `makes`, `models`, `vehicle_years`, `recalls` for counts
- KV cache TTL: 86400

**`GET /:makeSlug/:modelSlug`** — Model landing page

- Breadcrumb: Home > {Make} > {Model}
- H1: “{Make} {Model} Recalls by Year”
- Grid of year cards with recall counts and highest severity badge
- KV cache TTL: 86400

**`GET /:makeSlug/:modelSlug/:year`** — **THE MONEY PAGE**

- Breadcrumb: Home > {Make} > {Model} > {Year}
- H1: “{Year} {Make} {Model} Recalls”
- Summary stats: total count, highest severity, date range
- Dealer lead gen monetization block
- All recall cards sorted by severity (CRITICAL first) then date
- JSON-LD: FAQPage + BreadcrumbList schemas (see Phase 5)
- KV cache TTL: 43200 (12 hours)

**404 handling**: Return a styled “not found” page for unknown slugs.

### Step 4.4: Static CSS

Build Tailwind CSS at build time:

```bash
npx @tailwindcss/cli -i ./src/styles/input.css -o ./public/styles.css --minify
```

Serve `public/styles.css` from the Worker with `Cache-Control: public, max-age=31536000, immutable`.

-----

## PHASE 5: Technical SEO

This is critical for the business model. Every page must be optimized for Google.

### Step 5.1: Dynamic Metadata

For the money page (`/:makeSlug/:modelSlug/:year`):

**Title**: `{Year} {Make} {Model} Recalls: {TopComponent} Issues Explained | RecallRadar`
Where `{TopComponent}` is the first colon/comma segment of the most severe recall’s component string.

**Description**: `Check {count} known recalls for the {Year} {Make} {Model}. Get plain-English explanations of {topComponent} issues and find out how to get free repairs at your local dealer.`

**Canonical**: `https://recallradar.com/{makeSlug}/{modelSlug}/{year}`

**Open Graph**: og:title, og:description, og:type=“article”, og:url

### Step 5.2: JSON-LD Structured Data

Inject two JSON-LD schemas into every money page:

**FAQPage schema** (targets Google FAQ rich snippets):

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the {Component} recall for the {Year} {Make} {Model}? (Campaign #{Number})",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{enrichedSummary} {enrichedConsequence} {enrichedRemedy}"
      }
    }
  ]
}
```

**BreadcrumbList schema**:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://recallradar.com" },
    { "@type": "ListItem", "position": 2, "name": "{Make}", "item": "https://recallradar.com/{makeSlug}" },
    { "@type": "ListItem", "position": 3, "name": "{Model}", "item": "..." },
    { "@type": "ListItem", "position": 4, "name": "{Year}", "item": "..." }
  ]
}
```

### Step 5.3: Sitemap (`GET /sitemap.xml`)

Query D1 for ALL makes, models, and vehicle years. Generate XML sitemap:

- Homepage: priority 1.0, changefreq daily
- Makes: priority 0.8, changefreq weekly
- Models: priority 0.7, changefreq weekly
- Vehicle years (money pages): priority 0.9, changefreq weekly

Cache the sitemap in KV for 24 hours.

If URL count exceeds 50,000, implement sitemap index with split files.

### Step 5.4: Robots.txt (`GET /robots.txt`)

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://recallradar.com/sitemap.xml
```

-----

## PHASE 6: Pipeline Agent (Admin + Monitoring)

**Read first:**

- https://developers.cloudflare.com/agents/api-reference/agents-api/
- https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/
- https://developers.cloudflare.com/agents/api-reference/schedule-tasks/
- https://developers.cloudflare.com/agents/concepts/workflows/

### Step 6.1: Pipeline Agent (`src/agents/pipeline-agent.ts`)

Extend the `Agent` class from `agents` package. This Agent:

1. **Has persistent state** via `this.setState()`:
   
   ```typescript
   interface PipelineState {
     lastIngestionRun: string | null;
     lastEnrichmentRun: string | null;
     activeWorkflows: Array<{ id: string; type: string; startedAt: string; status: string }>;
   }
   ```
1. **Uses its built-in SQLite** (`this.sql`) for run history:
   
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
   )
   ```
1. **Schedules recurring tasks** in `onStart()`:
   
   ```typescript
   this.schedule("0 2 * * 1", "weekly-ingestion");
   this.schedule("0 4 * * 1", "weekly-enrichment");
   ```
1. **Exposes callable methods** (RPC from admin UI or API):
- `startIngestion(params)` — creates an IngestionWorkflow instance, logs to pipeline_runs
- `startEnrichment(params)` — creates an EnrichmentWorkflow instance
- `getRunHistory()` — queries pipeline_runs from the Agent’s SQLite
- `getStats()` — queries D1 for aggregate counts (makes, models, recalls, enriched %)
1. **Handles `onScheduledTask`** to trigger workflows on cron.

### Step 6.2: Wire agent into the Worker

Export the Agent class from `src/index.ts` and ensure the Durable Object binding + migration is in `wrangler.jsonc`.

-----

## PHASE 7: Deployment & Verification

### Step 7.1: Set secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

### Step 7.2: Deploy

```bash
npx wrangler deploy
```

### Step 7.3: Run initial ingestion

```bash
# Test with one make first
curl -X POST https://recall-radar.YOUR_SUBDOMAIN.workers.dev/api/admin/ingest \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"single-make","make":"Toyota","yearStart":2023,"yearEnd":2024}'

# Check workflow status
curl https://recall-radar.YOUR_SUBDOMAIN.workers.dev/api/admin/ingest/WORKFLOW_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify data
npx wrangler d1 execute recall-radar-db --remote \
  --command "SELECT COUNT(*) as cnt FROM recalls"
```

### Step 7.4: Run enrichment

```bash
curl -X POST https://recall-radar.YOUR_SUBDOMAIN.workers.dev/api/admin/enrich \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize":10,"concurrency":3}'
```

### Step 7.5: Verify pages

Navigate in browser:

- `/` — homepage with make grid and stats
- `/toyota` — Toyota models with recall counts
- `/toyota/camry` — Camry year cards
- `/toyota/camry/2023` — recall cards with enriched text and severity badges
- `/sitemap.xml` — all URLs listed
- `/robots.txt` — sitemap referenced

### Verification Checklist

**Database:**

- [ ] `makes` has ~35 popular makes with unique slugs
- [ ] `models` linked to correct makes
- [ ] `vehicle_years` only has entries where recalls exist
- [ ] `recalls` has unique campaign numbers (no duplicates)
- [ ] Severity levels are auto-populated for known components
- [ ] Re-running ingestion creates NO duplicates (upserts work)

**Workflows:**

- [ ] Ingestion workflow completes for a single make
- [ ] Failed NHTSA API calls trigger automatic step retry
- [ ] Workflow status visible in Cloudflare dashboard
- [ ] Enrichment workflow processes unenriched recalls
- [ ] Enriched text is plain English, not government jargon

**Frontend:**

- [ ] Homepage renders with make grid and live DB stats
- [ ] Make, model, and year pages all render correctly
- [ ] Enriched text shown when available, raw text fallback works
- [ ] KV cache returns HIT on second request (`X-Cache` header)
- [ ] No console errors

**SEO:**

- [ ] Title tags match pattern on all page types
- [ ] Meta descriptions unique per page with recall counts
- [ ] JSON-LD FAQPage schema present on money pages
- [ ] JSON-LD BreadcrumbList schema present on all pages
- [ ] `/sitemap.xml` lists all Make/Model/Year URLs
- [ ] `/robots.txt` references sitemap
- [ ] Canonical URLs set on all pages
- [ ] Open Graph tags present

**Performance:**

- [ ] Cached pages return in <5ms (check `X-Cache: HIT`)
- [ ] D1 queries use indexes (test with `EXPLAIN QUERY PLAN`)
- [ ] No N+1 query patterns in page routes

-----

## ERROR RECOVERY

|Problem            |Solution                                                                                                        |
|-------------------|----------------------------------------------------------------------------------------------------------------|
|D1 migration fails |Check SQL syntax — D1 is SQLite, not Postgres. No `SERIAL`, no `BOOLEAN`. Run `--local` first.                  |
|Workflow stuck     |Check Cloudflare dashboard → Workers → Workflows. Terminate and restart. Completed steps won’t re-execute.      |
|KV cache stale     |`npx wrangler kv key delete --binding PAGE_CACHE "page:/toyota/camry/2023"`                                     |
|LLM returns garbage|Set `enriched_at = NULL` in D1 for that recall, re-run enrichment. It only processes `enriched_at IS NULL` rows.|
|NHTSA API down     |Workflow steps auto-retry 3× with backoff. If all retries fail, step fails and workflow pauses. Resume later.   |
|Sitemap too large  |Split into sitemap index: `/sitemap-makes.xml`, `/sitemap-years-{n}.xml`, root `/sitemap.xml` index.            |
|Step limit exceeded|Reduce year range per workflow run, or increase `MODELS_PER_BATCH`. Workers Paid supports up to 25,000 steps.   |

-----

## ARCHITECTURE DECISION RECORDS

**Why D1 over PostgreSQL?** Zero provisioning, automatic read replicas at the edge, $0 at rest. SQLite is more than sufficient for this read-heavy workload. D1 eliminates cross-region database latency entirely.

**Why Drizzle over Prisma?** Prisma requires a binary engine that doesn’t run on Workers. Drizzle is pure TypeScript, has a native D1 adapter, and generates clean SQL.

**Why Hono SSR + KV instead of Next.js?** Next.js on Workers requires complex setup (OpenNext adapter or similar). Hono is native to Workers with zero overhead. KV gives ISR-equivalent caching with sub-millisecond edge reads.

**Why Workflows instead of CLI scripts?** Durable execution is free. Each step auto-retries, persists results, and survives infrastructure failures. No need to hand-roll retry logic, backoff, or crash recovery.

**Why an Agent?** The Agent provides a stateful admin layer with built-in SQLite (for run history), scheduling (for recurring ingestion), and WebSocket support (for a future live dashboard). It’s the orchestration brain.

**Why separate raw + enriched columns?** Never lose the original government text. If LLM enrichment produces bad output, fall back to raw. The raw text also serves as a trust signal for users who want official language.

**Why severity auto-classification at ingest time?** Component names are structured enough for keyword matching. Saves LLM budget for text enrichment where it actually adds value.

**Why upserts everywhere?** NHTSA has no “changed since” API. We re-fetch everything and deduplicate in the database. Upserts make the entire pipeline idempotent and crash-safe.

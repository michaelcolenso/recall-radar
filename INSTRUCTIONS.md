# NHTSA Recall Engine — Agentic Build Instructions

> **Purpose**: This document is a complete, self-contained instruction set for an agentic coding assistant (Claude Code, Cursor Agent, Copilot Workspace, etc.) to build a production-grade Programmatic SEO web application from scratch. Follow every phase in sequence. Do not skip steps. Do not improvise architecture — follow these specs exactly.

-----

## Project Overview

You are building **RecallRadar** — a high-traffic programmatic SEO application that:

1. Ingests raw vehicle recall and safety data from the NHTSA (National Highway Traffic Safety Administration) government APIs
1. Enriches the raw bureaucratic text using an LLM to make it human-readable
1. Stores everything in a relational PostgreSQL database
1. Serves it via a lightning-fast, statically-generated Next.js frontend optimized for Google indexing

The business model: capture long-tail search traffic for queries like “2020 Toyota Camry recalls”, “Ford F-150 brake recall”, etc. — thousands of unique pages generated programmatically from structured data.

-----

## Tech Stack (Do Not Deviate)

|Layer          |Technology                                      |Notes                                    |
|---------------|------------------------------------------------|-----------------------------------------|
|Framework      |Next.js 14+ (App Router)                        |Use ISR (Incremental Static Regeneration)|
|Database       |PostgreSQL                                      |Hosted on Supabase or Vercel Postgres    |
|ORM            |Prisma                                          |Schema-first, type-safe                  |
|LLM Enrichment |Anthropic Claude 3.5 Haiku OR OpenAI GPT-4o-mini|Cost-effective for high volume           |
|Styling        |Tailwind CSS + shadcn/ui                        |Clean, trust-inspiring design            |
|Validation     |Zod                                             |Validate all external API responses      |
|Language       |TypeScript (strict mode)                        |Everywhere — no plain JS files           |
|Package Manager|npm                                             |Standard lockfile                        |

-----

## Repository Structure (Create This Exactly)

```
recall-radar/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx                          # Root layout
│   │   ├── page.tsx                            # Homepage
│   │   ├── sitemap.ts                          # Dynamic sitemap generator
│   │   ├── robots.ts                           # Robots.txt
│   │   ├── [makeSlug]/
│   │   │   ├── page.tsx                        # Make landing page
│   │   │   ├── [modelSlug]/
│   │   │   │   ├── page.tsx                    # Model landing page
│   │   │   │   └── [year]/
│   │   │   │       └── page.tsx                # Vehicle year recall page (money page)
│   ├── components/
│   │   ├── ui/                                 # shadcn/ui components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── recall-card.tsx
│   │   ├── severity-badge.tsx
│   │   ├── local-dealer-lead-gen.tsx            # Monetization placeholder
│   │   ├── vehicle-breadcrumbs.tsx
│   │   ├── search-bar.tsx
│   │   └── json-ld.tsx                         # Structured data component
│   ├── lib/
│   │   ├── db.ts                               # Prisma client singleton
│   │   ├── nhtsa-client.ts                     # NHTSA API wrapper
│   │   ├── rate-limiter.ts                     # Throttle + retry + backoff
│   │   ├── enrichment.ts                       # LLM enrichment pipeline
│   │   ├── severity.ts                         # Component → severity classifier
│   │   ├── utils.ts                            # slugify, date parsing, helpers
│   │   └── constants.ts                        # Popular makes, year ranges, config
│   └── scripts/
│       ├── ingest.ts                           # Phase 2: Data ingestion CLI
│       ├── enrich.ts                           # Phase 3: LLM enrichment CLI
│       └── seed-test-data.ts                   # Dev seeding script
├── public/
│   └── og-default.png                          # Default Open Graph image
├── .env.example
├── .env.local                                  # Git-ignored
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

-----

## PHASE 1: Project Initialization & Database Schema

### Step 1.1: Initialize the Project

```bash
npx create-next-app@latest recall-radar \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbo
cd recall-radar
```

### Step 1.2: Install Dependencies

```bash
# Core
npm install prisma @prisma/client zod

# LLM (install BOTH — we support either provider)
npm install @anthropic-ai/sdk openai

# UI
npx shadcn@latest init
npx shadcn@latest add badge card separator button input

# Dev
npm install -D tsx @types/node
```

### Step 1.3: Initialize Prisma

```bash
npx prisma init --datasource-provider postgresql
```

### Step 1.4: Create the Database Schema

Write the following to `prisma/schema.prisma`. This is the exact schema — do not add or remove fields:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── MAKE ───────────────────────────────────────────────────────
// Top-level manufacturer. One row per brand.
// ────────────────────────────────────────────────────────────────
model Make {
  id        Int      @id @default(autoincrement())
  name      String   @unique                        // "Ford"
  slug      String   @unique                        // "ford"
  nhtsaId   Int?     @unique @map("nhtsa_id")       // NHTSA MakeId for API joins
  models    Model[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([slug])
  @@map("makes")
}

// ─── MODEL ──────────────────────────────────────────────────────
// Vehicle model tied to a make. Compound unique on (makeId, slug).
// ────────────────────────────────────────────────────────────────
model Model {
  id           Int           @id @default(autoincrement())
  makeId       Int           @map("make_id")
  make         Make          @relation(fields: [makeId], references: [id], onDelete: Cascade)
  name         String                                // "F-150"
  slug         String                                // "f-150"
  vehicleYears VehicleYear[]
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  @@unique([makeId, slug])
  @@index([makeId])
  @@index([slug])
  @@map("models")
}

// ─── VEHICLE YEAR ───────────────────────────────────────────────
// A specific model-year combination. This is the "page entity" in pSEO.
// ────────────────────────────────────────────────────────────────
model VehicleYear {
  id        Int      @id @default(autoincrement())
  modelId   Int      @map("model_id")
  model     Model    @relation(fields: [modelId], references: [id], onDelete: Cascade)
  year      Int
  recalls   Recall[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([modelId, year])
  @@index([modelId])
  @@index([year])
  @@map("vehicle_years")
}

// ─── RECALL ─────────────────────────────────────────────────────
// Individual recall campaign. Raw + LLM-enriched text columns.
// ────────────────────────────────────────────────────────────────
model Recall {
  id                   Int            @id @default(autoincrement())
  vehicleYearId        Int            @map("vehicle_year_id")
  vehicleYear          VehicleYear    @relation(fields: [vehicleYearId], references: [id], onDelete: Cascade)
  nhtsaCampaignNumber  String         @unique @map("nhtsa_campaign_number")
  reportReceivedDate   DateTime?      @map("report_received_date")
  component            String
  manufacturer         String?

  // Raw NHTSA text (verbatim bureaucratic language)
  summaryRaw           String         @map("summary_raw") @db.Text
  consequenceRaw       String         @map("consequence_raw") @db.Text
  remedyRaw            String         @map("remedy_raw") @db.Text

  // LLM-enriched text (human-readable — populated by Phase 3)
  summaryEnriched      String?        @map("summary_enriched") @db.Text
  consequenceEnriched  String?        @map("consequence_enriched") @db.Text
  remedyEnriched       String?        @map("remedy_enriched") @db.Text
  enrichedAt           DateTime?      @map("enriched_at")

  // Auto-classified severity for UI badges
  severityLevel        SeverityLevel  @default(UNKNOWN) @map("severity_level")

  createdAt            DateTime       @default(now()) @map("created_at")
  updatedAt            DateTime       @updatedAt @map("updated_at")

  @@index([vehicleYearId])
  @@index([nhtsaCampaignNumber])
  @@index([component])
  @@index([severityLevel])
  @@map("recalls")
}

enum SeverityLevel {
  CRITICAL    // Engine, Brakes, Steering, Fuel System
  HIGH        // Air Bags, Seat Belts, Suspension
  MEDIUM      // Electrical, Lighting, Visibility, Tires
  LOW         // Labels, Accessories, Cosmetic
  UNKNOWN
}

// ─── INGESTION LOG ──────────────────────────────────────────────
// Audit trail for pipeline runs. Enables debugging + idempotency.
// ────────────────────────────────────────────────────────────────
model IngestionLog {
  id           Int       @id @default(autoincrement())
  runType      String    @map("run_type")
  targetMake   String?   @map("target_make")
  targetModel  String?   @map("target_model")
  status       String
  recordsFound Int       @default(0) @map("records_found")
  recordsSaved Int       @default(0) @map("records_saved")
  errorMessage String?   @map("error_message") @db.Text
  startedAt    DateTime  @default(now()) @map("started_at")
  completedAt  DateTime? @map("completed_at")

  @@index([runType, status])
  @@map("ingestion_logs")
}
```

### Step 1.5: Generate Client & Push Schema

```bash
npx prisma generate
npx prisma db push
```

### Step 1.6: Create Prisma Client Singleton

Write `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Step 1.7: Verify

Run `npx prisma studio` — confirm all tables are visible and empty. Close it and continue.

-----

## PHASE 2: Data Ingestion Engine

### Step 2.1: Rate Limiter (`src/lib/rate-limiter.ts`)

Build a resilient HTTP fetcher with these exact specifications:

- **Minimum delay between requests**: 500ms (NHTSA doesn’t publish rate limits; be conservative)
- **Timeout per request**: 30 seconds, using `AbortController`
- **Retry strategy**: 3 retries with exponential backoff (base 2000ms, so: 2s → 4s → 8s)
- **Trigger retries on**: HTTP 429 (rate limited), HTTP 5xx (server error), timeout/abort, network errors
- **Hard fail on**: HTTP 4xx (except 429) — these are bad requests, retrying won’t help
- **Logging**: Print retry attempts with attempt number and delay to stdout
- **Stats tracking**: Expose a `getRequestStats()` function that returns total request count

The function signature must be:

```typescript
export async function throttledFetch<T>(
  url: string,
  schema?: z.ZodType<T>,  // Optional Zod schema for response validation
  label?: string,          // Human-readable label for logs
): Promise<T>
```

If a Zod schema is provided, validate the JSON response against it and throw on validation failure. This catches bad NHTSA data early.

### Step 2.2: NHTSA API Client (`src/lib/nhtsa-client.ts`)

Wrap the two NHTSA API endpoints. Every response shape MUST be validated with Zod.

**Endpoint 1 — Get All Makes (vPIC API)**

```
GET https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json
```

Response shape (create Zod schema for this):

```json
{
  "Count": 1100,
  "Results": [
    { "Make_ID": 440, "Make_Name": "FORD" },
    { "Make_ID": 441, "Make_Name": "TOYOTA" }
  ]
}
```

**Endpoint 2 — Get Models for a Make (vPIC API)**

```
GET https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/{makeId}?format=json
```

Response shape:

```json
{
  "Count": 50,
  "Results": [
    { "Make_ID": 440, "Make_Name": "FORD", "Model_ID": 1801, "Model_Name": "F-150" }
  ]
}
```

**Endpoint 3 — Get Recalls by Vehicle (Recalls API)**

```
GET https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}
```

Response shape:

```json
{
  "Count": 3,
  "results": [
    {
      "NHTSACampaignNumber": "20V682000",
      "ReportReceivedDate": "04/11/2020",
      "Component": "FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP",
      "Summary": "Toyota is recalling certain...",
      "Consequence": "If the fuel pump fails...",
      "Remedy": "Toyota will notify owners...",
      "Manufacturer": "Toyota Motor Engineering & Manufacturing"
    }
  ]
}
```

**IMPORTANT**: The vPIC API uses `Results` (capital R) while the Recalls API uses `results` (lowercase r). Your Zod schemas must match this exactly.

**IMPORTANT**: URL-encode the make and model parameters — vehicle names contain spaces, hyphens, slashes, and ampersands.

**Popular Makes Filter**: NHTSA returns 1,100+ makes including trailers, buses, and industrial equipment. Define a `POPULAR_MAKES` set of ~35 major passenger-vehicle brands to focus the initial ingestion:

```
ACURA, ALFA ROMEO, AUDI, BMW, BUICK, CADILLAC, CHEVROLET, CHRYSLER,
DODGE, FIAT, FORD, GENESIS, GMC, HONDA, HYUNDAI, INFINITI, JAGUAR,
JEEP, KIA, LAND ROVER, LEXUS, LINCOLN, MAZDA, MERCEDES-BENZ, MINI,
MITSUBISHI, NISSAN, PORSCHE, RAM, RIVIAN, SUBARU, TESLA, TOYOTA,
VOLKSWAGEN, VOLVO
```

### Step 2.3: Utility Functions (`src/lib/utils.ts`)

**`slugify(name: string): string`**

Convert vehicle names to URL-safe slugs. Requirements:

- Lowercase everything
- Replace non-alphanumeric characters (except hyphens) with hyphens
- Collapse multiple consecutive hyphens into one
- Trim leading/trailing hyphens
- Preserve internal hyphens (critical for names like “F-150”, “CR-V”, “MERCEDES-BENZ”)

Test cases the function must pass:

```
"F-150 Lightning"  → "f-150-lightning"
"MERCEDES-BENZ"    → "mercedes-benz"
"CR-V"             → "cr-v"
"  Grand Cherokee " → "grand-cherokee"
"RAV4"             → "rav4"
"3 Series"         → "3-series"
```

**`classifySeverity(component: string): SeverityLevel`**

Map NHTSA component strings to severity levels. NHTSA components are uppercase, often pipe-delimited or colon-delimited (e.g., “AIR BAGS:FRONTAL:DRIVER SIDE”, “ENGINE AND ENGINE COOLING”). Use substring matching, checking in priority order CRITICAL → HIGH → MEDIUM → LOW:

|Severity|Component Keywords                                                         |
|--------|---------------------------------------------------------------------------|
|CRITICAL|ENGINE, FUEL SYSTEM, BRAKES, BRAKE, STEERING, POWER TRAIN, POWERTRAIN      |
|HIGH    |AIR BAG, AIR BAGS, SEAT BELT, SEAT BELTS, CHILD SEAT, SUSPENSION, STRUCTURE|
|MEDIUM  |ELECTRICAL, LIGHTING, VISIBILITY, WINDSHIELD, WIPERS, TIRES                |
|LOW     |LABELS, EQUIPMENT, EXTERIOR LIGHTING                                       |
|UNKNOWN |Anything else                                                              |

**`parseNhtsaDate(raw: string | null | undefined): Date | null`**

Parse NHTSA date strings which come in multiple formats:

- `"01/15/2024"` → standard MM/DD/YYYY
- `"/Date(1705276800000)/"` → .NET JSON date format (milliseconds since epoch)
- `null` / `undefined` → return `null`
- Anything else → attempt `new Date(raw)`, return `null` if invalid

### Step 2.4: Ingestion Script (`src/scripts/ingest.ts`)

Build a CLI script that orchestrates the full ingestion pipeline. This script must:

**Accept CLI flags:**

|Flag            |Description                                        |Default     |
|----------------|---------------------------------------------------|------------|
|`--makes-only`  |Sync makes from NHTSA and stop                     |false       |
|`--recalls`     |Skip make sync, go straight to models + recalls    |false       |
|`--make "Ford"` |Process only a single make (case-insensitive match)|all popular |
|`--year-start N`|First year to fetch recalls for                    |2015        |
|`--year-end N`  |Last year to fetch recalls for                     |current year|
|`--all-makes`   |Include all 1,100+ NHTSA makes, not just popular   |false       |
|`--limit N`     |Max number of makes to process (alphabetical)      |unlimited   |
|`--dry-run`     |Sync makes + models but skip recall fetching       |false       |

**Pipeline steps:**

1. **Sync Makes** (skip if `--recalls`): Fetch all makes from vPIC, filter to popular (or all if `--all-makes`), upsert into `makes` table. Log the run to `ingestion_logs`.
1. **Sync Models**: For each make in the database (filtered by `--make` or `--limit`), fetch models from vPIC and upsert into `models` table.
1. **Fetch Recalls**: For each model, iterate from `yearStart` to `yearEnd`. For each year:
- Call the Recalls API
- If recalls exist, upsert a `VehicleYear` row
- Upsert each recall into the `recalls` table
- Auto-classify severity using `classifySeverity()`
- Add a 300ms courtesy delay between years (on top of the rate limiter’s 500ms floor)

**Error handling requirements:**

- If a single year/model combination fails, log the error and continue to the next one. Do NOT abort the entire pipeline.
- Wrap the entire pipeline in try/catch. On fatal error, log to `ingestion_logs` with status “failed” and the error message.
- Always call `prisma.$disconnect()` in a `finally` block.

**All database writes MUST be upserts** — the script must be safe to re-run multiple times without creating duplicate rows.

**Print a summary at the end:**

```
═══════════════════════════════════
  PIPELINE COMPLETE
═══════════════════════════════════
  Makes processed:   35
  Models upserted:   1,247
  Recalls upserted:  8,432
  API requests:      12,884
  Total time:        847.2s
═══════════════════════════════════
```

### Step 2.5: Add npm scripts to `package.json`

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "ingest": "npx tsx src/scripts/ingest.ts",
    "ingest:makes": "npx tsx src/scripts/ingest.ts --makes-only",
    "ingest:single": "npx tsx src/scripts/ingest.ts --make",
    "enrich": "npx tsx src/scripts/enrich.ts"
  }
}
```

### Step 2.6: Verify Phase 2

Run:

```bash
npm run ingest -- --make "Toyota" --year-start 2023 --year-end 2024
npx prisma studio
```

Confirm that makes, models, vehicle_years, and recalls tables are populated. Confirm recall rows have `summaryRaw`, `consequenceRaw`, `remedyRaw` filled but `summaryEnriched`, etc. are NULL.

-----

## PHASE 3: LLM Enrichment Pipeline

### Step 3.1: Enrichment Function (`src/lib/enrichment.ts`)

Build a function that takes raw NHTSA recall text and returns human-readable versions via LLM.

**System prompt** (use this EXACTLY — it has been prompt-engineered for optimal output):

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

**User prompt template:**

```
Recall Component: {component}

Original Summary: {summaryRaw}

Original Consequence: {consequenceRaw}

Original Remedy: {remedyRaw}
```

**LLM provider logic:**

- Check for `ANTHROPIC_API_KEY` env var first → use Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
- Else check for `OPENAI_API_KEY` → use GPT-4o-mini (`gpt-4o-mini`)
- If neither is set, throw a clear error message

**Response handling:**

- Parse the JSON response from the LLM
- Validate with Zod that all three keys (`summary`, `consequence`, `remedy`) are present and are non-empty strings
- If parsing fails, retry once with an explicit “respond in valid JSON only” follow-up
- If retry fails, log a warning and skip this recall (leave enriched fields NULL)

**Cost controls:**

- Set `max_tokens: 500` (these should be short responses)
- Use temperature 0.3 (we want consistency, not creativity)

The function signature:

```typescript
interface EnrichmentResult {
  summary: string;
  consequence: string;
  remedy: string;
}

export async function enrichRecall(recall: {
  component: string;
  summaryRaw: string;
  consequenceRaw: string;
  remedyRaw: string;
}): Promise<EnrichmentResult | null>
```

### Step 3.2: Enrichment Script (`src/scripts/enrich.ts`)

Build a CLI script that processes unenriched recalls in batches.

**CLI flags:**

|Flag             |Description                                    |Default|
|-----------------|-----------------------------------------------|-------|
|`--batch-size N` |Recalls to process per batch                   |50     |
|`--make "Ford"`  |Only enrich recalls for a specific make        |all    |
|`--concurrency N`|Parallel LLM calls (respect API rate limits)   |3      |
|`--dry-run`      |Show what would be enriched without calling LLM|false  |

**Logic:**

1. Query recalls where `enrichedAt IS NULL`, ordered by `createdAt ASC`
1. Process in batches of `--batch-size`
1. For each recall in the batch, call `enrichRecall()`
1. On success, update the recall row with enriched text + set `enrichedAt = now()`
1. On failure, log warning and move to next recall
1. Print progress every batch: `Enriched 50/8,432 recalls (0.6%)...`
1. Print final summary with success/fail counts and estimated API cost

**Rate limiting for LLM APIs:**

- Anthropic: ~50 requests/minute on free tier, ~1000/minute on paid
- OpenAI: ~500 requests/minute on Tier 1
- Use a simple concurrency pool (`Promise.allSettled` with max N concurrent)
- Add 200ms delay between individual calls as a safety buffer

### Step 3.3: Verify Phase 3

Run:

```bash
npm run enrich -- --make "Toyota" --batch-size 10
npx prisma studio
```

Confirm recall rows now have `summaryEnriched`, `consequenceEnriched`, `remedyEnriched` populated and `enrichedAt` is set. Read the enriched text — it should be plain English, not government jargon.

-----

## PHASE 4: Next.js Frontend

### Step 4.1: Root Layout (`src/app/layout.tsx`)

- Set default metadata: title “RecallRadar — Vehicle Recall Safety Database”, description targeting core SEO keywords
- Use Inter font from `next/font/google`
- Include a clean header with the site name and a search bar component
- Include a footer with disclaimer: “RecallRadar is not affiliated with NHTSA. Data sourced from the National Highway Traffic Safety Administration public API.”

### Step 4.2: Homepage (`src/app/page.tsx`)

- Hero section: “Is Your Car Safe?” headline, subtext about checking recalls
- Search bar (client component) that autocompletes make → model → year
- Grid of popular makes with their logos (or styled text cards) linking to `/[makeSlug]`
- Stats section pulling live counts from DB: “X recalls tracked across Y vehicles from Z manufacturers”
- ISR config: `revalidate = 86400` (refresh daily)

### Step 4.3: Make Page (`src/app/[makeSlug]/page.tsx`)

**Data fetching:**

```typescript
// Fetch make by slug, include all models with recall counts
const make = await prisma.make.findUnique({
  where: { slug: params.makeSlug },
  include: {
    models: {
      include: {
        vehicleYears: {
          include: { _count: { select: { recalls: true } } }
        }
      },
      orderBy: { name: "asc" }
    }
  }
});
```

**Page content:**

- Breadcrumb: Home > [Make]
- H1: “[Make] Vehicle Recalls & Safety Issues”
- Table or card grid of all models with their year ranges and total recall counts
- Link each model to `/[makeSlug]/[modelSlug]`
- ISR config: `revalidate = 86400`

**`generateStaticParams`**: Query all makes and return their slugs for static generation.

**`generateMetadata`**: Title = “[Make] Recalls — Complete Safety Database | RecallRadar”

### Step 4.4: Model Page (`src/app/[makeSlug]/[modelSlug]/page.tsx`)

**Data fetching:** Fetch model by slug + make slug. Include vehicle years with recall counts.

**Page content:**

- Breadcrumb: Home > [Make] > [Model]
- H1: “[Make] [Model] Recalls by Year”
- Grid of year cards, each showing: year, number of recalls, highest severity badge
- Link each year to `/[makeSlug]/[modelSlug]/[year]`

**`generateStaticParams`**: Query all models with their makes.

**`generateMetadata`**: Title = “[Make] [Model] Recalls — Safety Issues by Year | RecallRadar”

### Step 4.5: Vehicle Year Page — THE MONEY PAGE (`src/app/[makeSlug]/[modelSlug]/[year]/page.tsx`)

This is the most important page. It targets the exact long-tail query people search: “2020 Toyota Camry recall”.

**Data fetching:**

```typescript
const vehicleYear = await prisma.vehicleYear.findFirst({
  where: {
    year: parseInt(params.year),
    model: {
      slug: params.modelSlug,
      make: { slug: params.makeSlug }
    }
  },
  include: {
    model: { include: { make: true } },
    recalls: { orderBy: { reportReceivedDate: "desc" } }
  }
});
```

**Page content (build each as a component):**

1. **Breadcrumb**: Home > [Make] > [Model] > [Year]
1. **H1**: “[Year] [Make] [Model] Recalls”
1. **Summary stats bar**: Total recalls count, highest severity level, date range of recalls
1. **Monetization Block** (`LocalDealerLeadGen` component):
- Prominent card with: “Find a certified [Make] dealer near you to fix this for free”
- Zip code input field (placeholder — does not need to be functional yet)
- CTA button: “Find Nearby Dealers”
- Style: slightly different background color to stand out, but not garish
1. **Recall Cards** (one per recall, using `RecallCard` component):
- **Severity Badge** (`SeverityBadge` component):
  - CRITICAL → Red background, “Critical Safety Issue”
  - HIGH → Orange background, “High Priority”
  - MEDIUM → Yellow background, “Moderate Concern”
  - LOW → Blue/gray background, “Minor Issue”
  - UNKNOWN → Gray background, “Under Review”
- **Campaign number** as subheading
- **Component** name
- **Date** reported
- **Enriched text** (if available): summary, consequence, remedy as three labeled paragraphs
- **Fallback to raw text** (if enrichment hasn’t run yet): show the raw NHTSA text in a slightly muted style with a note “Original NHTSA language”
1. **JSON-LD structured data** (see Phase 5)

**ISR config**: `revalidate = 43200` (refresh every 12 hours)

**`generateStaticParams`**: Query all vehicle years with their model and make slugs.

**`generateMetadata`** (see Phase 5 for full spec)

### Step 4.6: Component Specifications

**`SeverityBadge` (`src/components/severity-badge.tsx`)**

Uses shadcn/ui `Badge` component. Map severity levels to Tailwind classes:

```typescript
const SEVERITY_CONFIG = {
  CRITICAL: { label: "Critical Safety Issue", className: "bg-red-600 text-white" },
  HIGH:     { label: "High Priority",         className: "bg-orange-500 text-white" },
  MEDIUM:   { label: "Moderate Concern",      className: "bg-yellow-500 text-black" },
  LOW:      { label: "Minor Issue",           className: "bg-slate-400 text-white" },
  UNKNOWN:  { label: "Under Review",          className: "bg-gray-300 text-gray-700" },
};
```

**`RecallCard` (`src/components/recall-card.tsx`)**

A self-contained card component. Props:

```typescript
interface RecallCardProps {
  nhtsaCampaignNumber: string;
  component: string;
  reportReceivedDate: Date | null;
  severityLevel: SeverityLevel;
  summaryEnriched: string | null;
  consequenceEnriched: string | null;
  remedyEnriched: string | null;
  summaryRaw: string;
  consequenceRaw: string;
  remedyRaw: string;
}
```

Use enriched text when available, fall back to raw. Show a subtle indicator for which is displayed.

**`LocalDealerLeadGen` (`src/components/local-dealer-lead-gen.tsx`)**

Props: `makeName: string`. This is a placeholder monetization block. Render a visually distinct card with the zip code input and CTA. The actual dealer lookup functionality is out of scope for now — this is a slot for future monetization.

**`VehicleBreadcrumbs` (`src/components/vehicle-breadcrumbs.tsx`)**

Render semantic breadcrumbs with `BreadcrumbList` JSON-LD schema markup. Props:

```typescript
interface BreadcrumbItem {
  label: string;
  href: string;
}
```

### Step 4.7: Verify Phase 4

Run `npm run dev` and navigate to:

- `/` — homepage loads with make grid
- `/toyota` — shows all Toyota models
- `/toyota/camry` — shows Camry year cards
- `/toyota/camry/2020` — shows recall cards with enriched or raw text

Confirm all pages render correctly with no hydration errors.

-----

## PHASE 5: Technical SEO

### Step 5.1: Dynamic Metadata (`generateMetadata`)

For the vehicle year page (the money page), the metadata function must generate:

**Title tag**: `{Year} {Make} {Model} Recalls: {TopComponent} Issues Explained | RecallRadar`

Where `{TopComponent}` is the component from the most severe recall. If no recalls, use: `{Year} {Make} {Model} Recall & Safety Information | RecallRadar`

**Meta description**: `Check {count} known recalls for the {Year} {Make} {Model}. Get plain-English explanations of {TopComponent} issues and find out how to get free repairs at your local dealer.`

**Open Graph tags**: og:title, og:description, og:type (“article”), og:url (canonical)

**Canonical URL**: Always set — `https://recallradar.com/{makeSlug}/{modelSlug}/{year}`

Example output for a page:

```html
<title>2020 Toyota Camry Recalls: Fuel Pump Issues Explained | RecallRadar</title>
<meta name="description" content="Check 3 known recalls for the 2020 Toyota Camry. Get plain-English explanations of fuel pump issues and find out how to get free repairs at your local dealer." />
```

### Step 5.2: JSON-LD Structured Data (`src/components/json-ld.tsx`)

Create a component that injects JSON-LD into the page `<head>` via Next.js metadata API or a `<script type="application/ld+json">` tag.

**For every vehicle year page, generate TWO schemas:**

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

### Step 5.3: Sitemap Generator (`src/app/sitemap.ts`)

Use Next.js built-in sitemap generation. This file must query the database and return ALL valid Make/Model/Year combinations.

```typescript
import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://recallradar.com";

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1.0 },
  ];

  // All makes
  const makes = await prisma.make.findMany({ select: { slug: true, updatedAt: true } });
  const makePages = makes.map((m) => ({
    url: `${baseUrl}/${m.slug}`,
    lastModified: m.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // All models
  const models = await prisma.model.findMany({
    select: { slug: true, updatedAt: true, make: { select: { slug: true } } },
  });
  const modelPages = models.map((m) => ({
    url: `${baseUrl}/${m.make.slug}/${m.slug}`,
    lastModified: m.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // All vehicle years (the money pages — highest volume)
  const vehicleYears = await prisma.vehicleYear.findMany({
    select: {
      year: true,
      updatedAt: true,
      model: { select: { slug: true, make: { select: { slug: true } } } },
    },
  });
  const yearPages = vehicleYears.map((vy) => ({
    url: `${baseUrl}/${vy.model.make.slug}/${vy.model.slug}/${vy.year}`,
    lastModified: vy.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...makePages, ...modelPages, ...yearPages];
}
```

**Important**: If the sitemap exceeds 50,000 URLs, you must split it into a sitemap index with multiple sitemap files. For now, start with a single sitemap and add the index pattern when data grows.

### Step 5.4: Robots.txt (`src/app/robots.ts`)

```typescript
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/scripts/"] },
    ],
    sitemap: "https://recallradar.com/sitemap.xml",
  };
}
```

### Step 5.5: Verify Phase 5

1. Run `npm run dev`
1. Visit `/sitemap.xml` — confirm it lists all Make/Model/Year URLs
1. Visit `/robots.txt` — confirm it references the sitemap
1. View page source on a vehicle year page — confirm JSON-LD scripts are present and valid
1. Check title tags in browser tab — confirm they match the pattern
1. Validate JSON-LD at https://validator.schema.org/ or Google Rich Results Test

-----

## PHASE 6: Environment & Deployment Configuration

### Step 6.1: `.env.example`

```env
# PostgreSQL (Supabase or Vercel Postgres)
DATABASE_URL="postgresql://user:password@host:5432/recall_radar?schema=public"

# LLM Enrichment (set ONE of these)
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# Site URL (for sitemap, canonical URLs, OG tags)
NEXT_PUBLIC_SITE_URL="https://recallradar.com"
```

### Step 6.2: `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable ISR
  experimental: {},
  // Log build stats
  logging: { fetches: { fullUrl: true } },
};

export default nextConfig;
```

### Step 6.3: Deployment Checklist

When deploying to Vercel:

1. Set all environment variables in Vercel dashboard
1. The build command is `npx prisma generate && next build`
1. Set `NEXT_PUBLIC_SITE_URL` to the production domain
1. After first deploy, run `npm run ingest -- --make "Toyota"` as a test
1. Then run full ingestion: `npm run ingest -- --year-start 2015`
1. Then run enrichment: `npm run enrich -- --batch-size 50 --concurrency 3`
1. Trigger a Vercel redeploy to regenerate static pages with data

-----

## Testing & Validation Checklist

After completing all phases, verify the following:

### Database Integrity

- [ ] `makes` table has ~35 popular makes with unique slugs
- [ ] `models` table has models linked to correct makes
- [ ] `vehicle_years` table only has entries where recalls exist
- [ ] `recalls` table has unique campaign numbers, no duplicates
- [ ] `recalls` rows with enriched text have `enrichedAt` timestamp set
- [ ] Severity levels are auto-populated (no orphan UNKNOWN values for common components)

### Ingestion Script

- [ ] `npm run ingest -- --makes-only` runs without error
- [ ] `npm run ingest -- --make "Honda" --year-start 2023` fetches recalls
- [ ] Running the same command twice does NOT create duplicate rows (upserts work)
- [ ] Timeouts and 5xx errors trigger retries (test by temporarily setting timeout to 1ms)
- [ ] `ingestion_logs` table captures each run

### Enrichment

- [ ] `npm run enrich -- --batch-size 5 --dry-run` shows what would be enriched
- [ ] `npm run enrich -- --batch-size 5` actually enriches 5 recalls
- [ ] Enriched text is plain English, not government jargon
- [ ] LLM JSON response is properly parsed (no markdown artifacts)
- [ ] Failed enrichments are logged but don’t crash the script

### Frontend

- [ ] Homepage renders with make grid and stats
- [ ] `/toyota` shows all Toyota models with recall counts
- [ ] `/toyota/camry/2020` shows recall cards with severity badges
- [ ] Enriched text is displayed when available
- [ ] Raw text fallback works when enriched text is NULL
- [ ] Breadcrumbs render correctly on all page levels
- [ ] No React hydration errors in console
- [ ] LocalDealerLeadGen component renders on vehicle year pages

### SEO

- [ ] Title tags follow the specified pattern on all pages
- [ ] Meta descriptions are unique per page and include recall counts
- [ ] JSON-LD FAQPage schema is valid (test at validator.schema.org)
- [ ] JSON-LD BreadcrumbList schema is present on all pages
- [ ] `/sitemap.xml` lists all Make/Model/Year URLs
- [ ] `/robots.txt` references the sitemap
- [ ] Canonical URLs are set on all pages
- [ ] Open Graph tags are present

### Performance

- [ ] Vehicle year pages use ISR with 12-hour revalidation
- [ ] Make and model pages use ISR with 24-hour revalidation
- [ ] No N+1 query issues (use Prisma `include` for eager loading)
- [ ] Pages render in under 200ms on first load

-----

## Error Recovery Procedures

If something goes wrong during execution, here’s how to recover:

**Prisma schema push fails**: Check `DATABASE_URL` is correct. Run `npx prisma db push --force-reset` to start fresh (WARNING: deletes all data).

**Ingestion script crashes mid-run**: Safe to re-run. All writes are upserts. Check `ingestion_logs` for the failed run’s error message.

**LLM enrichment produces garbage**: Set the specific recall’s `enrichedAt` back to NULL in Prisma Studio, then re-run enrichment. The script only processes rows where `enrichedAt IS NULL`.

**Sitemap is too large**: Implement sitemap index pattern — split into `/sitemap-makes.xml`, `/sitemap-models.xml`, `/sitemap-years-1.xml`, etc. with a root `/sitemap.xml` index file.

**NHTSA API is down**: The rate limiter retries 3 times with backoff. If still failing, wait and re-run. The script picks up where it left off due to upsert logic.

-----

## Architecture Decision Records

**Why Prisma over Drizzle?** Prisma’s schema-first approach generates TypeScript types automatically. The introspection and Studio tooling make debugging easier. Drizzle is faster at runtime but the DX tradeoff isn’t worth it for this use case.

**Why ISR over SSG?** Pure SSG would require rebuilding all ~50,000+ pages on every deploy. ISR lets us serve stale-while-revalidate — pages load instantly from cache and refresh in the background. Best of both worlds.

**Why upserts everywhere?** The NHTSA API doesn’t have a “changed since” filter. We must re-fetch everything and rely on the database to deduplicate. Upserts make the entire pipeline idempotent and crash-safe.

**Why severity auto-classification at ingest time?** Moving this to a LLM call would be wasteful — component names are structured enough for keyword matching. Save LLM budget for the text enrichment where it actually adds value.

**Why separate raw + enriched columns?** We never want to lose the original government text. If the LLM produces a bad enrichment, we can always fall back. The raw text also serves as a trust signal for users who want to see the official language.

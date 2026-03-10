# RecallRadar

RecallRadar is a programmatic SEO application that ingests NHTSA vehicle recall data, enriches recall text with an LLM, and publishes searchable make/model/year pages in Next.js.

## Tech stack

- Next.js (App Router)
- Prisma + PostgreSQL
- TypeScript
- NHTSA APIs (vPIC + recalls)
- Anthropic or OpenAI for enrichment

## Prerequisites

- Node.js 20+
- npm
- A running PostgreSQL database
- One LLM API key (`ANTHROPIC_API_KEY` **or** `OPENAI_API_KEY`) for enrichment

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL` (PostgreSQL connection string)
- `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000` for local dev)
- One enrichment key:
  - `ANTHROPIC_API_KEY`, or
  - `OPENAI_API_KEY`

## 3) Initialize Prisma schema

```bash
npm run db:push
```

(Optional) open Prisma Studio:

```bash
npm run db:studio
```

## 4) Ingest NHTSA data (first bootstrap)

Recommended first run: one make and a narrow year range.

```bash
npm run ingest -- --make TOYOTA --year-start 2020 --year-end 2021
```

Useful alternatives:

```bash
# only sync makes
npm run ingest:makes

# fetch all configured popular makes
npm run ingest

# dry run without writing recalls
npm run ingest -- --make TOYOTA --dry-run
```

## 5) Enrich recall text with LLM

Process unenriched recalls in batches:

```bash
npm run enrich -- --make TOYOTA --batch-size 25 --concurrency 3
```

Dry run:

```bash
npm run enrich -- --dry-run
```

## 6) Run the web app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Operational notes

- Ingestion is idempotent via Prisma upserts (safe to rerun).
- Enrichment only targets rows with `enrichedAt = null`.
- If no recalls appear on the homepage, verify ingestion completed successfully and inspect tables in Prisma Studio.

## Common troubleshooting

- **`DATABASE_URL` errors**: confirm `.env` exists and points to a reachable PostgreSQL instance.
- **No enrichment happening**: verify one LLM key is set and there are recalls with `enrichedAt = null`.
- **Empty pages**: run ingestion for a known make/year range first, then reload app.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                  # Local worker dev server (Wrangler)
npm run typecheck            # TypeScript type checking
npm run deploy               # Deploy to Cloudflare Workers

npm run db:generate          # Generate Drizzle migrations from schema changes
npm run db:migrate:local     # Apply migrations to local D1 (Wrangler dev)
npm run db:migrate:remote    # Apply migrations to production D1
npm run db:studio            # Open Drizzle visual DB admin

npm run cf-typegen           # Regenerate TypeScript types from wrangler.jsonc bindings
```

There are no automated tests. Type checking (`npm run typecheck`) is the primary correctness check.

## Architecture

RecallRadar is a **Cloudflare-native programmatic SEO application** that aggregates U.S. NHTSA vehicle safety recall data and serves thousands of edge-cached, SEO-optimized pages (e.g., `/toyota/camry/2020`).

### Runtime Stack

| Layer               | Technology                                                         |
| ------------------- | ------------------------------------------------------------------ |
| HTTP framework      | Hono v4 on Cloudflare Workers                                      |
| Database            | Cloudflare D1 (SQLite), accessed via Drizzle ORM                   |
| Page cache          | Cloudflare Cache API (`caches.default`, read-through)              |
| Durable pipelines   | Cloudflare Workflows (ingestion + enrichment)                      |
| Admin orchestration | Cloudflare Durable Objects (`PipelineAgent`)                       |
| LLM enrichment      | Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
| Validation          | Zod (all external API responses)                                   |

### Data Flow

```
NHTSA vPIC API ──→ IngestionWorkflow ──→ D1 (raw recall data)
                                              │
                                              ▼
                                    EnrichmentWorkflow ──→ Workers AI ──→ D1 (enriched text)
                                              │
D1 ──→ Hono routes ──→ HTML templates ──→ Cache API ──→ HTTP response
```

**Cron schedule** (in `wrangler.jsonc`): Monday 2 AM UTC = ingestion, Monday 4 AM UTC = enrichment.

### Key Files

| Path                                   | Purpose                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `src/index.ts`                         | Worker entrypoint; mounts routes and exports scheduled handler                    |
| `src/env.ts`                           | Cloudflare binding types (`Env` interface)                                        |
| `src/db/schema.ts`                     | Drizzle table definitions (makes, models, vehicle_years, recalls, ingestion_logs) |
| `src/workflows/ingestion-workflow.ts`  | NHTSA API → D1 pipeline (modes: full, delta, single-make, backfill)               |
| `src/workflows/enrichment-workflow.ts` | D1 → Workers AI → D1 LLM enrichment pipeline                                      |
| `src/agents/pipeline-agent.ts`         | Durable Object; stateful orchestration, run history, admin RPC                    |
| `src/routes/pages.ts`                  | SSR public pages with Cache API caching                                           |
| `src/routes/api.ts`                    | Admin REST endpoints (Bearer auth required)                                       |
| `src/routes/seo.ts`                    | `/sitemap.xml` (auto-splits at 50k URLs) and `/robots.txt`                        |
| `src/lib/nhtsa-client.ts`              | NHTSA/vPIC API client with Zod schemas                                            |
| `src/lib/cache.ts`                     | `getCachedOrRender()` Cache API read-through helper                               |
| `src/lib/severity.ts`                  | Component string → CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN classifier                    |
| `src/lib/constants.ts`                 | `POPULAR_MAKES` list (30 makes), year range defaults                              |
| `src/templates/`                       | Pure TypeScript HTML string generators (no React)                                 |

### Important Conventions

**Upsert idempotency**: All D1 writes use `ON CONFLICT DO UPDATE` — every workflow step is safe to re-run. Never use plain `INSERT`.

**Raw vs. enriched separation**: `recalls` table has `summaryRaw`/`consequenceRaw`/`remedyRaw` (government text, never overwritten) and `summaryEnriched`/`consequenceEnriched`/`remedyEnriched` (additive LLM output). Templates fall back to raw if enriched is null.

**Page caching**: All page routes use `getCachedOrRender(cacheKey, ttlSeconds, renderFn)` from `src/lib/cache.ts`, backed by the Cache API (`caches.default`), which is unmetered — unlike Workers KV, whose free-tier 1,000 writes/day cap caused 429s under crawler traffic. Cache keys follow the pattern `page:{type}:{slug}`. Don't bypass this — render functions are expensive. Entries are per-datacenter and evictable; a miss just re-renders from D1.

**Admin auth**: All `/api/admin/*` routes require `Authorization: Bearer {ADMIN_TOKEN}`. The token is in `wrangler.jsonc` vars (`ADMIN_TOKEN`).

**Severity classification**: Determined at ingest time from the `Component` field via keyword matching in `src/lib/severity.ts`. Not re-computed on read.

**Delta ingestion**: Skips `vehicle_year` rows with `lastIngestedAt` within the last 144 hours. Use `runType: "full"` to force re-ingestion of all vehicles.

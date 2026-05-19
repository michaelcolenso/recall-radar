# Recalled Rides

Cloudflare-native vehicle recall search. Aggregates NHTSA safety recall data, enriches it with LLM plain-English summaries, and serves thousands of SEO-optimized pages from the edge.

**Stack**: Hono → D1 (SQLite) → KV Cache → Workflows (ingestion + enrichment) → Agents SDK (admin orchestration)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your local secrets
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set ADMIN_TOKEN (generate with: openssl rand -hex 16)

# 3. Create D1 database and KV namespace (first time only)
npx wrangler d1 create recall-radar-db
# Copy the database_id into wrangler.jsonc → d1_databases[0].database_id

npx wrangler kv namespace create PAGE_CACHE
# Copy the id into wrangler.jsonc → kv_namespaces[0].id

# 4. Apply database migrations
npm run db:generate
npm run db:migrate:local

# 5. Start dev server
npm run dev
```

Open `http://localhost:8787` and the admin dashboard at `http://localhost:8787/admin`.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (Wrangler) |
| `npm run typecheck` | TypeScript compilation check |
| `npm run deploy` | Deploy Worker + Workflows + Agent |
| `npm run db:generate` | Generate Drizzle SQL migrations from schema |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to production D1 |
| `npm run db:studio` | Open Drizzle Studio (visual DB admin) |
| `npm run cf-typegen` | Regenerate Workers types from bindings |

## Architecture

```
NHTSA vPIC API ──→ IngestionWorkflow ──→ D1 (raw recall data)
                                              │
                                              ▼
                                    EnrichmentWorkflow ──→ Workers AI ──→ D1 (enriched text)
                                              │
D1 + KV ──→ Hono routes ──→ HTML templates ──→ KV cache ──→ HTTP response
```

| Layer | Technology |
|-------|------------|
| HTTP framework | Hono v4 on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| Page cache | Workers KV (read-through, stale-while-revalidate) |
| Ingestion | Cloudflare Workflows (durable, auto-retry) |
| Enrichment | Workers AI (Llama 3.3 70B) |
| Orchestration | Agents SDK (Durable Object + SQLite) |
| Styling | Custom CSS (Industrial Design System) |

## Key Files

| Path | Purpose |
|------|---------|
| `src/index.ts` | Worker entrypoint, route mounting, cron handler |
| `src/db/schema.ts` | Drizzle table definitions (5 tables) |
| `src/workflows/ingestion-workflow.ts` | NHTSA API → D1 pipeline |
| `src/workflows/enrichment-workflow.ts` | LLM enrichment pipeline |
| `src/agents/pipeline-agent.ts` | Admin DO: orchestration, run history, stats |
| `src/routes/pages.ts` | SSR public pages with KV caching |
| `src/routes/api.ts` | Admin REST endpoints |
| `src/routes/seo.ts` | Sitemap (sharded), robots.txt |
| `src/templates/` | TypeScript HTML generators (no React) |

## Deployment

```bash
# 1. Verify everything compiles
npm run typecheck

# 2. Generate and apply database migrations
npm run db:generate
npm run db:migrate:remote

# 3. Set production secrets
npx wrangler secret put ADMIN_TOKEN

# 4. Deploy
npm run deploy
```

### Post-deploy verification

```bash
# Trigger a test ingestion (single make)
curl -X POST https://recalledrides.com/api/admin/ingest \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "single-make", "targetMake": "TOYOTA", "yearStart": 2023, "yearEnd": 2024}'

# Check status
curl https://recalledrides.com/api/admin/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify pages render
curl -s https://recalledrides.com/ | head -20
curl -s https://recalledrides.com/toyota | head -20
curl -s https://recalledrides.com/toyota/camry | head -20
curl -s https://recalledrides.com/toyota/camry/2023 | head -20

# After ingestion completes, trigger enrichment
curl -X POST https://recalledrides.com/api/admin/enrich \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50}'

# Submit sitemap to Google
curl https://recalledrides.com/sitemap.xml
```

## Cron Schedule

Two weekly triggers (Monday UTC):
- **02:00** — Delta ingestion (skips rows checked within last 6 days)
- **04:00** — LLM enrichment

## Conventions

- **Upsert idempotency**: All writes use `ON CONFLICT DO UPDATE` — safe to re-run
- **Raw vs enriched**: `recalls` table keeps government text in `*_raw` columns; LLM output in `*_enriched`. Templates fall back to raw when enriched is null.
- **KV cache keys**: `page:<type>:<slug>` pattern, TTLs vary by page type
- **Admin auth**: `Authorization: Bearer <ADMIN_TOKEN>` on all `/api/admin/*` routes
- **Severity**: Auto-classified at ingest from component keywords (CRITICAL → LOW)

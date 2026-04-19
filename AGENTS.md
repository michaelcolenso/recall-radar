# RecallRadar — Agent Context

## Project Overview

RecallRadar is a Cloudflare-native web application that aggregates and presents vehicle safety recall data from the U.S. National Highway Traffic Safety Administration (NHTSA). The app transforms bureaucratic government recall notices into plain-English explanations for car owners.

**Core Value Proposition**: Help vehicle owners quickly find and understand safety recalls for their specific make/model/year, with LLM-enriched explanations that are easier to understand than raw NHTSA text.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers (Node.js compatibility) |
| Web Framework | Hono (lightweight, Express-like) |
| Database | Cloudflare D1 (SQLite) with Drizzle ORM |
| Caching | Cloudflare Workers KV |
| AI/LLM | Anthropic Claude + Cloudflare Workers AI |
| Orchestration | Cloudflare Workflows + Agents (Durable Objects) |
| Styling | Tailwind CSS (via CDN) |
| Language | TypeScript (ES modules) |

## Project Structure

```
recall-radar/
├── src/
│   ├── index.ts              # Worker entrypoint, route mounting, cron handler
│   ├── env.ts                # Environment bindings type definitions
│   ├── routes/
│   │   ├── pages.ts          # SSR page routes (/, /:make, /:make/:model, /:make/:model/:year)
│   │   ├── api.ts            # Admin API routes (/api/admin/*)
│   │   └── seo.ts            # SEO routes (/robots.txt, /sitemap.xml)
│   ├── db/
│   │   ├── schema.ts         # Drizzle ORM table definitions
│   │   ├── client.ts         # Database client factory
│   │   └── migrations/       # SQL migration files
│   ├── workflows/
│   │   ├── ingestion-workflow.ts   # Fetches NHTSA data, populates D1
│   │   └── enrichment-workflow.ts  # LLM-enriches recall descriptions
│   ├── agents/
│   │   └── pipeline-agent.ts       # Durable Object for orchestration
│   ├── lib/
│   │   ├── nhtsa-client.ts   # NHTSA/vPIC API client
│   │   ├── enrichment.ts     # LLM enrichment logic (Claude + Workers AI)
│   │   ├── severity.ts       # Component-based severity classification
│   │   ├── cache.ts          # KV read-through helper
│   │   ├── utils.ts          # Slugify, date parsing, HTML escaping
│   │   └── constants.ts      # Popular makes list, year ranges
│   └── templates/
│       ├── layout.ts         # HTML shell with nav/footer
│       ├── home.ts           # Homepage template
│       ├── make-page.ts      # Make landing page template
│       ├── model-page.ts     # Model landing page template
│       ├── year-page.ts      # Recall detail page template ("money page")
│       └── components/       # Reusable UI components
│           ├── recall-card.ts
│           ├── severity-badge.ts
│           ├── breadcrumbs.ts
│           ├── dealer-lead-gen.ts
│           └── json-ld.ts
├── public/                   # Static assets (styles.css)
├── wrangler.jsonc            # Cloudflare Workers configuration
├── drizzle.config.ts         # Drizzle ORM configuration
├── tailwind.config.ts        # Tailwind CSS configuration
└── package.json
```

## Build and Development Commands

```bash
# Development server (local Workers runtime)
npm run dev

# Type checking
npm run typecheck

# Deploy to production
npm run deploy

# Database migrations	npm run db:generate        # Generate SQL from schema changes
npm run db:migrate:local   # Apply migrations to local D1
npm run db:migrate:remote  # Apply migrations to production D1
npm run db:studio          # Open Drizzle Studio (visual DB admin)

# Cloudflare type generation
npm run cf-typegen         # Generate TypeScript types from wrangler.jsonc
```

## Environment Variables

Create `.dev.vars` for local development (see `.dev.vars.example`):

```
ANTHROPIC_API_KEY=sk-ant-...      # Required for LLM enrichment (Claude)
ADMIN_TOKEN=your-secret-token     # Required for admin API access
```

Configure these in `wrangler.jsonc` for production:

```json
"vars": {
  "SITE_URL": "https://recallradar.com",
  "ENVIRONMENT": "production"
}
```

**Cloudflare Bindings** (configured in `wrangler.jsonc`):
- `DB` — D1 database for recall data
- `PAGE_CACHE` — KV namespace for rendered HTML caching
- `AI` — Workers AI for LLM fallback
- `INGESTION_WORKFLOW` — Workflow for data ingestion
- `ENRICHMENT_WORKFLOW` — Workflow for LLM enrichment
- `PIPELINE_AGENT` — Durable Object for orchestration

## Data Model

The database uses 5 core tables with cascading deletes:

1. **makes** — Vehicle manufacturers (Toyota, Ford, etc.)
2. **models** — Vehicle models (Camry, F-150, etc.)
3. **vehicle_years** — Specific model years
4. **recalls** — Individual recall records with raw + enriched text
5. **ingestion_logs** — Audit trail for pipeline runs

**Key Design Decisions**:
- `recalls` stores both `*_raw` (NHTSA source) and `*_enriched` (LLM output)
- `severity_level` is auto-classified at ingestion based on component keywords
- All text fields preserve original data; enrichment is additive

## Architecture Patterns

### Request Flow

```
User Request → Hono Router → KV Cache Check → DB Query → Template Render → KV Store → Response
                                    ↓
                              Cache Hit → Direct Response
```

### Data Pipeline

```
Cron Trigger (Mon 2AM) → IngestionWorkflow → NHTSA API → D1
Cron Trigger (Mon 4AM) → EnrichmentWorkflow → Anthropic/Workers AI → D1
Admin API → PipelineAgent (Durable Object) → Workflow Trigger
```

### Component Severity Classification

Auto-assigned at ingestion based on component keywords:
- **CRITICAL**: ENGINE, FUEL SYSTEM, BRAKE, STEERING, POWER TRAIN
- **HIGH**: AIR BAG, SEAT BELT, SUSPENSION, TIRE, WHEEL
- **MEDIUM**: ELECTRICAL, LIGHTING, VISIBILITY, WINDSHIELD WIPER
- **LOW**: LABEL, SEAT, EXTERIOR LIGHTING
- **UNKNOWN**: Everything else

## API Endpoints

### Public Pages
- `GET /` — Homepage with make list
- `GET /:makeSlug` — Make landing page
- `GET /:makeSlug/:modelSlug` — Model landing page
- `GET /:makeSlug/:modelSlug/:year` — Recall detail page (main value page)

### SEO
- `GET /robots.txt` — Crawler rules
- `GET /sitemap.xml` — XML sitemap (with sharding for large URL sets)
- `GET /sitemap-makes.xml` — Makes sitemap
- `GET /sitemap-models.xml` — Models sitemap
- `GET /sitemap-years-:page.xml` — Paginated year/recall sitemaps

### Admin API (requires Bearer token)
- `POST /api/admin/ingest` — Trigger ingestion workflow
- `GET /api/admin/ingest/:id` — Check ingestion status
- `POST /api/admin/enrich` — Trigger enrichment workflow
- `GET /api/admin/enrich/:id` — Check enrichment status
- `GET /api/admin/status` — Pipeline agent status
- `GET /api/admin/stats` — Database statistics

## Code Style Guidelines

### TypeScript
- Strict mode enabled (`strict: true`)
- ES modules (`"type": "module"`)
- Explicit return types on exported functions
- Zod schemas for external API validation

### Naming Conventions
- Files: kebab-case (`ingestion-workflow.ts`)
- Functions: camelCase (`fetchAllMakes`)
- Components: PascalCase for templates (`recallCard` generates HTML string)
- Database: snake_case columns, camelCase in TypeScript

### SQL Style
- Table names: plural, lowercase (`makes`, `vehicle_years`)
- Index names: `idx_<table>_<columns>`
- Foreign keys with `ON DELETE CASCADE`
- ISO 8601 timestamps stored as TEXT

### Template/HTML Generation
- Template functions return HTML strings (not JSX)
- Always escape dynamic content with `escapeHtml()`
- Tailwind classes use semantic color naming (slate, blue, green, red)

## Testing Strategy

Currently, the project relies on:
- TypeScript compilation (`tsc --noEmit`)
- Manual smoke testing via admin API endpoints
- Workflow replay through Cloudflare dashboard

**Recommended additions** (not yet implemented):
- Unit tests for severity classification, slug generation, HTML escaping
- Integration tests for DB queries with test D1 database
- Workflow step retry testing

## Security Considerations

- Admin API endpoints require `Authorization: Bearer <ADMIN_TOKEN>` header
- No CORS configuration (same-origin by default)
- SQL injection prevention via parameterized D1 queries
- XSS prevention via HTML escaping in templates
- API keys stored as secrets, not in code

## Deployment Process

1. **Pre-deploy**:
   ```bash
   npm run typecheck
   npm run db:generate   # If schema changed
   ```

2. **Apply database migrations** (if needed):
   ```bash
   npm run db:migrate:remote
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Post-deploy verification**:
   - Trigger test ingestion: `POST /api/admin/ingest` with body `{"mode": "single-make", "targetMake": "HONDA"}`
   - Check status: `GET /api/admin/status`
   - Verify pages render: `/`, `/toyota`, `/toyota/camry`, `/toyota/camry/2020`

## Cron Schedule

Two weekly cron triggers (Monday UTC):
- **02:00** — Ingestion workflow (fetch new recall data)
- **04:00** — Enrichment workflow (LLM process unenriched recalls)

## Common Tasks

### Add a New Vehicle Make

Edit `src/lib/constants.ts` and add to `POPULAR_MAKES` array, then trigger ingestion:
```bash
curl -X POST https://recallradar.com/api/admin/ingest \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "single-make", "targetMake": "NEWMAKE"}'
```

### Manually Trigger Enrichment

```bash
curl -X POST https://recallradar.com/api/admin/enrich \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3}'
```

### Clear Page Cache

KV cache is keyed by `page:<path>`. Use Cloudflare dashboard or Wrangler CLI to delete specific keys or entire namespace.

## External Dependencies

- **NHTSA APIs**: 
  - vPIC API for make/model data (`vpic.nhtsa.dot.gov`)
  - Recalls API for recall data (`api.nhtsa.gov`)
- **Anthropic API**: Primary LLM for enrichment (`claude-3-5-haiku`)
- **Cloudflare Workers AI**: Fallback LLM (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| KV cache stale | Delete key in Cloudflare dashboard or wait for TTL (12-24 hours) |
| Workflow stuck | Check Workflow instance in Cloudflare dashboard; retry failed steps |
| LLM enrichment failing | Verify `ANTHROPIC_API_KEY`; falls back to Workers AI if available |
| Database timeouts | Check indexes; use `EXPLAIN QUERY PLAN` for slow queries |
| Build errors | Run `npm run cf-typegen` to refresh Workers types |

## File Change Checklist

When modifying these files, also update:
- `src/db/schema.ts` → Run `npm run db:generate`
- `wrangler.jsonc` → Run `npm run cf-typegen`
- Template changes → Clear affected KV cache keys
- New routes → Add to sitemap generation in `src/routes/seo.ts`

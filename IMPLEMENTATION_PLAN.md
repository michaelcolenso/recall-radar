# RecallRadar Implementation Plan (Based on `INSTRUCTIONS.md`)

This plan translates `INSTRUCTIONS.md` into an actionable execution roadmap, including quality improvements that increase delivery reliability, operational safety, and SEO impact.

## 0) Discovery and baseline alignment

1. **Inventory current repo vs target architecture**
   - Compare current stack (Next.js + Prisma/Postgres) against target stack (Cloudflare Workers + Hono SSR + D1 + Workflows + Agents + KV).
   - Build a migration matrix by subsystem:
     - Runtime and deployment
     - Database and schema tooling
     - Ingestion pipeline
     - Enrichment pipeline
     - Frontend rendering and caching
     - SEO outputs
     - Admin/orchestration

2. **Define acceptance criteria and delivery slices**
   - Convert the verification checklist in `INSTRUCTIONS.md` into explicit testable criteria.
   - Group work into mergeable vertical slices to reduce risk:
     - Slice A: Cloudflare skeleton + D1 schema + basic reads
     - Slice B: ingestion workflow end-to-end
     - Slice C: enrichment workflow end-to-end
     - Slice D: SSR routes + KV cache
     - Slice E: SEO surfaces + admin agent

3. **Decide migration strategy**
   - Preferred: keep old implementation isolated while introducing new Cloudflare path in parallel, then switch default runtime once validated.
   - Benefits: easier rollback, lower integration risk.

## 1) Cloudflare foundation and project structure

1. **Initialize Cloudflare Worker app and bindings**
   - Add/validate Wrangler config (`wrangler.jsonc`) for:
     - D1 database binding
     - KV namespace binding for page cache
     - Workflows bindings
     - Durable Object binding for Agent
     - Cron triggers (if needed for scheduled ingestion)

2. **Establish source layout for maintainability**
   - `src/index.ts` (entrypoint/routes)
   - `src/db/schema.ts` + migrations SQL
   - `src/workflows/ingest.ts`
   - `src/workflows/enrich.ts`
   - `src/seo/*` (metadata + JSON-LD builders)
   - `src/cache/*` (KV read-through helpers)
   - `src/agent/*` (admin orchestration)

3. **Introduce environment contract checks**
   - Add startup validation for required bindings/secrets (admin token, model key).
   - Fail fast with clear diagnostics in non-production.

4. **Worker/Agent boundary design (important for correctness)**
   - Keep request-time SEO page rendering in the stateless Worker entrypoint (`fetch`) for maximum edge scale and low latency.
   - Use the Agent (Durable Object-backed) only for stateful orchestration concerns: run history, scheduling, coordination, and operator interactions.
   - Keep workflows as the durable execution primitive for ingestion/enrichment steps; Agent triggers workflows and records status, not vice versa.


## 2) D1 schema and data modeling

1. **Implement target schema with SQL migrations**
   - Tables: `makes`, `models`, `vehicle_years`, `recalls`.
   - Ensure unique constraints/upsert keys align with idempotent ingestion.
   - Add important indexes for route access patterns:
     - make slug
     - model slug + make
     - make/model/year compound lookups
     - recalls by year/model and enrichment status

2. **Severity classification design**
   - Add deterministic severity mapping function at ingest time from component keywords.
   - Keep raw and enriched text columns separate for fallback behavior.

3. **Validation and query plans**
   - Run representative queries with `EXPLAIN QUERY PLAN`.
   - Confirm no table scans on hot paths.

## 3) Ingestion workflow (durable + idempotent)

1. **Workflow contract**
   - Input modes:
     - single make + year window
     - configured popular makes
   - Step granularity designed to keep retries small and deterministic.

2. **Implement ingestion steps**
   - Fetch makes/models from vPIC (or config where appropriate).
   - Fetch recalls per model/year from NHTSA API.
   - Normalize records and upsert into D1.
   - Populate `vehicle_years` only when recall existence is confirmed.

3. **Resilience controls**
   - Retries with backoff at external API boundaries.
   - Use non-retryable errors for validation/config issues.
   - Persist run metadata (counts/errors/last cursor) for observability.

4. **Idempotency guarantees**
   - Every write path uses deterministic upsert keys.
   - Re-running same input must produce zero duplicates.

## 4) Enrichment workflow (LLM)

1. **Selection and batching**
   - Query only recalls where `enriched_at IS NULL`.
   - Batch size/concurrency controlled by input payload.

2. **Prompting and safety**
   - Constrain style for plain-English summaries.
   - Add token length and content sanity checks before persistence.
   - Preserve raw text and skip update on malformed outputs.

3. **Cost and reliability controls**
   - Optional model fallback strategy if primary provider fails.
   - Retry transient LLM failures; cap total attempts.

4. **Post-enrichment validation**
   - Mark `enriched_at` only on successful writes.
   - Track quality metrics (e.g., average summary length, failure rate).

5. **Workers AI model availability contract (must be deployment-safe)**
   - Use Workers AI model IDs that are listed in the Workers AI catalog at implementation time, and keep them configurable via env vars (for example, primary + fallback text-generation models).
   - Define a startup/model-resolution check that logs configured model IDs and fails enrichment jobs early if model bindings are missing or invalid.
   - Recommended default strategy: one higher-quality primary model + one lower-latency fallback, both from currently available Workers AI text-generation models.
   - Candidate model IDs from current catalog for planning: `@cf/openai/gpt-oss-120b` (quality-focused), `@cf/openai/gpt-oss-20b` (faster/cheaper), `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/meta/llama-3.1-8b-instruct-fast`, `@cf/zai-org/glm-4.7-flash` (verify final IDs at implementation time).


## 5) Frontend SSR with Hono + KV read-through caching

1. **Route implementation**
   - `/` home stats + make grid.
   - `/:make` models list.
   - `/:make/:model` year cards.
   - `/:make/:model/:year` recall cards with enriched fallback logic.

2. **Caching strategy**
   - KV key format: `page:<normalized-path>`.
   - Cache HTML response with TTL and `X-Cache` HIT/MISS headers.
   - Invalidate keys on data refresh for impacted paths.

3. **Rendering and UX safeguards**
   - Handle empty states and non-existent slugs with SEO-safe 404 pages.
   - Keep templates deterministic to avoid accidental duplicate content.

## 6) Technical SEO implementation

1. **Metadata and canonicalization**
   - Apply deterministic title/meta patterns by page type.
   - Canonical URLs derived from normalized slugs.

2. **Structured data**
   - Add `BreadcrumbList` JSON-LD to all pages.
   - Add `FAQPage` JSON-LD to high-value money pages.

3. **Crawler controls**
   - Build `/sitemap.xml` from D1 URL inventory.
   - Build `/robots.txt` referencing sitemap.
   - Add split sitemap index support if URL count grows.

4. **Social metadata**
   - Add Open Graph tags with stable fallback images/text.

## 7) Pipeline Agent and admin API

1. **Admin endpoints**
   - Trigger ingestion workflow.
   - Trigger enrichment workflow.
   - Query workflow status.
   - Guard all routes with bearer token auth.

2. **Agent responsibilities**
   - Store run history and health snapshots.
   - Schedule recurring runs via alarms/cron bridging.
   - Expose monitoring data for future dashboard/WebSocket streaming.

3. **Operational guardrails**
   - Rate-limit admin triggers.
   - Prevent concurrent duplicate runs for same scope.

## 8) Testing and verification strategy

1. **Automated tests**
   - Unit tests: slug normalization, severity mapping, metadata builders.
   - Integration tests: D1 query functions and route handlers with test DB.
   - Workflow tests: step retries and idempotent re-entry behavior.

2. **Smoke checks aligned to deployment checklist**
   - Run ingestion single-make scenario.
   - Run enrichment small batch.
   - Validate route rendering and cache HIT on second request.
   - Validate sitemap/robots outputs and structured data presence.

3. **Performance checks**
   - Measure uncached vs cached latency.
   - Confirm indexed query paths via explain plans.

## 9) Deployment and release process

1. **Pre-deploy**
   - Set secrets (`ANTHROPIC_API_KEY`, `ADMIN_TOKEN`).
   - Apply migrations in staging and run smoke tests.

2. **Deploy**
   - Deploy Worker via Wrangler.
   - Run initial controlled ingestion (single make).
   - Run enrichment batch and validate output quality.

3. **Post-deploy monitoring**
   - Track workflow success/failure rates.
   - Track cache hit ratio and response time.
   - Watch for SEO route errors and malformed structured data.

## 10) Recommended augmentations beyond baseline instructions

1. **Data quality scoring for enrichment**
   - Add a lightweight heuristic score (length/readability/keyword checks) to detect low-quality LLM outputs and queue for retry/review.
   - Reason: improves page trust and reduces poor AI text publication risk.

2. **Dead-letter queue pattern for persistent failures**
   - Record permanently failing recall enrichments and API fetches into a dedicated D1 table for operator triage.
   - Reason: prevents silent drops and improves recovery transparency.

3. **Observability baseline**
   - Structured logs with correlation IDs per workflow run and step.
   - Reason: dramatically reduces incident debugging time.

4. **Incremental recrawl strategy**
   - Add periodic “recent years first” runs and less frequent deep backfills.
   - Reason: keeps fresh content updated while controlling API/LLM cost.

5. **Content deduplication guard**
   - Hash final rendered recall summaries and detect near-duplicate clusters per model/year.
   - Reason: strengthens programmatic SEO uniqueness and indexing quality.

6. **Safety-oriented admin design**
   - Add dry-run modes for admin triggers in production.
   - Reason: lets operators validate scope and expected row counts before expensive runs.

7. **Rollout plan for minimal risk**
   - Feature-flag enrichment display and KV caching independently.
   - Reason: enables progressive launch and easier rollback without disabling entire app.

## 11) Execution sequence (recommended)

1. Foundation + bindings + D1 schema.
2. Ingestion workflow + admin trigger + idempotency verification.
3. SSR routes with raw-text fallback and basic metadata.
4. KV cache integration + headers + invalidation hooks.
5. Enrichment workflow + quality controls.
6. Structured data + sitemap + robots.
7. Agent monitoring/scheduling and deployment hardening.

This sequence maximizes early validation (real data + visible pages) before adding higher-complexity automation.

## 12) Documentation-derived implementation notes (Workers AI + Agents)

1. **Workers AI constraints to respect**
   - Workers AI is serverless model inference integrated with Workers and supports a catalog of hosted models; avoid hard-coding provider-specific assumptions that bypass `env.AI`/Workers bindings.
   - Keep model selection abstracted behind a small adapter so model swaps do not require workflow rewrites.

2. **Agent nature and responsibilities**
   - Agents are Durable Object-backed stateful classes with built-in storage, scheduling, and realtime connectivity; this is ideal for admin orchestration, not high-QPS public HTML serving.
   - Use callable methods for privileged operations and keep auth/authorization checks at every admin entrypoint.

3. **Model governance checklist (before each deploy)**
   - Verify configured model IDs still exist in Workers AI catalog.
   - Verify primary/fallback models both support required task type (text generation for enrichment).
   - Run a one-record enrichment smoke test in staging and assert output quality + latency budget.


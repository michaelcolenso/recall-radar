# Recalled Rides audit implementation

Implemented on `fix/recalledrides-audit`. The checkout is `recall-radar-work`; the pre-existing `recall-radar` symlink and its checkout were left intact.

## Validation

- `npm run typecheck`
- `npm test` (Node 22.13+), 101 passing tests: exercises scoring, normalization, temporal wording, SQL component aggregation, real migrations and audited Hono page routes against SQLite.
- `npm run build`: rebuilds critical CSS and bundles the Worker with Wrangler's deployment dry run.
- `npm run test:browser`: Playwright checks mobile vehicle selection, VIN navigation and prefill, keyword results, symptom results, unclassified severity and print export. Run `npx playwright install chromium` first, or set `CHROME_PATH` to an installed Chromium executable.
- Browser screenshots and the 30-campaign, one-page Letter PDF are generated in `artifacts/audit/` (ignored by Git).

The latest local fixture Lighthouse mobile run scored 100 for performance, with 0.8 s Speed Index, 0.8 s LCP and CLS 0. This tests a local fixture, not production traffic or the live data set. The production Speed Index target remains a post-deployment check.

## Production rollout

The code is not deployed and production D1 has not been changed. Back up D1 before running canonical merges. The new migrations are additive:

- `0008_charming_raza.sql`: original NHTSA source model metadata on recall rows.
- `0009_vengeful_risque.sql`: passenger, motorcycle and commercial model types.
- `0010_hesitant_betty_ross.sql`: successful empty lookups cached separately from actual vehicle-year records.
- `0011_hot_tigra.sql`: canonical vehicle-year aliases preserve existing recall-alert subscription IDs and unsubscribe tokens after historical records merge.

With the project's Cloudflare credentials configured:

```sh
npx wrangler d1 export recall-radar-db --remote --output /secure/path/recall-radar-before-audit.sql
npm run db:migrate:remote
npm run deploy
```

Use the deployed site's existing admin authentication. Keep the token in the environment and avoid command tracing. No new AI-provider credential is needed; enrichment continues to use Workers AI.

```sh
export WORKER_URL=https://recalledrides.com
# Set ADMIN_TOKEN through your usual secret management; do not paste it into a tracked file.
curl --fail-with-body -X POST "$WORKER_URL/api/admin/repair-models" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}'
```

This returns HTTP 202 and one repair workflow ID per make. Each workflow consolidates existing aliases, preserves original model metadata, classifies vehicle types, then recomputes all per-year scores in durable batches. Raw government text is retained. Retry is safe for canonical merges; keep the backup for rollback.

Check each returned ID with `GET /api/admin/ingest/ID`. Wait for `complete` before starting ingestion. A repair can be limited to one make with `{"makeSlug":"mercedes-benz"}`.

```sh
# Re-fetch raw aliases and missing model years for all 30 supported makes.
# This launches full single-make workflows, not backfill; cached empty historical
# year rows must not prevent the corrected RAM/Mercedes queries from running.
node scripts/bulk-ingest.mjs 2000

# Patch historical relative timing in existing enriched remedies. The operation
# is idempotent and does not rewrite the original government filing.
node scripts/repair-summaries.mjs
```

`scripts/bulk-ingest.mjs` reads `ADMIN_TOKEN` from the environment and prints workflow IDs. Its worker URL defaults to the historical worker host; set `WORKER_URL` to the deployed canonical host. Ingestion computes grades as it saves each model-year. Make/model/component aggregates are SQL-backed rather than separate stored totals, so they reflect the normalized joins immediately. New render-cache and asset versions invalidate old pages on deployment; after data repair, use a fresh cache version or allow existing page TTLs to expire before the live audit.

## Live checks still required

1. RAM 1500: verify the NHTSA results populate 2000–2010 historical aliases and 2020–2026 current years. Years are only shown as recall links when a filing actually exists; the implementation does not fabricate coverage from campaign descriptions.
2. Mercedes-Benz: check C/E/S, GLC/GLE and Sprinter against freshly ingested filings, including the original trim metadata on campaign pages.
3. Check RAM and Mercedes component counts against distinct campaign IDs.
4. Re-run mobile Lighthouse on the deployed pages and measure Speed Index under the production workload.
5. Confirm enabled affiliate programs have approved tracking URLs. Partner CTAs use the existing registry and click tracker and appear only for enabled partners.

The dealer helper has official OEM recall entry points for the verified Toyota/Lexus, Ford/Lincoln, Mopar, GM, Mercedes-Benz and Volkswagen families. Other makes still receive a contextual internal helper with the filing's customer-service phone and recall code, when present, plus local authorized-dealer search. Helper pages and parameterized symptom searches are intentionally noindex; the symptom landing page is in the sitemap.

## Checklist recheck

The follow-up review fixed disagreement between count-based model/stat grades and weighted year grades, case-sensitive Mercedes family aliases, historical Dodge/Freightliner Sprinter sources, unbounded summary repair requests, campaign freshness across multiple vehicle years, and OEM recall-number extraction. Existing models without source filings remain unlinked rather than receiving invented recall records.

Summary repair now accepts `{"afterId":0}` and returns `{patched,nextAfterId}`. Each request scans at most 101 matching rows and updates at most 100; continue with the returned cursor until it is null. `scripts/repair-summaries.mjs` does this automatically using the existing `WORKER_URL` and `ADMIN_TOKEN` environment variables.

Critical CSS is 8,097 bytes, with an enforced 8 KiB test. Full CSS retains all theme tokens and decorative styles; only variables referenced by critical rules and their dependencies are inlined. Model, year, stats and stored grades share the same grade boundaries, including a high-volume floor even when there is exactly one critical recall. Primary search and buyer actions share the site's CTA styling with dark text on the orange background.

Canonical Sprinter aliases are supported by NHTSA filings [17V-025](https://static.nhtsa.gov/odi/rcl/2017/RCAK-17V025-6385.pdf) and [20V-180](https://static.nhtsa.gov/odi/rcl/2020/RCAK-20V180-3368.pdf). The original filing's brand and trim remain in source metadata; this grouping does not establish VIN eligibility.

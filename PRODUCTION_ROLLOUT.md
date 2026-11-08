# Recalled Rides production rollout — 8 November 2026

Branch: `fix/recalledrides-audit`, pushed to `michaelcolenso/recall-radar`.

The Worker and public assets were deployed using the authenticated Cloudflare API MCP. The final HTML cache version is `v37`. Existing production bindings, secrets, routes, durable objects and workflow associations were preserved. No production test fixtures were inserted.

## Database and content

A private 40,982,062-byte D1 SQL export was saved before any migration at `/home/openclaw/private-backups/recall-radar-2026-11-08/production-before-audit.sql`. Settings and deployment snapshots in that directory are private and must not be committed.

Applied migrations 0008–0011: source-model metadata, vehicle types, separately cached empty lookups and canonical vehicle-year aliases. All 30 initial canonical repair/rescoring workflows completed. Historical alerts retain subscription identity and unsubscribe tokens. Aggregates use normalized SQL joins and distinct campaign IDs.

All 36 refresh workflow instances, covering all 30 supported makes and years 2000–2027, completed successfully. The ingestion-log audit found no caught errors. Actual records, rather than invented ranges, determine published coverage. Final BMW and Honda repairs completed successfully. BMW merged 206 trim/year groups and rescored 7,368 vehicle-year rows; Honda rescored 325. A final type pass required no further corrections; 564 existing models are classified as motorcycle or commercial.

Historical wording repair patched 7,568 summaries across the initial run and final sweep. Original NHTSA language is retained. The final scan found no pre-2026 enriched remedies containing “will be mailed” or “in the coming months.”

## Verified production behavior

- 2019 RAM 1500: 30 distinct campaigns, Grade F.
- 2023 Chevrolet Malibu: Grade B, no unclassified hero severity pill or Grade F title.
- RAM 1500 has positive recall records for every year 2000–2026, including historical Dodge filings and 2020–2026 records.
- Mercedes distinct campaigns: C-Class 43, E-Class 56, S-Class 40, GLC-Class 21, GLE-Class 39 and Sprinter 128. Source trim metadata remains available.
- RAM and Mercedes each render 12 unique component cards, with no duplicate labels.
- Mobile homepage selector loads RAM / 1500 / 2026; navigation to the 2019 year page works.
- Campaign 24V653000 includes RAM 1500 in its title and exposes original NHTSA language.
- Production Make, Model, Year, Stats and Campaign JSON-LD parsed successfully.
- The real 30-campaign RAM checklist exports to one Letter page.

VIN lookup distinguishes VIN-specific responses from a clearly labeled model-year fallback. When the NHTSA VIN endpoint is unavailable, decoded vehicle records are not presented as proof that repairs remain open. Drivers receive the official free NHTSA VIN-check link. The public example VIN returned 11 model-year filings through this fallback.

Partner links appear only for enabled partner programs and use the existing click tracker. This rollout does not manufacture affiliate approvals or tracking IDs.

## Validation and performance

`npm run typecheck`, `npm test` (113 passing), `npm run build` and the Playwright audit passed. Unit/integration coverage includes scoring polarity and safety floors, normalization and canonical merges, source metadata, subscription identity, component SQL, migrations, temporal wording, schema, search and VIN failure behavior.

Production mobile Lighthouse results:

| Page | Speed Index | LCP | CLS | Performance |
|---|---:|---:|---:|---:|
| Homepage | 1,758 ms | 0.9 s | 0 | 88 |
| RAM 1500 / 2019 | 1,737 ms | 1.0 s | 0 | 92 |

Both measured Speed Index values meet the requested <1.8 s target. These are measured runs, not guarantees for every network/device. Cloudflare-injected challenge and bridge scripts contribute additional main-thread work. Security settings were preserved.

Critical CSS is 8,097 bytes with an enforced 8 KiB budget. The homepage's own selector/search script remains below 4 KiB gzipped. Generated browser images, Lighthouse reports and print PDFs are under ignored `artifacts/production/`.

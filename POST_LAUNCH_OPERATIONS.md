# Post-launch operations — 12 November 2026

## 2. Scheduled pipeline and integrity

The production daily 02:00 UTC ingestion runs on November 9, 10, 11 and 12 completed without caught ingestion errors. November 9 saved 60 recall records. The latest run finished at 02:02:37 UTC on November 12. No duplicate campaign/year pairs, broken recall joins or unsafe stored grades were found.

The chained enrichment jobs did fail separately, with Cloudflare reporting an indefinite wait outside a step. The fix replaces non-durable pacing with `step.sleep`, clears AI-call deadline timers, records thrown enrichment attempts and bounds each invocation to 250 batches (at most 2,000 recall attempts). Failed and low-quality attempts remain visible; remaining work can be picked up by later scheduled runs. Original NHTSA language is retained.

A production canary processed six Ford recalls over three batches with durable pauses and zero failures. This validates the deployed fix; it does not claim the entire summary backlog is complete. Workflow ID: `rr-postlaunch-enrichment-canary-20261112`.

The installed user timer `recall-radar-health.timer` checks every 30 minutes. It examines daily delta completion, caught summary-quality failures, latest ingestion/enrichment workflow status, stalled jobs and data integrity. Current status is healthy. The private snapshot is `/home/openclaw/private-backups/recall-radar-2026-11-08/ops/pipeline-health.json`; failures are also recorded in the systemd journal. This monitoring is installed on the current workspace host and requires its existing Cloudflare MCP login to remain valid. User lingering is enabled so timers survive SSH logout.

Reusable command (credentials remain outside Git):

```sh
node --import tsx scripts/operations-check.mjs --expect-delta-after latest --output artifacts/operations/pipeline-health.json
```

Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` and either `CF_MCP_HELPER` (an authenticated private module exporting `connect`) or `CLOUDFLARE_API_TOKEN`. Service/timer examples are in `scripts/`; replace the example executable and filesystem paths with the installed Node path and checkout location.

## 3. Search Console and sitemap

Authenticated access to `sc-domain:recalledrides.com` is working. The canonical sitemap was resubmitted on November 12 at 07:26 UTC. Its latest reported download was 04:39 UTC, with zero warnings/errors and 32,207 submitted URLs; the resubmission is pending processing.

The live sitemap audit found no duplicate URLs, wrong origins, oversized shards or invalid/future modification dates. The sampled zero-recall CLE/2000 and SLR McLaren/2027 pages are noindex and absent from the sitemap. Historical Dodge RAM/2008 returns a 301 to the RAM canonical URL and is absent from the sitemap. The C-Class, RAM/2019 and Malibu/2023 canonical pages return 200 and appear in the sitemap.

Google's indexed snapshot still shows:

| URL | Search Console status | Last Google crawl |
|---|---|---|
| `/` | Indexed | October 2 |
| `/ram` | Indexed | November 5 |
| `/ram/1500` | Indexed | September 16 |
| `/ram/1500/2019` | Crawled, currently not indexed | September 21 |
| `/stats/ram/1500` | Unknown to Google | Not recorded |
| `/chevrolet/malibu/2023` | Indexed | November 4 |
| `/mercedes-benz/c-class` | Historical server error | June 29 |
| `/mercedes-benz/cle/2000` | Excluded by noindex | May 19 |

These crawl dates predate the fixes. The C-Class page is healthy live; its historical Google status has not caught up. CLE's noindex status also predates this rollout, so it is not evidence of a new deindexing improvement. Google's URL Inspection API reports indexed-state information, not a live indexability test: [API reference](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect).

Do not interpret the sitemap's `indexed: 0` field as proof that no pages are indexed: the individual URL inspections above explicitly return indexed pages.

Search performance baseline for October 13–November 9: 15 impressions and zero clicks. No ranking, conversion or revenue improvement is claimed from this small, mostly pre-rollout sample.

The installed `recall-radar-search-console.timer` captures a read-only snapshot daily at 08:00 UTC. It does not resubmit the sitemap daily. The service uses the existing private Google service-account credentials. Raw snapshots are ignored under `artifacts/operations/`.

```sh
python scripts/search-console-audit.py
node scripts/sitemap-audit.mjs
```

The Python script uses `GOOGLE_APPLICATION_CREDENTIALS`. Install its dependencies from `scripts/requirements-search-console.txt`; `--submit` is an explicit sitemap resubmission option.

## 4. Conversion measurement

Migration `0012_lush_cammi.sql` adds daily aggregate counters. The deployed client measures page views, completed vehicle selections/search-result clicks, VIN lookup starts, separately labeled model-year/VIN-specific results, failures, dealer intent/outbound clicks and checklist print attempts. Existing partner click reporting is included in `scripts/conversion-report.mjs`.

Counters contain only UTC day, event name, page type and count. No full URLs, VINs, queries, IPs, cookies or visitor identifiers are stored in these counters. The client honors Do Not Track and Global Privacy Control. The public endpoint accepts bounded same-origin requests with whitelisted event/page types. The privacy page explains this collection.

Production browser checks confirmed event receipt for a completed vehicle selection, VIN attempt/result, dealer click and checklist print. Privacy opt-out, oversized payload rejection and cross-origin rejection also passed. Initial counts include these operator verification actions. They are event counts, not unique visitors, confirmed repairs, saved PDFs, purchases or earned commissions. JavaScript/privacy opt-outs mean these counts are not a complete census; no conversion rate is inferred across mismatched counters.

```sh
node scripts/conversion-report.mjs
```

This uses the same external Cloudflare credentials as the health check. Its output covers the last 30 days. The homepage's own combined scripts remain under the enforced 4 KiB gzip budget (4,046 bytes).

## 5. Affiliate activation

The owner confirmed that no programs are approved. Production `AFFILIATE_PARTNERS` remains empty, `/go/dvh` returns 404, and the disclosure correctly states that no affiliate partners are active. No application or agreement was submitted on the owner's behalf. Registry commission notes no longer imply an approval or guaranteed payout.

[Affiliate readiness](AFFILIATE_READINESS.md) contains official application links and the steps needed once an issued tracking URL is available. Future partner click logs strip referrer queries so a VIN in a lookup URL is not persisted accidentally. No historical clicks existed at verification.

## Validation and deployment

125 automated tests, TypeScript checks, Worker build, fixture browser checks and production browser checks passed. Production deployment: `a85be4f4646c488496bba44b81a42262`; HTML cache version `v38`. Existing bindings, secrets, schedules and workflow associations were preserved. The later monitoring-only changes run on the workspace host and do not change the deployed Worker bundle.

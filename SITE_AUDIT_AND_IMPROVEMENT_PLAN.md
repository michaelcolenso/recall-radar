# Recalled Rides: site audit and improvement plan

**Audit date:** 2026-09-04  
**Scope:** production behavior, Worker architecture, templates, public APIs, data model,
technical/on-page SEO, accessibility, performance, measurement, and product utility.  
**Production origin tested:** `https://recalledrides.com`

## Executive assessment

Recalled Rides has a strong technical foundation: server-rendered pages, clean hierarchical
URLs, real NHTSA data, useful campaign/year/component pages, canonical tags, structured data,
an accessible visual system, static assets at the edge, and a functioning ingestion/enrichment
pipeline. The site is substantially more capable than a basic programmatic-SEO directory.

The next phase should not be “publish more combinations.” It should make the existing corpus
more trustworthy, faster on cold edge locations, and more useful to a vehicle owner completing
the job of **identifying their exact vehicle, understanding the risk, and obtaining a free repair**.
The largest strategic risk is that model-year recall records can be interpreted as a VIN-specific
“open recall” result. NHTSA campaign applicability and repair completion are VIN-specific, while
the database primarily stores make/model/year campaign matches. Product language, result states,
and data provenance must make that distinction impossible to miss.

### Scorecard

| Area | Score | Assessment |
|---|---:|---|
| Crawlability and indexation | 85/100 | Sound routing and canonicals; sitemap generation is expensive and indexation controls need a quality policy. |
| On-page SEO | 86/100 | Strong metadata and internal links; some generated pages are too similar and schema is overextended. |
| Content quality / E-E-A-T | 76/100 | Primary-source text and methodology are present, but field-level provenance and editorial accountability can improve. |
| Performance | 72/100 | Lean SSR and async CSS are good; cold-cache D1 work, large HTML, font strategy, and cache topology are the main constraints. |
| Accessibility | 80/100 | Skip link, labels, landmarks, focus styles, and reduced-motion handling exist; interactive search semantics need work. |
| Product utility | 73/100 | Browse, campaign details, alerts, and VIN entry are valuable; the core “is *my* car affected?” journey is not yet definitive. |
| Measurement / operations | 55/100 | Observability exists, but product analytics and search/SEO outcome instrumentation are not configured in production config. |
| Security / privacy | 84/100 | Strong baseline headers and admin auth; CSP still permits inline script/style and public endpoints need consistent controls. |

## Audit method and limitations

The audit combined:

1. Static review of the TypeScript routes, SQL queries, templates, schema, cache helper,
   security middleware, tests, asset headers, and Cloudflare configuration.
2. Production HTTP checks against the home, make, model, year, robots, and sitemap routes.
3. Payload and sitemap measurements using `curl`, `wc`, and `rg`.
4. Existing automated checks (`npm test`, `npm run typecheck`, and the critical-CSS build).

Production sampling from this environment showed:

| URL | Status | Approx. transfer | Sample TTFB |
|---|---:|---:|---:|
| `/` | 200 | 46.9 KB HTML | 458 ms |
| `/toyota` | 200 | 58.3 KB HTML | 287 ms |
| `/toyota/camry` | 200 | 26.9 KB HTML | 120 ms |
| `/toyota/camry/2020` | 200 | 31.1 KB HTML | 117 ms |
| `/sitemap.xml` | 200 | 3.84 MB XML | 947 ms |

These are point-in-time synthetic observations, not field Core Web Vitals. They should be used
to identify investigation targets, not as an SLA or a substitute for Search Console, CrUX, and
Cloudflare analytics. No authenticated Search Console, Cloudflare dashboard, conversion data,
or real-user performance dataset was available. Ranking, traffic, index coverage, and CWV claims
therefore require instrumentation before they can be evaluated reliably.

## What is already working well

### Architecture and performance foundation

- Pages are server rendered and useful without client-side rendering.
- Page HTML is cached through the Cache API and advertises shared-cache freshness plus
  `stale-while-revalidate`.
- Critical CSS is inlined and the full stylesheet is loaded asynchronously.
- Static styles and fonts use long-lived cache headers and versioned stylesheet URLs.
- Width and height are supplied for make logos, reducing layout movement.
- D1 work is often parallelized with `Promise.all`, and schema indexes cover common parent,
  slug, year, campaign, severity, and score lookups.

### SEO foundation

- HTTPS, non-`www`, and trailing-slash normalization are enforced.
- Public pages have specific titles, descriptions, canonicals, Open Graph/Twitter metadata,
  breadcrumbs, and meaningful heading structures.
- Invalid and missing entities return real 404 responses with `noindex` controls.
- The site exposes robots rules, XML sitemaps, OpenSearch metadata, and linked-data markup.
- The information architecture provides make → model → year plus component, campaign, recency,
  model-statistics, and VIN paths.
- Campaign normalization avoids publishing malformed source identifiers as internal links.

### Utility and trust foundation

- Raw NHTSA text is preserved while enrichment is additive.
- Recall cards expose consequence and remedy rather than only a campaign headline.
- The site provides newest-recall discovery, severity filters, recall alerts, sharing, related
  vehicles, campaign pages, and model-level history.
- The UI visibly credits NHTSA and states that the site is independent.
- Admin workflows, dead-letter concepts, logs, and scoring support ongoing data operations.

### Accessibility and security foundation

- A skip link, semantic navigation/main/footer, keyboard focus styling, form labels, live regions,
  reduced-motion behavior, and image alternative text are present.
- HSTS, CSP, `nosniff`, referrer policy, HTTPS upgrades, and frame blocking are configured.
- Admin endpoints require bearer authentication; alert signup has fixed-window throttling and
  optional Turnstile support.

## Findings and recommendations

Priority definitions:

- **P0:** trust, correctness, or material outage risk; address immediately.
- **P1:** high impact on user success, crawl efficiency, or speed; address in the next cycle.
- **P2:** meaningful optimization after the foundation is measured.
- **P3:** experiment or expansion; pursue only when metrics justify it.

### 1. Utility, correctness, and trust

#### U1 — Separate model-year matches from VIN-specific open recalls (P0)

**Finding.** The core dataset establishes that NHTSA associated campaigns with a make/model/year.
It does not establish that every VIN in that model year is covered or that a particular vehicle's
repair remains incomplete. The public VIN page decodes the VIN and can fall back to the same
model-year campaign query, while site copy uses phrases such as “open safety recalls” and a
zero-result state that can read as definitive.

**Risk.** A safety-critical false negative or false assurance is more damaging than a missed SEO
opportunity. It also weakens user trust and creates legal/reputational exposure.

**Recommendation.** Introduce explicit result types across UI and APIs:

1. `VIN_VERIFIED_OPEN_RECALLS` — only when returned by an authoritative VIN-specific source that
   includes completion/applicability state.
2. `MODEL_YEAR_CAMPAIGN_MATCHES` — “recalls associated with vehicles like yours; confirm by VIN.”
3. `NO_MODEL_YEAR_MATCHES` — “none found in our current dataset,” never “your car is clear.”
4. `SOURCE_UNAVAILABLE` and `DATA_STALE` — do not collapse upstream failure into zero recalls.

Place a persistent “confirm with NHTSA or your dealer” action beside the result, link to the exact
official lookup, show the query timestamp/source, and revise all zero-state/title/description copy.
Add contract tests that prohibit “no open recalls” language for non-VIN-authoritative responses.

#### U2 — Make the primary journey task-based rather than browse-first (P1)

**Finding.** The home search is a typeahead over known make/model/year pages. It is useful for
discovery but does not guide users from partial information to a precise, actionable result.

**Recommendation.** Make two clearly distinct primary actions:

- **Check a VIN** (recommended, definitive when the source supports it).
- **Browse by year, make, and model** (research/history, explicitly not VIN confirmation).

Use progressive selectors with URL-addressable results and preserve a text-search fallback.
After results, present a task sequence: verify applicability → call dealer → save campaign numbers
→ subscribe for changes. Track completion of each step.

#### U3 — Explain risk scores and avoid pseudo-precision (P1)

**Finding.** Risk grade/score is derived locally from recall attributes. A numeric score can imply
validated crash probability or official NHTSA severity even when it is a heuristic.

**Recommendation.** Rename it to a clearly proprietary label (for example, “Recalled Rides
attention score”), publish the formula and limitations, show contributing factors, display a
calculation version/date, and never use it as a substitute for an official recall status. Validate
the classification against a reviewed sample and provide a correction channel.

#### U4 — Add repair-completion tools (P2)

Build high-utility, non-thin features around existing data:

- printable/shareable dealer checklist with campaign numbers;
- “what to ask the dealer” and reimbursement guidance sourced to NHTSA;
- save vehicles locally without an account, with optional alert enrollment;
- alert preferences and a transparent last-successful-ingestion timestamp;
- manufacturer/dealer contact links where the source record supports them;
- user-reported correction flow that records page, field, and reason without collecting sensitive
  vehicle data unnecessarily.

#### U5 — Treat freshness as a product state (P1)

**Finding.** Pages show update dates, but cache TTLs, daily ingestion, per-record freshness, and
upstream errors are different concepts.

**Recommendation.** Store and expose `source_fetched_at`, `source_last_changed_at`, enrichment
version, and ingestion status. Show “NHTSA data checked [timestamp]” on result pages. Trigger
targeted cache invalidation after data changes instead of waiting up to 12–24 hours. Alert when
freshness SLOs are missed.

### 2. Performance and reliability

#### P1 — Measure field performance before optimizing scores (P0)

**Finding.** `CF_ANALYTICS_TOKEN` and Google verification are empty in checked-in production
configuration. Cloudflare invocation tracing is enabled, but there is no visible RUM/SEO outcome
baseline in the repository.

**Recommendation.** Configure privacy-preserving Web Analytics or a first-party beacon and record:

- LCP, INP, CLS, TTFB, FCP by route family/device/country/cache state;
- search usage, zero-result rate, VIN completion, official-NHTSA outbound clicks, alert conversion;
- Worker CPU/wall time, D1 rows read, subrequests, cache hit rate, upstream error rate;
- Search Console impressions, clicks, CTR, average position, indexed/excluded URLs, and crawl stats.

Set initial p75 mobile targets: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, cached TTFB ≤200 ms, and
cold TTFB ≤800 ms. Targets are gates, not claims about current performance.

#### P2 — Make sitemap routing cheap and predictable (P1)

**Finding.** Every `/sitemap.xml` request performs seven count queries before it can decide whether
to serve a URL set or index. The current production response is a 3.84 MB, 20,892-URL document and
sampled near 1 second TTFB. This is standards-compliant (below 50,000 URLs and 50 MB uncompressed),
but wasteful and increasingly fragile.

**Recommendation.** Always serve a small sitemap index. Cache the index itself, generate stable
shards of at most 10,000–20,000 URLs, include only canonical/indexable/quality-approved pages, and
derive shard metadata during ingestion rather than via request-time global counts. Return explicit
browser/CDN cache headers and support conditional requests (`ETag`/`Last-Modified`). Test XML,
status, URL count, byte size, canonical status, and shard boundaries in CI.

#### P3 — Remove avoidable cold-page database work (P1)

**Finding.** Popular routes issue several aggregate joins and sequential entity lookups on a cache
miss. The homepage performs expensive site-wide counts; model/year pages repeat make/model/year
resolution and aggregate recall information at request time.

**Recommendation.** Create ingestion-maintained summary tables/materialized rows for home metrics,
make/model summaries, component counts, and sitemap metadata. Resolve hierarchical entities with
one joined query. Use denormalized counts already present on `vehicle_years` where correctness is
maintained. For each route family, capture `EXPLAIN QUERY PLAN`, D1 rows read, and p95 duration
before/after. Add missing compound indexes only from measured plans, not intuition.

#### P4 — Improve cache topology and invalidation (P1)

**Finding.** `caches.default` is data-center-local, so a populated cache in one location does not
guarantee a hit elsewhere. Cache writes are awaited in the response path, there is no request
coalescing, and a miss stampede can duplicate D1 work. HTML sends shared-cache directives but no
short browser freshness directive.

**Recommendation.** Evaluate Cloudflare Cache Rules for public HTML, use `ctx.waitUntil` for
best-effort writes, add cache lock/coalescing for hot misses, and purge/tag affected route families
after ingestion. Add `max-age=0, must-revalidate` (or a deliberate short browser TTL) alongside
`s-maxage`. Instrument `X-Cache`, colo, age, and render duration. Never cache personalized,
admin, alert-token, or failure responses.

#### P5 — Reduce document and font cost (P2)

**Finding.** The homepage includes roughly 14 KB of unminified critical CSS plus the full 51 KB
stylesheet, multiple inline behavior blocks, two preloaded font families, and optional platform-
injected scripts. Make pages can exceed 58 KB of HTML. The tracked font set is roughly 336 KB.

**Recommendation.** Per-template critical CSS should remain below a measured budget (for example,
10–12 KB compressed), preload only the actual above-the-fold face/weight, subset fonts by used
glyphs, and consolidate/minify inline behavior into a versioned deferred asset. Do not preload a
font that is not used above the fold. Paginate or progressively reveal very long make/model lists
without hiding crawlable links. Measure compressed transfer and LCP after each change.

#### P6 — Harden upstream and empty/error behavior (P1)

Add timeouts, typed upstream outcomes, retry/backoff with jitter, circuit breaking, and stale-safe
responses for NHTSA requests. Cache valid upstream results, not transient failures. Publish a basic
status/freshness endpoint for monitoring. Ensure an upstream outage cannot render a “no recalls”
success state.

### 3. Technical and on-page SEO

#### S1 — Establish an indexation quality gate (P0)

**Finding.** Sitemap eligibility is largely based on whether database rows exist. Programmatic
component, model, stats, campaign, and year combinations can be valid yet offer little unique value.
No Search Console evidence was available to establish whether these pages earn impressions or are
being classified as crawled/discovered-not-indexed, duplicates, or soft 404s.

**Recommendation.** Define an `indexability` policy computed from:

- valid canonical entity and successful source fetch;
- at least one normalized campaign or a genuinely useful researched no-recall explanation;
- minimum unique facts beyond navigation/boilerplate;
- sufficient source/enrichment freshness and no upstream-error state;
- no duplicate normalized entity/campaign intent.

Only quality-approved URLs belong in sitemaps and internal discovery modules. Apply `noindex,
follow` (not `nofollow`) to useful low-value navigation pages, and return 404/410 for nonexistent
or permanently removed entities. Review coverage by template monthly.

#### S2 — Fix noindex link semantics (P1)

**Finding.** Layout emits `noindex, nofollow` for noindex pages, and 404 headers also use
`noindex, nofollow`. On legitimate low-content pages, `nofollow` prevents internal-link discovery
signals from flowing through useful browse paths.

**Recommendation.** Use `noindex, follow` for valid-but-nonindexable pages. A real 404 does not
need a robots directive, though `noindex` is harmless. Reserve `nofollow` for exceptional cases,
not site-wide template defaults.

#### S3 — Align claims and snippets with actual evidence (P0)

Revise titles/descriptions/body copy that claim a vehicle “has no open recalls,” “complete recall
history,” or includes “investigation and complaint history” unless those facts are actually queried
and displayed. Distinguish recall campaigns, database rows, affected vehicles, and unique campaigns
in every count. Add tests for copy/source consistency.

#### S4 — Simplify and validate structured data (P1)

**Finding.** Pages can emit `FAQPage`, `BreadcrumbList`, `Vehicle`, and `HowTo`. Some markup applies
an editorial schema type to generated source summaries or a repair remedy that is not truly a
step-by-step procedure. FAQ rich results are generally limited by search engines and should not be
a content strategy.

**Recommendation.** Keep `Organization`, `WebSite`, and `BreadcrumbList`; use `Dataset`/
`DataCatalog` and appropriately sourced `Article`/`Report` semantics where they accurately describe
the content. Remove `HowTo` unless visible instructions contain complete ordered steps. Emit FAQ
only for visible, independently useful questions. Validate sampled templates in CI and in Google's
Rich Results/Schema.org validators after releases. Structured data must describe content, not try
to manufacture a result feature.

#### S5 — Improve provenance and E-E-A-T (P1)

Each recall should expose:

- a direct official campaign/source URL and retrieval date;
- raw versus plain-English labels and the enrichment/model version;
- methodology, limitations, update cadence, and correction policy;
- editorial owner/reviewer and a changelog for material methodology revisions;
- citations beside safety and repair claims, not only a generic footer source.

Add dedicated methodology, data sources, corrections, and contact pages. Link them from recall
pages and structured data. Avoid claiming expertise that is not documented.

#### S6 — Consolidate intent and control faceting (P1)

The make/model/year hierarchy is intuitive. Component pages, make-component pages, stats pages,
campaign pages, severity-filtered `/new` pages, and query URLs can overlap. Maintain a keyword-to-
template intent map and one canonical owner per intent:

- vehicle-specific lookup → year page;
- model history/comparison → model page;
- official defect/campaign → campaign page;
- cross-vehicle system research → component hub;
- recent announcements → `/new`.

Canonicalize or noindex filter/query permutations, cap crawlable pagination, and do not generate
new intersections until existing templates demonstrate indexation and engagement.

#### S7 — Make freshness metadata truthful (P1)

Static sitemap pages currently receive the request date as `lastmod`, and an index can likewise
claim “today” even when content did not change. Search engines expect `lastmod` to represent a
significant page change. Store actual content/source modification timestamps and omit `lastmod`
when unknown. Ignore `changefreq`/`priority` as optimization levers; crawl efficiency and accurate
modification dates matter more.

#### S8 — Improve social preview compatibility (P2)

The default and home Open Graph image is SVG. Some social consumers handle SVG inconsistently.
Use a tested 1200×630 PNG/JPEG as the primary `og:image`, supply MIME type and alt text, and keep
dynamic previews deterministic and cached. Run link-debugger checks for representative pages.

### 4. Accessibility and interaction quality

#### A1 — Implement the search field as an accessible combobox (P1)

The typeahead has a labeled input and keyboard movement, but lacks the complete combobox contract:
`role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, listbox/option roles,
and `aria-activedescendant`. Empty/error results are hidden rather than announced.

Implement WAI-ARIA combobox behavior, abort stale requests, announce result counts/errors, retain
normal form submission as a no-JavaScript fallback, and test with keyboard plus VoiceOver/NVDA.

#### A2 — Audit target size, contrast, motion, and zoom (P1)

Run axe and manual WCAG 2.2 AA checks across each route family in light/dark modes at 200% and
400% zoom. Pay special attention to 9–10 px metadata, tertiary text, severity conveyed by color,
sticky navigation height on mobile, filter pills, share buttons, alert status, and toast timing.
Animations should not delay visibility; content must remain visible if IntersectionObserver or
JavaScript fails.

#### A3 — Improve forms and result focus (P2)

Give every input a persistent visible label, connect help/error text with `aria-describedby`, focus
the result heading after VIN submission, use `aria-busy` during network work, and preserve entered
values on errors. Example VIN controls should describe their purpose and move focus back to the
input after populating it.

### 5. Security, privacy, and abuse controls

#### R1 — Move toward a nonce/hash CSP (P2)

The CSP is broad in useful ways but allows inline scripts and styles. Extract inline behaviors and
styles into versioned files or apply per-response nonces/hashes, then remove `unsafe-inline` where
practical. Add CSP reporting in report-only mode before enforcement changes.

#### R2 — Apply consistent public-endpoint controls (P1)

Search and VIN APIs should have bounded input, explicit timeouts, cache policy, response-size
limits, rate limiting, and structured error codes. Use an edge-native limiter/Durable Object if D1
write amplification becomes material. Keep VINs and alert tokens out of logs, analytics URLs, cache
keys visible to third parties, and referrers. Document retention and deletion behavior.

#### R3 — Complete production configuration (P0 before marketing)

Replace placeholders with verified configuration: Search Console ownership, analytics, Turnstile,
email sender/postal address, and any affiliate/ad settings. Maintain separate preview/production
configuration and a release check that fails when required production values are blank. Optional
services should remain safely disabled when unset.

## Prioritized delivery plan

### Phase 0 — Baseline and safety language (days 1–5)

**Outcome:** no ambiguous safety result and enough telemetry to evaluate later work.

1. Inventory every occurrence of “open,” “clear,” “complete,” “safe,” and zero-recall claims.
2. Implement the four typed result states from U1 and revise copy/API responses.
3. Add source/retrieval timestamps and official verification actions.
4. Configure Search Console and privacy-preserving RUM; create route-family dashboards.
5. Capture baseline p50/p75/p95 performance, D1 rows read, cache hit rate, index coverage, search
   zero-result rate, VIN completion, and NHTSA outbound verification rate.
6. Add synthetic monitors for homepage, representative entity pages, sitemap, NHTSA dependency,
   and alert signup (non-delivery test mode).

**Exit criteria:** reviewed safety copy; upstream errors cannot appear as zero results; dashboards
receive production data; freshness monitor and representative-page monitors alert correctly.

### Phase 1 — Crawl and cold-path efficiency (weeks 2–3)

**Outcome:** predictable discovery and materially faster cache misses.

1. Always return a sitemap index and generate quality-filtered shards during ingestion.
2. Correct `lastmod`; remove request-date churn and test every sitemap URL sample.
3. Establish indexability rules and apply `noindex, follow` appropriately.
4. Profile all route families with D1 query plans and rows-read measurements.
5. Add summary/materialized data for homepage and model aggregates; collapse hierarchical lookups.
6. Implement targeted invalidation and cache observability.

**Exit criteria:** sitemap index <50 KB; each shard below configured URL/byte budgets; no sampled
sitemap URL redirects, errors, or is noindexed; cold p75 TTFB ≤800 ms; cached p75 ≤200 ms; D1 rows
read reduced by at least 50% on the homepage and selected model page versus baseline.

### Phase 2 — Core user journey and accessibility (weeks 4–6)

**Outcome:** users can confidently move from vehicle identification to repair action.

1. Launch explicit VIN and browse entry paths with source-confidence labels.
2. Implement accessible combobox semantics and no-JS submission.
3. Add dealer checklist, save/share campaign list, and action-oriented result layout.
4. Explain the attention score with factors, version, methodology, and limitations.
5. Complete WCAG 2.2 AA automated/manual testing and resolve critical/serious findings.
6. Improve typed API errors, timeouts, throttling, and privacy-safe event tracking.

**Exit criteria:** no critical/serious axe violations on template samples; full journey works by
keyboard and without JavaScript for browse; source state is visible in every result; VIN/browse
completion and official-verification events are measurable.

### Phase 3 — Content quality and authority (weeks 7–10)

**Outcome:** fewer, stronger pages with defensible expertise and clearer search intent.

1. Publish methodology, sources, corrections, freshness, and editorial-review pages.
2. Put field-level NHTSA citations/retrieval dates on recall and campaign views.
3. Audit schema by template; remove inaccurate HowTo/FAQ markup and add accurate dataset metadata.
4. Build a template-intent map and merge/noindex underperforming overlaps.
5. Review and improve the top landing pages by impressions, not by arbitrary URL volume.
6. Add unique analysis only when supported by source data (trend context, affected-year range,
   remedy availability, and campaign chronology).

**Exit criteria:** 100% of indexable recall/campaign samples expose direct provenance; all sampled
structured data validates; index coverage quality and organic CTR improve against the Phase 0
baseline without increasing low-value indexed URLs.

### Phase 4 — Performance budgets and experiments (weeks 11–12)

**Outcome:** sustainable release discipline and evidence-based growth.

1. Split/minify route behavior, tune font preloads/subsets, and trim critical CSS by template.
2. Add CI budgets for compressed HTML/CSS/JS/font bytes and Lighthouse lab regressions.
3. Test PNG social cards and campaign-specific share content.
4. Experiment with alert CTA placement and repair checklist usage.
5. Create a quarterly prune/refresh process based on indexation, engagement, freshness, and user
   success—not page count.

**Exit criteria:** mobile p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 on adequately sampled route
families; no release exceeds budgets without explicit review; experiments have predeclared primary
metrics and guardrails.

## Measurement framework

### North-star outcome

**Verified recall action rate:** percentage of eligible sessions that reach an authoritative
verification step or save/click a repair action after viewing recall information.

This is more meaningful than raw pageviews because the product's purpose is safety action.

### Supporting metrics

| Funnel | Metrics |
|---|---|
| Acquisition | Non-brand impressions/clicks, CTR, landing pages with qualified traffic, indexed quality pages. |
| Discovery | Search use, zero results, selector completion, route exits, internal-search latency. |
| Trust | Official-source clicks, methodology views, correction reports, source-unavailable rate, data age. |
| Action | VIN attempts/completions, dealer-checklist saves/prints, alert confirmed rate, dealer/manufacturer clicks. |
| Performance | CWV p75 by route/device, TTFB by cache state/colo, HTML/CSS/font bytes, error rate. |
| Operations | Ingestion lag/success, enrichment coverage/quality, D1 rows read, cache hit rate, upstream latency/failure. |

Analytics must not store full VINs, emails, confirmation tokens, or free-text queries that may
contain them. Use coarse vehicle taxonomy IDs and privacy-reviewed event properties.

## Test and release gates to add

1. **Source semantics:** non-authoritative model-year results cannot claim VIN applicability,
   completion status, “open,” or “safe.”
2. **Sitemaps:** well-formed XML, correct index/shard type, URL and byte budgets, canonical 200 HTML,
   indexable status, accurate/valid `lastmod`, no duplicates.
3. **Metadata:** one title, description, canonical, and H1; escaped values; unique representative
   metadata across route families.
4. **Structured data:** JSON parses, matches visible content, uses allowed/accurate types, and
   references canonical URLs.
5. **Performance budgets:** compressed template payloads, critical CSS, script, and font preload
   count; repeatable lab test for representative routes.
6. **Accessibility:** axe plus keyboard smoke tests for home search, VIN flow, filters, alerts,
   share, pagination, and error states.
7. **Cache correctness:** HIT/MISS behavior, TTL, invalidation after ingestion, no caching of admin/
   token/error responses, and no stale personalization.
8. **Upstream resilience:** timeouts, 429/5xx/malformed JSON, stale source, partial data, and retry
   behavior never become a false zero result.
9. **Security:** authentication, webhook verification, rate limits, CSP regression, log redaction,
   and dependency audit.
10. **Link integrity:** crawl rendered internal links and sample all sitemap shards in preview.

## Recommended first implementation tickets

| Order | Ticket | Size | Primary KPI |
|---:|---|---:|---|
| 1 | Introduce authoritative/result-confidence states and revise safety copy | M | Zero ambiguous result states |
| 2 | Configure RUM, Search Console, outcome events, and dashboards | M | Baseline coverage ≥95% of public route traffic |
| 3 | Replace root URL set with precomputed sitemap index and shards | M | Root sitemap TTFB/bytes; valid index coverage |
| 4 | Add source fetched/changed timestamps and targeted invalidation | L | Data age; stale-page rate |
| 5 | Materialize homepage/model aggregates and profile D1 queries | L | Cold TTFB and rows read |
| 6 | Upgrade typeahead to an accessible combobox with form fallback | M | Search completion; accessibility violations |
| 7 | Publish methodology/corrections and field-level provenance | M | Official verification and trust engagement |
| 8 | Audit schema and remove inaccurate FAQ/HowTo usage | S | Structured-data validity; zero content mismatch |
| 9 | Add repair checklist/save/share journey | M | Verified recall action rate |
| 10 | Establish performance/accessibility/SEO CI budgets | M | Regression escape rate |

## Decisions explicitly deferred

- Do not create more programmatic page types until Search Console establishes demand and the
  indexability gate is operating.
- Do not optimize for FAQ rich results; prioritize visible usefulness and factual schema.
- Do not add a client framework solely for interactivity; the current server-rendered approach is
  an advantage.
- Do not claim a Lighthouse or Core Web Vitals score from point-in-time HTTP timings.
- Do not monetize the primary safety action in a way that obscures the free official repair path.

## Definition of success after 90 days

The plan succeeds when users always understand whether a result is VIN-authoritative or only a
model-year match; production field metrics and Search Console are available; sitemap discovery is
small, stable, and quality-filtered; representative cold routes meet the TTFB target with materially
lower D1 work; no critical accessibility issues remain; all indexed recall pages show direct source
provenance; and verified safety actions improve without growing the count of low-value indexed URLs.

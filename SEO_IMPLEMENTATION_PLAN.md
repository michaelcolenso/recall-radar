# RecallRadar SEO Implementation Plan

## Context

`recalledrides_audit.md` (June 2026 SEO audit) scored the site 92/100 and identified gaps. **The audit is partially stale** — verification against the codebase shows several of its top recommendations are already shipped:

- **VIN lookup is done** — `/vin/:vin` (`src/routes/pages.ts:628`) + `/vin-lookup` landing page (`pages.ts:264`), linked in nav, with NHTSA byVinProxy + vPIC fallback. The audit's #1 "critical gap" no longer exists.
- **CSS is versioned** — `?v=10` query param via `ASSET_VERSION` (`src/lib/constants.ts:42`).
- **Data-journalism foundations exist** — `/stats/:make/:model` reliability scorecards, risk grades (A+–F), make-component hub pages.

What remains valid and code-actionable (user-approved scope): **Stream A** quick wins (sitemap gaps, immutable CSS caching, critical CSS inlining, CSP), **Stream B** educational content hub (`/guides`), **Stream C** data-journalism rankings (`/rankings`). Excluded by user: i18n, tire/equipment recalls, mobile app, outreach/GSC (non-code).

Streams are independently shippable, in order A → B → C. No automated test suite beyond `tsx --test tests/*.test.ts`; `npm run typecheck` is the correctness gate.

## Verified architecture facts (rely on these)

- Route mounting in `src/index.ts:67-72`: `apiRoutes` → `seoRoutes` → `adminRoutes` → `wellKnownRoutes` → `pageRoutes` (last). `pageRoutes` has a `/:makeSlug{[a-z0-9-]+}` catch-all (`pages.ts:762`) — **new top-level routers MUST mount before `pageRoutes`**.
- Security middleware at `src/index.ts:46-62` (HSTS, redirects) — CSP goes here.
- Helpers currently private to `src/routes/pages.ts`: `CACHE_CONTROL` (:39), `HTML_HEADERS` (:40), `PAGE_CACHE_VERSION = "v9"` (:41), `linkHeaders()` (:43), `maybeMarkdown()` (:56), `notFoundBody()` (:1663), `withPageCacheVersion()` (:1673).
- `src/routes/seo.ts`: `SEO_CACHE_VERSION = "v6"` (:11); sitemap has two branches — single urlset (≤50k URLs, :151) and index of sub-sitemaps (:107). `/about` and `/vin-lookup` appear in **neither**.
- `public/_headers` exists (Workers Assets honors it): `/styles.css` → `max-age=300, stale-while-revalidate=604800`; fonts already `max-age=31536000, immutable`.
- `public/styles.css`: 1508 lines, banner-comment sections (TOKENS :74, RESET & BASE :220, LAYOUT SHELL :260, TYPOGRAPHY :431, HERO :457, STATS :626, …, SEVERITY :917, ANIMATIONS :936, BREADCRUMBS :955, MISC :1075). ~40KB raw / ~6KB gzipped.
- `src/templates/components/json-ld.ts`: `itemListJsonLd` (:229) and `aggregateRatingJsonLd` (:187) exist but are **unused**. `faqPageJsonLd` is recall-shaped, not reusable for a generic FAQ.
- All page routes: `getCachedOrRender(kv, key, ttl, renderFn)` from `src/lib/cache.ts`; HTML `Cache-Control: public, s-maxage=43200, stale-while-revalidate=86400`.
- `constants.ts:35` warning: never call `new Date()` at module level in Workers — compute current year inside handlers.
- Reusable CSS classes for new pages: `rr-hero`, `rr-body rr-body--large`, `rr-heading rr-heading--2`, `rr-label`, `rr-card`, `rr-readout-list`, `rr-risk-badge`, `rr-stat-card`, `rr-section-header` (markup patterns in `src/templates/model-stats-page.ts` and `src/templates/about.ts`).
- Error page in `src/index.ts:27` links `/styles.css` directly — full stylesheet must remain standalone.

---

## Stream 0 (prerequisite, ships with A): extract shared page helpers

**New `src/lib/page-helpers.ts`** — move verbatim from `src/routes/pages.ts`: `CACHE_CONTROL`, `HTML_HEADERS`, `PAGE_CACHE_VERSION`, `withPageCacheVersion()`, `linkHeaders()`, `maybeMarkdown()`, `notFoundBody()`. (`maybeMarkdown` uses `acceptsMarkdown`/`htmlToMarkdown` from `src/lib/utils.ts`; `notFoundBody` uses `escapeHtml` — lib→lib imports only, no cycle.)

**Modify `src/routes/pages.ts`**: delete local copies, import from `../lib/page-helpers`. Zero behavior change. Unblocks `guides.ts` (B) and `rankings.ts` (C) without importing from a route file.

---

## Stream A: Quick wins

### A1. Static pages in sitemap (`src/routes/seo.ts`)

1. Add `STATIC_SITEMAP_PATHS` constant: `/about` (priority 0.5, monthly), `/vin-lookup` (0.8, monthly). (B and C append to this list later. Homepage already in sitemap-makes — don't duplicate.)
2. New route `GET /sitemap-static.xml` — clone the `/sitemap-stats.xml` handler shape (seo.ts:331-347): `getCachedOrRender(c.env.PAGE_CACHE, withSeoCacheVersion("sitemap:static"), 86400, …)`.
3. Index branch (inside `totalUrls > MAX_URLS_PER_SITEMAP` block, after :115): push `sitemap-static.xml` entry unconditionally.
4. Single-urlset branch (after homepage push at :169): push the same static URLs.
5. Bump `SEO_CACHE_VERSION` `"v6"` → `"v7"`.

### A2. Immutable CSS caching (`public/_headers`)

**Decision: edit `_headers`, do NOT introduce hashed filenames** (no build step exists; hashing would mean inventing a pipeline for one file).

Why safe despite the existing comment ("Cloudflare's asset cache ignores query strings"): browsers key cache on the **full URL including `?v=N`**, so bumping `ASSET_VERSION` forces re-fetch; Workers Assets serve the currently deployed bytes immediately at the edge regardless of query string, so deploys propagate.

Replace the `/styles.css` block (lines 1-5) with:
```
# styles.css is immutable per ASSET_VERSION (src/lib/constants.ts). The <link> URL
# carries ?v=N, so browsers re-fetch on version bump. RULE: any edit to this file
# MUST bump ASSET_VERSION and PAGE_CACHE_VERSION, or returning visitors keep stale CSS for a year.
/styles.css
  Cache-Control: public, max-age=31536000, immutable
```

**Risk**: the 5-min stale-CSS safety net is gone; ASSET_VERSION bump discipline becomes mandatory (documented in `_headers` comment + `constants.ts:39-41`; the A3 drift test also forces attention on CSS edits).

### A3. Critical CSS inlining (fixes Speed Index 4.0s)

Inline an above-the-fold subset in `<head>`; load full stylesheet async via `media="print"` swap. Critical rules stay duplicated in `styles.css` (identical rules, last-wins; full sheet must stay standalone for the error page).

1. **`public/styles.css`** — add marker comments only (no rule changes):
   - `/* @critical:start */` at line 1 … `/* @critical:end */` just before STATS (~:625): covers FONTS, TOKENS, RESET & BASE, LAYOUT SHELL, TYPOGRAPHY, HERO.
   - Second region wrapping SEVERITY + ANIMATIONS + BREADCRUMBS (~:917-983) — badges/breadcrumbs are above the fold on detail pages; `rr-animate-in` (on `<main>`) must be inline to avoid a flash.
   - Inline payload ≈ 700 lines ≈ 18KB raw / ~3.5KB gzipped per page — acceptable.
2. **New `scripts/build-critical-css.mjs`** — exports `extractCriticalCss(cssText)` (collects all marker regions, strips comments, collapses whitespace); when run as main, reads `public/styles.css` and writes generated `src/templates/critical-css.ts` (`export const CRITICAL_CSS = "…"`, with DO-NOT-EDIT header). **Commit the generated file.**
3. **`package.json`**: add `"build:critical": "node scripts/build-critical-css.mjs"` and `"predeploy": "npm run build:critical"`.
4. **New `tests/critical-css.test.ts`** — drift guard: assert `extractCriticalCss(read styles.css)` === `CRITICAL_CSS`, and `CRITICAL_CSS.length > 5000`. Runs under existing `npm test`.
5. **`src/templates/layout.ts`** — replace line 67's `<link rel="stylesheet">` with:
```html
<style>${CRITICAL_CSS}</style>
<link rel="preload" href="/styles.css?v=${ASSET_VERSION}" as="style"/>
<link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION}" media="print" onload="this.media='all'"/>
<noscript><link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION}"/></noscript>
```
Import `CRITICAL_CSS` from `./critical-css`. Keep font preloads (:65-66). Leave error page in `src/index.ts` unchanged (rare path).
6. Bump `ASSET_VERSION` `"10"` → `"11"` and `PAGE_CACHE_VERSION` `"v9"` → `"v10"`.

**Risks**: maintenance tax (edit critical region → rerun `npm run build:critical`; test catches forgetting). The `onload=` inline handler requires the CSP below to allow `'unsafe-inline'` scripts.

### A4. Content-Security-Policy (`src/index.ts`)

**Decision: enforce immediately with `'unsafe-inline'` script-src** — nonces are impossible with 12h KV-cached HTML; the layout has ~6 inline scripts + inline JSON-LD + inline `style=""` attrs; no report endpoint exists so report-only adds nothing. Still blocks foreign script origins, framing, plugins, form exfiltration.

In the security middleware after the HSTS header (:47), add:
```ts
c.header("Content-Security-Policy",
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
c.header("X-Content-Type-Options", "nosniff");
c.header("Referrer-Policy", "strict-origin-when-cross-origin");
```
Allowance inventory verified: Insights script (layout.ts:69) + beacon POST (connect-src), inline scripts/JSON-LD (layout.ts:101-215), typeahead `fetch("/api/search…")` (connect-src 'self'), self-hosted fonts/images.

---

## Stream B: Educational content hub (`/guides`)

### B1. Guide registry + templates

**New `src/templates/guides/`**: `types.ts` (`GuideDef`: slug, title, metaDescription, heading, datePublished fixed ISO string, `body(siteUrl)`, optional `extraJsonLd(siteUrl)`), one file per guide, `index.ts` exporting `GUIDES: GuideDef[]` + `getGuide(slug)`, `shared.ts` (CTA + cross-link blocks), `hub.ts` (the `/guides` hub page). Follow `about.ts` markup conventions.

Five guides (slugs final; executor writes 600–1000 words prose each from these outlines):

| Slug | Title | Outline |
|---|---|---|
| `what-is-a-vehicle-recall` | What Is a Vehicle Recall? Plain-English Explanation | Definition; NHTSA vs. manufacturer-initiated; campaign numbers; owner notification; recall vs. TSB vs. investigation; severity levels (link to glossary) |
| `how-recall-repairs-work` | How Recall Repairs Work — Why They're Always Free | Legal basis (49 U.S.C. 30120); repair/replace/refund remedies; scheduling; parts delays; loaner rights; 10-year limit caveat |
| `what-to-do-if-your-car-is-recalled` | What to Do If Your Car Is Recalled: Step-by-Step | Confirm via VIN → read notice → assess severity (Do Not Drive / Park Outside) → call dealer → free repair → keep records. Include `howToJsonLd` (json-ld.ts:205) with these steps |
| `recall-faq` | Vehicle Recall FAQ — Common Questions Answered | 10–12 Q&As: free repairs? expiration? used car with open recall? selling? value impact? dealer refuses? leased cars? check by VIN? |
| `recall-glossary` | NHTSA Recall Glossary: Components, Severity & Terms | `<dl>` of terms: campaign number, NHTSA components (AIR BAGS, FUEL SYSTEM, STEERING, …), severity levels, risk score/grade (reuse `gradeDescription` from `src/lib/risk-score.ts:290`), remedy, consequence, Do Not Drive/Park Outside advisories, VIN |

Every guide body ends with shared blocks: CTA to `/vin-lookup` + "Check recalls by make" links (first 12 of `POPULAR_MAKES` via `slugify` from `src/lib/utils.ts`) + cross-links to other guides.

### B2. New JSON-LD helper (`src/templates/components/json-ld.ts`)

Add `genericFaqPageJsonLd(items: {question, answer}[], pageUrl)` emitting standard FAQPage/Question/acceptedAnswer. Used by `recall-faq` — answers must mirror visible page copy (Google parity requirement).

### B3. Routes

**New `src/routes/guides.ts`** (`guideRoutes`):
- `GET /guides` — `getCachedOrRender(kv, withPageCacheVersion("page:guides"), 86400, …)`; JSON-LD: `breadcrumbListJsonLd` + `itemListJsonLd` (first use of the unused helper).
- `GET /guides/:slug{[a-z0-9-]+}` — registry lookup; unknown slug → 404 with `noIndex: true` + `notFoundBody()` (mirror stats-route 404, pages.ts:309-321). Found: key `page:guides:${slug}`, TTL 86400; JSON-LD: `articleJsonLd` + `breadcrumbListJsonLd(Home → Guides → heading)` + `extraJsonLd`.
- Both: `CACHE_CONTROL`, `X-Cache`, `linkHeaders(siteUrl)`, return via `maybeMarkdown()` — all from `src/lib/page-helpers.ts`. Visible breadcrumbs via `breadcrumbs()` component.

**`src/index.ts`**: `app.route("/", guideRoutes);` **before** `app.route("/", pageRoutes);` (:72).

### B4. Inbound internal links

- `src/templates/layout.ts` nav (:82-89): add `<a href="/guides">Guides</a>`. Footer (:98): add `· <a href="/guides">Recall Guides</a> · <a href="/vin-lookup">VIN Lookup</a> · <a href="/about">About</a>`.
- `src/templates/components/related-links.ts`: append static links to `/guides/what-to-do-if-your-car-is-recalled` and `/guides/how-recall-repairs-work` in `relatedLinks()` — puts guide links on every year page (called at pages.ts:1436).

### B5. Sitemap + version bumps

Extend `STATIC_SITEMAP_PATHS` with `/guides` (0.7, monthly) + each `/guides/${slug}` (0.7, monthly), importing `GUIDES`. Bump `SEO_CACHE_VERSION` → `"v8"`, `PAGE_CACHE_VERSION` → `"v11"` (layout changed on every page). `ASSET_VERSION` only if new CSS is added (prefer existing classes; glossary `<dl>` styles go in MISC → non-critical, but bump + rerun `build:critical` if styles.css changes at all).

---

## Stream C: Data journalism pages (`/rankings`)

### C1. Routes — new `src/routes/rankings.ts` (`rankingRoutes`), mounted before `pageRoutes`

All handlers: `getCachedOrRender`, **TTL 604800 (7 days)** — data changes only on Monday cron; keys `withPageCacheVersion("page:rankings…")`; standard headers/`maybeMarkdown`. Compute `currentYear` inside handlers.

1. `GET /rankings` — hub: cards to the three list pages + last ~6 per-year pages. JSON-LD: breadcrumb + itemList. Title: `Vehicle Recall Rankings & Statistics | Recalled Rides`.
2. `GET /rankings/most-recalled-makes` — `SELECT mk.name, mk.slug, SUM(vy.recall_count) total_recalls, SUM(vy.critical_recall_count), COUNT(DISTINCT m.id) FROM makes mk JOIN models m ON m.make_id=mk.id JOIN vehicle_years vy ON vy.model_id=m.id GROUP BY mk.id HAVING total_recalls > 0 ORDER BY total_recalls DESC LIMIT 30`. Rows link to `/${slug}`. Title: `Most Recalled Car Brands — ${currentYear} NHTSA Rankings | Recalled Rides`.
3. `GET /rankings/most-recalled-models` — same join grouped by `m.id` with `MIN/MAX(vy.year)`, `ORDER BY total_recalls DESC LIMIT 50`. Rows link to `/${make_slug}/${model_slug}` and `/stats/…`.
4. `GET /rankings/most-reliable-models` — `AVG(vy.risk_score)` ASC with `HAVING year_count >= 5` floor (named constant). **Verify data shape first**: `wrangler d1 execute recall-radar-db --local --command "SELECT COUNT(*) FROM vehicle_years WHERE risk_score IS NULL AND recall_count = 0"` — if zero-recall years are unscored, drop the `risk_score IS NOT NULL` filter and rank by `SUM(recall_count) ASC` with `HAVING year_count >= 8`.
5. `GET /rankings/most-recalled-cars-of-:year{[0-9]{4}}` — validate `2000 ≤ year ≤ currentYear+1` else 404 noIndex. `SELECT … FROM vehicle_years vy JOIN models/makes WHERE vy.year=? AND vy.recall_count>0 ORDER BY vy.recall_count DESC, vy.critical_recall_count DESC LIMIT 25`. Rows link to year pages; footer links to adjacent years (clamped).

Aggregates scan denormalized `vehicle_years` with existing indexes — cheap; 7-day KV cache makes cost moot.

### C2. Templates — new `src/templates/rankings-page.ts`

`rankingsHubTemplate(…)` + generic `rankingTableTemplate({heading, intro, columns, rows})` — ranked list reusing `rr-readout-list`/`rr-card` row markup (pattern: `model-stats-page.ts`) with rank number, linked vehicle, recall count, `rr-risk-badge` for grades. No client JS. Methodology paragraph linking `/about` + `/guides/recall-glossary`; use `gradeDescription()` where grades shown. If `.rr-rank-row`/`.rr-rank-num` styles needed (~15 lines), add to MISC section → bump `ASSET_VERSION`.

JSON-LD per list page: `breadcrumbListJsonLd` + `itemListJsonLd(heading, rows → {name, url, description})`.

### C3. Internal links

- Layout footer: add `<a href="/rankings">Recall Rankings</a>` to the B4 link row.
- `src/templates/home.ts`: compact "Recall Rankings" link block near "Popular Recall Pages" (hub + most-recalled-makes + most-recalled-cars-of-{currentYear−1}); pass `currentYear` as a new optional `homeTemplate` param (update `tests/seo-page-links.test.ts` call sites).
- Rankings hub links to `/guides` and `/vin-lookup`.

### C4. Sitemap + version bumps

Extend static-URL builder: `/rankings` (0.8, weekly), three list pages (0.7, weekly), `/rankings/most-recalled-cars-of-${y}` for `y` in `2000..currentYear` (0.6, monthly) — year range computed inside the render closure. Bump `SEO_CACHE_VERSION` → `"v9"`, `PAGE_CACHE_VERSION` → `"v12"`.

---

## Verification (per stream)

1. `npm run typecheck` && `npm test` (includes new `tests/critical-css.test.ts`; fix `tests/seo-page-links.test.ts` if `homeTemplate` signature changed).
2. `npm run dev` (localhost:8787):
   - **A**: `curl -s localhost:8787/sitemap-static.xml` contains `/about` + `/vin-lookup`; `curl -sI localhost:8787/styles.css | grep -i cache-control` → `max-age=31536000, immutable`; `curl -sI localhost:8787/ | grep -i content-security` → present; `curl -s localhost:8787/ | head -c 4000` → inline `<style>`, `media="print" onload=`, `<noscript>` fallback. Browser check (Playwright MCP): load `/` + a year page — no unstyled flash, zero CSP console violations, fonts render.
   - **B**: `/guides` contains `ItemList`; `/guides/recall-faq` contains `FAQPage`; `/guides/what-to-do-if-your-car-is-recalled` has ≥3 `application/ld+json` blocks (Article + Breadcrumb + HowTo); `/guides/nonexistent` → 404; a year page contains `href="/guides/`.
   - **C**: `/rankings/most-recalled-makes` contains `ItemList`; `/rankings/most-recalled-cars-of-1850` → 404; `X-Cache: MISS` then `HIT` on repeat; sanity-check rankings against direct `wrangler d1 execute` of the same SQL.
3. Schema: validator.schema.org during dev; post-deploy Google Rich Results Test on `/guides/recall-faq` (FAQ), one guide (Article), one rankings page (ItemList).
4. Post-deploy: `curl -sI https://recalledrides.com/styles.css?v=11`; resubmit sitemap in Search Console; confirm no Insights-beacon CSP errors in real browsers.

## Risks / decisions

- **CSP with `'unsafe-inline'`**: deliberate — nonces incompatible with 12h KV-cached HTML. Limited XSS hardening but blocks external script injection. The `onload=` CSS swap depends on it.
- **Immutable CSS**: removes 5-min safety net; bump discipline mandatory (documented in `_headers` + `constants.ts`; drift test reminds).
- **Critical CSS duplication**: generator + equality test + `predeploy` hook are the guardrails. Fallback if generator feels heavy: hand-maintained constant (accept drift risk).
- **Most-reliable rankings**: verify whether zero-recall years carry `risk_score` before choosing ordering (C1.4).
- **Route shadowing**: `/guides` and `/rankings` MUST mount before `pageRoutes` or the `/:makeSlug` catch-all eats them.
- **FAQ rich results**: JSON-LD answers must stay verbatim-parallel to visible text.

## Critical files

- `src/routes/pages.ts` — helper extraction; reference patterns for new routes
- `src/routes/seo.ts` — sitemap-static.xml, static URL list, version bumps
- `src/templates/layout.ts` — critical CSS inline, async stylesheet, nav/footer links
- `src/index.ts` — CSP middleware; mount `guideRoutes`/`rankingRoutes` before `pageRoutes`
- `src/templates/components/json-ld.ts` — `genericFaqPageJsonLd`; `itemListJsonLd` reuse
- `public/_headers`, `public/styles.css`, `src/lib/constants.ts` — caching + versioning
- New: `src/lib/page-helpers.ts`, `src/routes/guides.ts`, `src/routes/rankings.ts`, `src/templates/guides/*`, `src/templates/rankings-page.ts`, `scripts/build-critical-css.mjs`, `tests/critical-css.test.ts`

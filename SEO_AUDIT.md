# RecallRadar SEO Audit Report

**Date:** 2026-05-07  
**Site:** https://recallradar.com  
**Type:** Programmatic SEO (Vehicle Recall Database)  
**Scope:** Full site — Technical + On-Page + Content + Schema

---

## Executive Summary

**Overall Health:** 🟢 Strong technical foundation with room for horizontal expansion.

RecallRadar has a **production-ready SEO base**: Cloudflare Workers provides excellent speed, the URL structure is clean and keyword-rich, and the programmatic page generation covers a meaningful long-tail keyword space (`{year} {make} {model} recalls`). The sitemap architecture is correctly sharded, KV caching keeps response times fast, and most critical SEO elements are already implemented.

**Note:** A previous version of this audit flagged several issues that have since been resolved. See [Resolved Issues](#resolved-issues) below.

**Current priority:** Expand the programmatic surface area. The site stops at the year level (`/:make/:model/:year`). Adding component-specific pages, campaign detail pages, and aggregate statistics would unlock a **3–10x multiplier** on indexable URLs.

**Estimated SEO Impact of expansion:** Medium-to-High. This is a programmatic SEO site where horizontal expansion multiplies across the entire NHTSA dataset.

---

## Technical SEO Findings

### 1. Sitemap Architecture ✅ (Good)

| Aspect | Status | Notes |
|--------|--------|-------|
| Root sitemap | ✅ | Correctly switches between flat `urlset` and sitemap index |
| Sharding | ✅ | 45,000 URL chunks for year pages when >50,000 total URLs |
| Sub-sitemaps | ✅ | `/sitemap-makes.xml`, `/sitemap-models.xml`, `/sitemap-years-{n}.xml` |
| Cache | ✅ | Each sitemap cached in KV for 24h |
| `lastmod` | ✅ | Uses `last_ingested_at` / `updated_at` from DB (not today's date) |

**Priority:** None — good as-is.

---

### 2. Robots.txt ✅ (Adequate)

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://recallradar.com/sitemap.xml
```

References root sitemap index (crawlers follow the index to sub-sitemaps). No issues.

**Priority:** None.

---

### 3. Trailing Slash & Canonical Normalization ✅

**Fixed:** Hono middleware in `src/index.ts` 301-redirects all trailing-slash URLs to the canonical non-slash version:

```ts
app.use(async (c, next) => {
  const path = c.req.path;
  if (c.req.method === "GET" && path.length > 1 && path.endsWith("/")) {
    const url = new URL(c.req.url);
    const query = url.search;
    return c.redirect(path.slice(0, -1) + query, 301);
  }
  await next();
});
```

**Priority:** None — resolved.

---

### 4. 404 Page Handling ✅

**Fixed:** All 404 responses now return:
- `Title: "Not Found"`
- `Meta description` (e.g., "This vehicle page could not be found...")
- `<meta name="robots" content="noindex, nofollow"/>`
- Soft 404 body with link back to homepage
- HTTP 404 status

**Priority:** None — resolved.

---

### 5. Cache Headers ✅

`Cache-Control: public, s-maxage=43200, stale-while-revalidate=86400`

- 12-hour shared cache + 24-hour stale-while-revalidate is appropriate for largely static recall data.
- KV cache acts as a render cache with 12–24h TTL.

**Priority:** None — good as-is.

---

### 6. Speed & Core Web Vitals ✅

**Strengths:**
- Cloudflare Workers edge deployment = excellent TTFB globally.
- No images in page templates = zero image optimization issues.
- Minimal JavaScript (none in critical path).
- `preconnect` hints for Google Fonts.
- Tailwind CSS is purged/minified via `public/styles.css`.

**Priority:** None.

---

### 7. HTTPS & Security ✅

- Cloudflare enforces HTTPS by default.
- No mixed content issues.
- External NHTSA link is HTTPS with `rel="noopener noreferrer"`.

**Priority:** None.

---

## On-Page SEO Findings

### 8. Title Tags ✅ (Stable)

| Page | Title | Assessment |
|------|-------|------------|
| Home | `RecallRadar — Vehicle Recall Search` | ✅ Brand-first is fine for homepage |
| Make | `{Make} Vehicle Recalls & Safety Issues \| RecallRadar` | ✅ Keyword-rich, descriptive |
| Model | `{Make} {Model} Recalls by Year \| RecallRadar` | ✅ Good long-tail targeting |
| Year | `{Year} {Make} {Model} Recalls & Safety Issues \| RecallRadar` | ✅ Stable, no dynamic drift |
| About | `About RecallRadar` | ✅ Simple, clear |
| 404 | `Not Found` | ✅ `noindex` prevents indexing |

**Previously:** Year-page titles used a dynamic `topComponent` that could shift if recall ordering changed. This has been replaced with a stable title.

**Priority:** None — resolved.

---

### 9. Meta Descriptions ✅ (Good)

All pages have unique, descriptive meta descriptions. The year-page description includes dynamic recall count.

**Priority:** None.

---

### 10. Open Graph Tags ✅ (Complete)

**Present:** `og:url`, `og:title`, `og:description`, `og:type`, `og:site_name`, `og:image`

- Homepage uses `og:type="website"`.
- Other pages use `og:type="article"`.
- `og:site_name` = `"RecallRadar"`.
- `og:image` defaults to `/og-image.png`.

**Priority:** None — resolved.

---

### 11. Twitter Cards ✅ (Complete)

All Twitter Card tags present:
- `twitter:card="summary_large_image"`
- `twitter:title`
- `twitter:description`
- `twitter:image`

**Priority:** None — resolved.

---

### 12. Canonical Tags ✅ (Present)

- All valid pages have self-referencing canonicals.
- No query-parameter stripping needed (no faceted search).
- 404 pages intentionally omit canonical (acceptable given `noindex`).

**Priority:** None.

---

### 13. Heading Structure ✅ (Fixed)

| Page | H1 | H2 | H3+ |
|------|-----|-----|-----|
| Home | "Is Your Car Safe?" | "Browse Recalls by Make" | ❌ None |
| Make | "{Make} Recalls & Safety Issues" | "{Make} Models" | ❌ None |
| Model | "{Make} {Model} Recalls by Year" | "Recall History by Year" | ❌ None |
| Year | "{Year} {Make} {Model} Recalls" | "Known Safety Recalls" (sr-only), "Other {Make} {Model} Years" | ✅ Recall component |

**Priority:** None — resolved.

---

### 14. Image Optimization — N/A

No images in page templates. `og-image.png` exists in `public/` for social sharing.

**Priority:** Low.

---

## Content Quality Findings

### 15. E-E-A-T Signals ✅ (Improved)

| Signal | Status | Notes |
|--------|--------|-------|
| Experience | ⚠️ | Content is algorithmically generated from NHTSA data + LLM enrichment. No first-hand mechanic/repair experience. |
| Expertise | ⚠️ | No author bylines, no automotive expert credentials. |
| Authoritativeness | ✅ | Data is sourced from NHTSA (authoritative). |
| Trustworthiness | ✅ | HTTPS, clear disclaimer, transparent data source, About page exists with methodology. |

**Fix:** Added methodology section to About page to explain data sourcing and LLM enrichment transparency.

**Priority:** Low.

---

### 16. Content Depth ✅ (Good on Year Pages)

Year pages (the "money pages") have strong content depth:
- LLM-enriched plain-English explanations.
- Raw NHTSA text fallback.
- Severity classification.
- Component breakdown.
- Consequence and remedy details.
- Date reported.

**Gap:** Make and Model pages are thin directory/listing pages with minimal unique text. This is acceptable for navigational pages but could be enhanced with aggregate stats (total recall count, most common issues, trend highlights).

**Priority:** Low.

---

### 17. Internal Linking ✅ (Good Structure)

**Strengths:**
- Clear hierarchical linking: Home → Make → Model → Year.
- Breadcrumb navigation on make, model, and year pages with matching JSON-LD.
- Year pages link to "Other {Make} {Model} Years".

**Gap:** No cross-model or cross-make links. No "Related Components" on year pages (opportunity for Phase 2 expansion).

**Priority:** Low (will be addressed by expansion).

---

## Schema Markup Findings

### 18. JSON-LD: FAQPage ✅ (Good)

**Present on:** Year pages only (`/:make/:model/:year`)

- `url` property included on FAQPage.
- `datePublished` included on each answer.
- Concatenated text field for answer content.

**Priority:** None — good as-is.

---

### 19. JSON-LD: BreadcrumbList ✅

**Present on:** Make, Model, Year pages.

- Correctly uses absolute URLs for `item`.
- `position` is 1-indexed.
- Matches visible breadcrumb HTML exactly.

**Priority:** None — good as-is.

---

### 20. JSON-LD: WebSite, Organization, Vehicle ✅

All previously missing schema types are now present:

| Schema Type | Page | Status |
|-------------|------|--------|
| `WebSite` + `SearchAction` | Home | ✅ |
| `Organization` | Home | ✅ |
| `Vehicle` | Year | ✅ Includes `knownVehicleDamages` |
| `BreadcrumbList` | Make, Model, Year | ✅ |
| `FAQPage` | Year | ✅ |

**Priority:** None — resolved.

---

## Resolved Issues

The following issues from earlier audits have been fixed in the current codebase:

| # | Issue | Fix Location |
|---|-------|-------------|
| 1 | 404 pages lacked `noindex` | `src/routes/pages.ts` — all 404 handlers pass `noIndex: true` |
| 2 | Trailing slashes not redirected | `src/index.ts` — 301 redirect middleware added |
| 3 | Missing OG image / `og:type` / `og:site_name` | `src/templates/layout.ts` — all OG tags present |
| 4 | Missing Twitter Card tags | `src/templates/layout.ts` — `twitter:card`, title, description, image |
| 5 | Missing `WebSite` and `Organization` JSON-LD | `src/templates/components/json-ld.ts` + `src/routes/pages.ts` |
| 6 | Unstable year-page titles (dynamic component) | `src/routes/pages.ts` — title now stable |
| 7 | Missing H2 headings on make/model pages | `src/templates/make-page.ts`, `src/templates/model-page.ts` |
| 8 | Missing FAQPage `url` and `datePublished` | `src/templates/components/json-ld.ts` |
| 9 | Sitemap `lastmod` always today's date | `src/routes/seo.ts` — now uses DB timestamps |
| 10 | Missing About page | `src/routes/pages.ts` + `src/templates/about.ts` |
| 11 | Missing `Vehicle` schema | `src/templates/components/json-ld.ts` + `src/routes/pages.ts` |

---

## Remaining Action Items

### 🟡 Low Impact (Nice to Have)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 1 | **Visible H2 above recall list** (currently sr-only) | `src/templates/year-page.ts` | 5 min |
| 2 | **Add related model links** on year pages | `src/templates/year-page.ts`, `src/routes/pages.ts` | 30 min |
| 3 | **Add aggregate stats** to make/model pages | `src/templates/make-page.ts`, `model-page.ts`, `src/routes/pages.ts` | 1 hour |
| 4 | **Strengthen About page** with methodology section | `src/templates/about.ts` | 30 min |

---

## Expansion Opportunities (High Impact)

See `PROGRAMMATIC_SEO_STRATEGY.md` for the full expansion roadmap. Quick summary:

| Page Type | URL Pattern | Est. Pages | Search Intent |
|-----------|------------|------------|---------------|
| Component year pages | `/:make/:model/:year/:component` | 1,000–400,000 | `"2020 Camry air bag recall"` |
| Campaign detail pages | `/recall/:campaignNumber` | 50,000+ | `"NHTSA campaign 20V682000"` |
| Make component hubs | `/:make/:component-recalls` | 500–1,500 | `"Toyota air bag recalls"` |
| Model reliability scorecards | `/stats/:make/:model` | 5,000+ | `"Camry reliability"` |
| VIN lookup tool | `/vin-lookup` | 1 | `"VIN recall check"` |

---

## Appendix: File-by-File SEO Checklist

| File | SEO Elements | Status |
|------|-------------|--------|
| `src/templates/layout.ts` | Title, description, canonical, OG, Twitter, robots | ✅ Complete |
| `src/routes/pages.ts` | Titles, descriptions, canonicals, breadcrumbs, JSON-LD | ✅ Stable titles, no 404 indexation |
| `src/routes/seo.ts` | Robots.txt, sitemaps | ✅ Correct lastmod, sharding |
| `src/templates/components/json-ld.ts` | FAQPage, BreadcrumbList, WebSite, Organization, Vehicle | ✅ Complete |
| `src/templates/home.ts` | H1, H2, internal links | ✅ Good |
| `src/templates/make-page.ts` | H1, H2, internal links | ✅ Good |
| `src/templates/model-page.ts` | H1, H2, internal links | ✅ Good |
| `src/templates/year-page.ts` | H1, H2 (sr-only), content depth, related links | ✅ Good |
| `src/templates/components/recall-card.ts` | Semantic markup | ✅ Uses `<article>` + `<h3>` for component |
| `public/styles.css` | CSS delivery | ✅ Minimal, no render-blocking JS |

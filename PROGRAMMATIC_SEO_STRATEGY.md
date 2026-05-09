# RecallRadar — Programmatic SEO Audit & Strategy

**Date:** 2026-05-07  
**Status:** ✅ Strong technical foundation ready for horizontal expansion  
**Scope:** Audit current state + 12-month programmatic SEO roadmap

---

## Executive Summary

RecallRadar has a **production-ready technical SEO foundation**. The issues documented in `SEO_AUDIT.md` have largely been resolved:

- ✅ `noindex` on 404s
- ✅ Trailing-slash 301 redirects
- ✅ Stable title tags (no dynamic component drift)
- ✅ Open Graph, Twitter Cards, `og:site_name`
- ✅ `WebSite`, `Organization`, `Vehicle`, `FAQPage`, `BreadcrumbList` schema
- ✅ Sitemap sharding with real `lastmod` dates
- ✅ KV-render caching + edge deployment

**Current indexable page count:** ~731 (1 make + 463 models + 267 year pages). With full NHTSA ingestion this scales to **10,000–100,000+ year pages**.

**The real opportunity is horizontal expansion.** The site stops at the year level (`/:make/:model/:year`). Adding component-specific pages, campaign detail pages, and aggregate statistics would unlock a **3–10x multiplier** on indexable URLs while targeting higher-intent long-tail queries.

---

## 1. Current State Audit

### 1.1 Page Inventory

| Page Type | URL Pattern | Count | Content Depth | Priority |
|-----------|-------------|-------|---------------|----------|
| Homepage | `/` | 1 | Moderate | Hub |
| Make landing | `/:makeSlug` | 1 (463 potential) | Thin directory | Navigation |
| Model landing | `/:makeSlug/:modelSlug` | 463 | Thin directory | Navigation |
| Year detail (money page) | `/:makeSlug/:modelSlug/:year` | 267 | **Deep / Unique** | **🟢 Rank** |
| About | `/about` | 1 | Static editorial | Trust |
| Sitemaps | `/sitemap*.xml` | Dynamic | — | Indexation |

### 1.2 Technical SEO Scorecard

| Area | Status | Notes |
|------|--------|-------|
| URL structure | 🟢 Excellent | `/:make/:model/:year`, keyword-rich, stable |
| Canonicals | 🟢 Good | Self-referencing, no query params to strip |
| Trailing slashes | 🟢 Fixed | 301 redirect middleware in `src/index.ts` |
| 404 handling | 🟢 Fixed | `noindex,nofollow` + 404 status + soft 404 body |
| Meta titles | 🟢 Stable | No dynamic component drift on year pages |
| Meta descriptions | 🟢 Good | Unique per page type, dynamic count on year pages |
| OG / Twitter | 🟢 Complete | `og:image`, `og:type`, `og:site_name`, Twitter Cards |
| Schema markup | 🟢 Rich | FAQPage, BreadcrumbList, WebSite, Organization, Vehicle |
| Sitemap | 🟢 Sharded | 45k chunks, sub-sitemaps, cached, real `lastmod` |
| Cache headers | 🟢 Good | `s-maxage=43200, stale-while-revalidate=86400` |
| Speed / CWV | 🟢 Excellent | Edge Workers, no JS bloat, minimal assets |
| Internal linking | 🟡 Good | Hierarchical drill-down + breadcrumbs + related years |

### 1.3 Remaining Quick Fixes (Low Effort)

| # | Issue | File | Effort |
|---|-------|------|--------|
| 1 | **Make page has no H2 heading** | `src/templates/make-page.ts` | 5 min |
| 2 | **Model page has no H2 heading** | `src/templates/model-page.ts` | 5 min |
| 3 | **Recall card titles use `<div>` instead of `<h3>`** | `src/templates/components/recall-card.ts` | 10 min |
| 4 | **Update `SEO_AUDIT.md`** — most findings are stale | `SEO_AUDIT.md` | 30 min |

---

## 2. Expansion Strategy: 5 Playbooks

### Playbook 1: Component-Specific Year Pages (Highest Impact)

**Pattern:** `/:makeSlug/:modelSlug/:year/:componentSlug`  
**Example:** `/toyota/camry/2020/air-bag`  
**Keyword:** `"2020 Toyota Camry air bag recall"`  
**Playbook:** Directory + Curation

**Why this wins:**
- Uses existing `recalls.component` data (zero new ingestion)
- Captures the highest-intent searches — users who know the component
- Differentiates from competitors that stop at the year level
- Each page is genuinely unique (subset of recalls + component-specific context)

**Implementation:**
```
URL: /toyota/camry/2020/air-bag
Title: 2020 Toyota Camry Air Bag Recalls | RecallRadar
H1: 2020 Toyota Camry Air Bag Recalls & Safety Issues
Content: Filtered recall cards where component contains "AIR BAG"
Schema: FAQPage (filtered) + BreadcrumbList + Vehicle
Internal links: Link back to year page, link to other components for same year
```

**Page multiplier:** 3–10x per year page (avg 4 components per year).  
**Estimated new pages:** 1,000–2,700 (at current scale) → 40,000–400,000 (at full scale).

---

### Playbook 2: Campaign Detail Pages

**Pattern:** `/recall/:campaignNumber`  
**Example:** `/recall/20V682000`  
**Keyword:** `"NHTSA campaign 20V682000"`, `"20V682000 recall"`  
**Playbook:** Profiles

**Why this wins:**
- Branded search for specific recalls (high intent, low competition)
- Users hear a recall announcement and search by campaign ID
- Each page is 100% unique by definition
- Natural link magnet (journalists, forums, dealers reference campaign numbers)

**Implementation:**
```
URL: /recall/20V682000
Title: NHTSA Campaign 20V682000 Recall Details | RecallRadar
H1: Campaign 20V682000: [Component] Recall
Content: Full recall detail + affected vehicles (all make/model/years) + remedy + consequence
Schema: Article or NewsArticle (with datePublished)
Internal links: Link to all affected year pages
```

**Page multiplier:** Equal to total recall count.  
**Estimated new pages:** 102 (current) → 50,000+ (full NHTSA dataset).

---

### Playbook 3: Make-Level Component Aggregation

**Pattern:** `/:makeSlug/:componentSlug-recalls`  
**Example:** `/toyota/air-bag-recalls`  
**Keyword:** `"Toyota air bag recalls"`, `"Toyota brake recall list"`  
**Playbook:** Directory + Curation

**Why this wins:**
- Broader search intent than year-specific queries
- Useful for journalists, researchers, and worried owners
- Can include aggregate stats (total affected vehicles, year range, severity breakdown)

**Implementation:**
```
URL: /toyota/air-bag-recalls
Title: Toyota Air Bag Recalls — Complete List by Model & Year | RecallRadar
H1: Toyota Air Bag Recalls & Safety Campaigns
Content: Aggregated list of all Toyota air bag recalls with model/year breakdown
Schema: ItemList or FAQPage
Internal links: Link to individual model/year pages, link to other components for same make
```

**Page multiplier:** ~5–15 components × makes.  
**Estimated new pages:** 5–15 (current) → 500–1,500 (full scale).

---

### Playbook 4: Model Reliability Scorecards

**Pattern:** `/stats/:makeSlug/:modelSlug`  
**Example:** `/stats/toyota/camry`  
**Keyword:** `"Toyota Camry reliability"`, `"Camry recall history"`, `"most recalled Camry years"`  
**Playbook:** Curation + Examples

**Why this wins:**
- Targets informational queries upstream of recall-specific searches
- Differentiates from thin directory pages with original analysis
- Highly shareable ("The 5 Most Recalled Toyota Camry Years")
- Builds topical authority beyond raw data aggregation

**Implementation:**
```
URL: /stats/toyota/camry
Title: Toyota Camry Recall Statistics & Reliability Scorecard | RecallRadar
H1: Toyota Camry Recall History & Statistics
Content:
  - Total recalls by year (chart/table)
  - Most common components
  - Most severe recalls
  - Best/worst years
  - Comparison to brand average
Schema: Dataset or Article
Internal links: Link to all model year pages, link to make stats page
```

**Page multiplier:** 1 per model.  
**Estimated new pages:** 463 (current) → 5,000+ (full scale).

---

### Playbook 5: VIN Lookup Landing Page

**Pattern:** `/vin-lookup`  
**Example:** `/vin-lookup`  
**Keyword:** `"VIN recall check"`, `"lookup recalls by VIN"`  
**Playbook:** Conversions (Tool/Utility)

**Why this wins:**
- Highest conversion intent of any recall keyword
- NHTSA supports VIN lookup via API (`https://api.nhtsa.gov/recalls/recallsByVin/...`)
- Can be a simple form that proxies to NHTSA or returns enriched results
- Builds trust and repeat visits

**Implementation:**
```
URL: /vin-lookup
Title: Free VIN Recall Check | RecallRadar
H1: Check Recalls by VIN Number
Content: Input form + explanation + sample VIN + privacy notice
Schema: WebSite + HowTo ("How to check recalls by VIN")
Internal links: Link to popular makes, link to about page
```

**Page multiplier:** 1.  
**Estimated new pages:** 1.

---

## 3. URL Architecture (Proposed)

```
/                           → Homepage (hub)
/:make                      → Make landing (directory)
/:make/:model               → Model landing (directory)
/:make/:model/:year         → Year recalls (money page — existing)
/:make/:model/:year/:comp   → Component recalls (NEW — high impact)
/recall/:campaign           → Campaign detail (NEW — medium impact)
/:make/:component-recalls   → Make component aggregation (NEW — medium impact)
/stats/:make/:model         → Model scorecard (NEW — medium impact)
/vin-lookup                 → VIN lookup tool (NEW — high intent)
/about                      → About / E-E-A-T
/sitemap.xml                → Sitemap index
```

**Rules:**
- All new pages use existing slug system (no new slug logic)
- Component slugs derived from `slugify(component.split(":")[0])`
- Campaign numbers used directly (already URL-safe: `20V682000`)

---

## 4. Content Differentiation Plan

The #1 risk in programmatic SEO is thin content penalties. Every new page type must have **genuinely unique value**:

| Page Type | Unique Value Source | Differentiation |
|-----------|--------------------|-----------------|
| Component year page | Filtered subset of recalls + component context | Not just "year page with filtered list" — add component-specific safety advice |
| Campaign page | Single-recall deep dive + cross-vehicle impact | Unique by definition (one page per campaign) |
| Make component page | Aggregation + stats + trends | Original analysis: counts, year ranges, severity breakdown |
| Model stats page | Aggregated trends + original rankings | Original analysis: best/worst years, component breakdown |
| VIN lookup | Interactive tool + enriched results | Utility value, not content value |

**Anti-thin-content rules:**
- No page with < 100 words of unique text (use aggregation, stats, or context to pad)
- Component pages include: "What to know about [component] recalls" paragraph
- Campaign pages include: affected vehicle list, timeline, remedy status
- Stats pages include: at least 3 original data points not found on other pages

---

## 5. Internal Linking Architecture

### Current State (Hub & Spoke)
```
Home → Make → Model → Year
```

### Proposed (Mesh)
```
Home → Make → Model → Year → Component
       ↓        ↓        ↓        ↓
     Stats    Stats   Related  Related
                       Years    Components

Campaign ←→ Year (bidirectional)
Campaign ←→ Component (bidirectional)
VIN Lookup ←→ Home, Popular Makes
```

**New link types to add:**
1. **Year page → Component pages**: "Browse by component: Air Bag, Brake, Engine..."
2. **Component page → Related components**: "Other 2020 Camry recalls: Brake, Engine..."
3. **Campaign page → All affected years**: "This recall affects: 2019 Camry, 2020 Camry..."
4. **Model stats page → All year pages**: "See full details for each year"
5. **Make component page → Model component pages**: "Camry air bag recalls", "Corolla air bag recalls"

---

## 6. Indexation Strategy

### Sitemap Expansion

| Sitemap | Contents | Priority |
|---------|----------|----------|
| `sitemap.xml` | Index | — |
| `sitemap-makes.xml` | Home + makes | 1.0 / 0.8 |
| `sitemap-models.xml` | Models | 0.7 |
| `sitemap-years-{n}.xml` | Year pages | 0.9 |
| `sitemap-components-{n}.xml` | Component pages | 0.8 |
| `sitemap-campaigns-{n}.xml` | Campaign pages | 0.7 |
| `sitemap-stats.xml` | Stats pages | 0.6 |

### Crawl Budget Management
- Component and campaign pages are lower priority than year pages
- Stats pages can be `weekly` changefreq (not `daily`)
- If campaign pages exceed 100k, shard similarly to year pages

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Fix make/model page H2 headings
- [ ] Fix recall card `<h3>` semantic markup
- [ ] Update `SEO_AUDIT.md` to reflect current state
- [ ] Add component links to year page template (preparation for Phase 2)

### Phase 2: Component Pages (Weeks 2–3)
- [ ] Create `/:make/:model/:year/:component` route handler
- [ ] Create component page template
- [ ] Add component link block to year page
- [ ] Add component pages to sitemap
- [ ] Add component-specific meta title/description logic

### Phase 3: Campaign Pages (Week 4)
- [ ] Create `/recall/:campaign` route handler
- [ ] Create campaign detail template
- [ ] Add campaign links to year page recall cards
- [ ] Add campaign pages to sitemap

### Phase 4: Aggregation & Stats (Weeks 5–6)
- [ ] Create `/:make/:component-recalls` route handler
- [ ] Create make-component aggregation template
- [ ] Create `/stats/:make/:model` route handler
- [ ] Create model stats template (with original analysis)
- [ ] Add aggregate queries to DB (or compute in Worker)

### Phase 5: VIN Lookup (Week 7)
- [ ] Create `/vin-lookup` route handler
- [ ] Create VIN lookup form template
- [ ] Integrate NHTSA VIN API client
- [ ] Add VIN lookup link to homepage and nav

### Phase 6: Measurement (Ongoing)
- [ ] Set up Google Search Console property
- [ ] Monitor indexation rate for new page types
- [ ] Track ranking changes for component keywords
- [ ] A/B test title tag variations on component pages

---

## 8. Pre-Launch Quality Checklist

Before indexing new page types:

- [ ] Each page provides unique value (not just filtered data)
- [ ] Title tags are stable (no dynamic ordering dependencies)
- [ ] Meta descriptions are unique per page
- [ ] Schema markup is valid (test with Google's Rich Results Test)
- [ ] Internal links connect new pages to existing architecture
- [ ] XML sitemap includes all new pages
- [ ] No orphan pages (every new page has at least one internal link)
- [ ] Mobile rendering is acceptable
- [ ] Page speed < 500ms TTFB (Workers edge should handle this)

---

## 9. Competitive Moat

**What prevents competitors from copying this?**

1. **LLM enrichment layer** — Raw NHTSA data is public, but your enriched explanations are proprietary
2. **Severity classification** — Your component-to-severity mapping is a proprietary taxonomy
3. **Scale of ingestion** — You've built a workflow pipeline (IngestionWorkflow + EnrichmentWorkflow) that competitors would need to replicate
4. **Speed** — Cloudflare Workers edge rendering is faster than most database-driven competitors

**To strengthen the moat:**
- Add original analysis to stats pages (not just aggregated data)
- Build email alert system for new recalls (user retention)
- Add user-submitted repair experience (UGC — highest defensibility)

---

## 10. Measurement & KPIs

| Metric | Baseline | 3-Month Target | 6-Month Target |
|--------|----------|----------------|----------------|
| Indexable pages | ~731 | 3,000 | 10,000+ |
| Indexed pages (GSC) | ? | 500+ | 3,000+ |
| Avg. position for `"{year} {make} {model} {component} recall"` | ? | Top 20 | Top 10 |
| Organic clicks (GSC) | ? | +200% | +500% |
| Core Web Vitals (LCP) | ? | < 2.5s | < 1.5s |

---

## Appendix: Data Model Readiness

The existing schema supports all proposed page types without migration:

| Page Type | Required Data | Table/Field | Status |
|-----------|--------------|-------------|--------|
| Component year | Component filter | `recalls.component` | ✅ Exists |
| Campaign detail | Campaign lookup | `recalls.nhtsa_campaign_number` | ✅ Exists |
| Make component | Aggregation by make + component | `recalls` + `models` + `makes` | ✅ Joinable |
| Model stats | Aggregation by model | `recalls` + `vehicle_years` | ✅ Joinable |
| VIN lookup | NHTSA VIN API | External API | ✅ Available |

**No schema changes required for Phase 1–3.**

---

*This strategy should be reviewed quarterly and updated as search performance data becomes available.*

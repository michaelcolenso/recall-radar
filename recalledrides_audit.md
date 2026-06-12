# RecalledRides.com — Comprehensive SEO Audit & Competitor Analysis

**Audit Date:** June 9, 2026
**Auditor:** SEO Technical Review
**Site:** https://recalledrides.com
**Site Type:** Vehicle Recall Lookup Tool / Automotive Safety Database

---

## Executive Summary

RecalledRides.com is a **technically sophisticated, well-architected vehicle recall lookup platform** that aggregates NHTSA data and differentiates itself through plain-English translations of complex recall notices. The site demonstrates **exceptional technical SEO implementation** — among the best practices observed in the automotive data vertical.

### Overall Health Score: 92/100 (Very Good)

| Category | Score | Grade |
|----------|-------|-------|
| Technical SEO | 95 | A |
| On-Page SEO | 93 | A |
| Performance | 97 | A+ |
| Schema/Structured Data | 96 | A |
| Content Strategy | 85 | B+ |
| Authority/Backlinks | 45 | F (New Site) |
| Competitive Position | 60 | C (Niche Challenger) |

### Top 5 Priority Issues

1. **Zero CrUX field data** — site is too new/low traffic for Google's real-user database
2. **Single render-blocking CSS file** causing Speed Index of 4.0s despite excellent LCP
3. **Cache TTL too short** on CSS (5 minutes) — should be immutable with versioned filenames
4. **No backlink profile** — competing against NHTSA.gov, CARFAX, and KBB with massive authority
5. **Limited content depth** — no educational/glossary content to capture informational queries

### Quick Wins Identified
- Extend CSS cache lifetime (versioned filenames → immutable caching)
- Add informational content ("What is a recall?", "How recall repairs work")
- Implement dealer locator integration
- Add comparison content vs raw NHTSA data

---

## 1. Technical SEO Findings

### 1.1 Crawlability & Indexation

| Element | Status | Assessment |
|---------|--------|------------|
| Robots.txt | Valid | **Excellent** — Allows all crawlers, blocks `/api/`, includes Content-Signal headers for AI crawlers (Googlebot, Bingbot, AI-Web-Crawler) |
| XML Sitemap | Valid | **Excellent** — Properly formatted with `lastmod`, `changefreq`, `priority`. Updated daily. Homepage has priority 1.0, make pages 0.8 |
| Canonical Tags | Present | **Good** — Self-referencing canonicals on all tested pages |
| HTTP Status | 200 OK | All pages return 200, no redirect chains detected |
| Orphan Pages | None detected | All pages linked through breadcrumb navigation |
| Indexation | Limited | `site:` operator shows pages indexed but low visibility expected due to new domain |

**Evidence:**
```
Sitemap: https://recalledrides.com/sitemap.xml
User-agent: *
Allow: /
Disallow: /api/
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

### 1.2 Site Architecture

**URL Structure:** Clean, logical, keyword-rich
- `/` — Homepage
- `/{make}` — Make pages (e.g., `/toyota`, `/bmw`)
- `/{make}/{model}` — Model pages (e.g., `/toyota/corolla`)
- `/{make}/{model}/{year}` — Year-specific recall pages (e.g., `/toyota/corolla/2023`)
- `/recall/{campaign}` — Individual recall detail (e.g., `/recall/25V040000`)
- `/about` — Information page

**Assessment:** The flat URL structure keeps all important pages within 3 clicks of the homepage. Breadcrumb navigation is fully implemented with Schema.org BreadcrumbList markup. No trailing slash inconsistency detected.

### 1.3 HTTP Headers & Server Configuration

| Header | Status | Assessment |
|--------|--------|------------|
| HTTP/2 | Enabled | **Excellent** |
| HSTS | `max-age=31536000; includeSubDomains; preload` | **Excellent** — Preload-ready |
| Cache-Control | `public, s-maxage=43200, stale-while-revalidate=86400` | **Good** — 12hr CDN cache with 24hr stale-while-revalidate |
| Cloudflare CDN | Active | **Excellent** — Edge caching globally |
| Link Headers | Sitemap referenced | **Excellent** — Modern best practice |

### 1.4 Mobile-Friendliness

- **Responsive Design:** Yes — No separate m. subdomain
- **Viewport:** Properly configured `width=device-width,initial-scale=1`
- **Tap Targets:** Adequate sizing observed
- **Font Loading:** `font-display: swap` via preload hints for Space Grotesk and Literata

### 1.5 Security

| Check | Status |
|-------|--------|
| HTTPS | Enforced |
| SSL Certificate | Valid |
| HSTS Preload | Eligible and configured |
| Mixed Content | None detected |
| Content-Security-Policy | Not detected (minor) |

---

## 2. On-Page SEO Findings

### 2.1 Title Tags

**Homepage:** `Vehicle Recall Search — Check Your Car Free | Recalled Rides`
- Assessment: Good keyword placement, brand at end, clear value proposition

**Make Page (Toyota):** `TOYOTA Vehicle Recalls & Safety Issues | Recalled Rides`
- Assessment: Make name front-loaded, clear intent

**Model Year Page:** `2023 TOYOTA Corolla Recalls: STEERING Issues Explained | Recalled Rides`
- Assessment: **Excellent** — Year, make, model, primary component, action verb

**Recall Detail:** `NHTSA Campaign 25V040000 Recall Details | Recalled Rides`
- Assessment: Campaign number for exact-match searches

**Verdict:** All pages have unique, descriptive titles with primary keywords near the beginning. Lengths are within optimal 50-60 character range.

### 2.2 Meta Descriptions

**Homepage:**
> "Check if your car has open safety recalls. Free, plain-English recall lookup sourced from NHTSA. Enter a make, model, or year to see safety issues and get free repairs."

**Model Year Page:**
> "Check 3 known recalls for the 2023 TOYOTA Corolla. Get plain-English explanations of steering issues and find out how to get free repairs at your local dealer."

**Verdict:** Unique per page, include specific recall counts, clear CTA, keyword-rich. Excellent implementation.

### 2.3 Heading Structure

| Page | H1 | H2s | Assessment |
|------|-----|-----|------------|
| Homepage | "Is your car under a safety recall?" | "Popular Makes", "Popular Recall Pages" | **Excellent** — Single H1, keyword-rich, logical hierarchy |
| Make Page | "TOYOTA Recalls & Safety Issues" | "TOYOTA Models With Recalls" | **Good** — Clear structure |
| Year Page | "2023 TOYOTA Corolla" | "Known Safety Recalls" (sr-only) | **Excellent** — Semantic, accessible |

**No multiple H1s detected. No heading level skips.**

### 2.4 Image Optimization

| Check | Status |
|-------|--------|
| Alt Text | Present on all images (e.g., "ACURA logo", "TOYOTA logo") |
| Lazy Loading | `loading="lazy"` on below-fold images |
| Modern Formats | SVG for logos (vector, scalable) |
| File Sizes | Minimal — SVG logos are 2-482KB (one outlier at 482KB for Buick) |

### 2.5 Internal Linking

- **Breadcrumb Navigation:** Fully implemented with Schema markup
- **Related Links:** Affected vehicle cards link back to year pages
- **Anchor Text:** Descriptive (e.g., "View full recall details →")
- **No broken links detected**

---

## 3. Schema Markup / Structured Data

**Overall Assessment: EXCEPTIONAL — Among the best implementations in any vertical**

| Page Type | Schema Types Used | Rich Result Eligibility |
|-----------|-------------------|------------------------|
| Homepage | WebSite (with SearchAction), Organization | Sitelinks Searchbox |
| Make Pages | BreadcrumbList | Breadcrumbs in SERP |
| Model Pages | BreadcrumbList | Breadcrumbs in SERP |
| Year Pages | **FAQPage, BreadcrumbList, Vehicle, HowTo** | FAQ Rich Snippets, Vehicle Info |
| Recall Pages | **FAQPage, BreadcrumbList, Article** | FAQ Rich Snippets, Article carousel |

### Year Page Schema Example (5 distinct JSON-LD blocks):

1. **FAQPage** — Each recall as Q&A ("What is the STEERING:COLUMN recall...?")
2. **BreadcrumbList** — 4-level hierarchy (Home → Toyota → Corolla → 2023)
3. **Vehicle** — Schema.org Vehicle with manufacturer, model year, description
4. **HowTo** — Steps to get recalls fixed with dealer contact info
5. **Article** (on recall detail pages) — For individual campaign pages

### Why This Matters:
The FAQPage schema is **particularly strategic** — it enables FAQ rich snippets in search results, which dramatically increase SERP real estate and CTR. The Vehicle schema helps with automotive-specific search features.

---

## 4. Performance & Core Web Vitals

### Lighthouse Scores (Mobile)

| Category | Score | Grade |
|----------|-------|-------|
| **Performance** | **97** | **A+** |
| Accessibility | 96 | A |
| Best Practices | 96 | A |
| SEO | 92 | A |

### Core Web Vitals

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| **Largest Contentful Paint (LCP)** | **1.8s** | < 2.5s | **PASS** |
| **First Contentful Paint (FCP)** | **1.5s** | < 1.8s | **PASS** |
| **Cumulative Layout Shift (CLS)** | **0** | < 0.1 | **PASS (Perfect)** |
| **Total Blocking Time (TBT)** | **0ms** | < 200ms | **PASS (Perfect)** |
| Speed Index | 4.0s | < 3.4s | Needs Improvement |

### Performance Analysis

**Strengths:**
- Zero Total Blocking Time — no JavaScript execution blocking main thread
- Zero Cumulative Layout Shift — perfect visual stability
- Excellent LCP at 1.8s (text-based LCP from logo/wordmark)
- Minimal JavaScript (no frameworks detected — vanilla JS)
- Cloudflare CDN with edge caching

**Issues:**
1. **Speed Index at 4.0s** — The primary performance bottleneck. Caused by:
   - Single render-blocking CSS file (`/styles.css?v=9` — 6.5KB, 150ms)
   - SVG logo sprites loading before content paint
   - No critical CSS inlining

2. **Short cache TTL on CSS** — 5 minutes for styles.css. Should use immutable filenames (e.g., `styles.a1b2c3.css`) with `max-age=31536000`.

3. **No preconnect hints** — Although only 1-2 external domains, preconnect to Cloudflare insights could save ~100ms.

### Recommendations (Performance)

| Priority | Action | Expected Impact |
|----------|--------|----------------|
| High | Inline critical CSS + async load full stylesheet | -1.5s Speed Index |
| Medium | Version CSS filename (immutable caching) | Better repeat-visit performance |
| Low | Preconnect to static.cloudflareinsights.com | -50-100ms TTFB on analytics |

---

## 5. Content Quality Assessment

### 5.1 E-E-A-T Signals

| Signal | Status | Evidence |
|--------|--------|----------|
| **Experience** | Strong | Data sourced directly from NHTSA, weekly refresh cycle |
| **Expertise** | Strong | "Plain English" translations of technical NHTSA language; severity classifications |
| **Authoritativeness** | Weak | New domain, no established brand recognition, minimal backlinks |
| **Trustworthiness** | Good | Clear disclaimers ("Not affiliated with NHTSA"), transparent data methodology, links to official sources |

### 5.2 Content Differentiation (Unique Value Proposition)

RecalledRides.com's **primary differentiator** is the "Plain English" translation layer:

| Element | RecalledRides | NHTSA.gov | CARFAX |
|---------|--------------|-----------|--------|
| Data Source | NHTSA API | Primary source | NHTSA + manufacturer data |
| Language | Plain English | Technical/regulatory | Mixed |
| Severity Labels | Critical/High/Medium/Low | None | None |
| Free Fix Info | Prominent, with phone numbers | Present | Present |
| VIN Lookup | No (make/model/year only) | Yes | Yes |

### 5.3 Content Gaps

**Missing content types that competitors rank for:**

1. **No educational/glossary content**
   - "What is a vehicle recall?"
   - "How do recall repairs work?"
   - "What to do if your car is recalled"
   - Missing: FAQ page (ironically, despite FAQ schema being present)

2. **No VIN-based lookup** — All major competitors (NHTSA, CARFAX, CheckToProtect) offer VIN search. This is a significant feature gap.

3. **No recall statistics or studies** — iSeeCars publishes recall studies that earn significant backlinks and media coverage

4. **No tire/car seat/equipment recalls** — NHTSA covers these; RecalledRides only does vehicles

5. **No blog/content hub** — No mechanism to publish recall news, safety alerts, or educational content

---

## 6. Competitor Analysis

### 6.1 Competitive Landscape

| Competitor | Domain Authority | Traffic Est. | Key Strength | Key Weakness |
|------------|-----------------|------------|--------------|--------------|
| **NHTSA.gov/recalls** | 95+ | 500K+/mo | Official source, government authority, VIN lookup | Poor UX, technical language, no plain English |
| **CARFAX.com/recall** | 85+ | 200K+/mo | Brand recognition, 10B+ checks, state DMV partnerships, VIN+plate lookup | Less detailed per-recall info |
| **KBB.com/recall** | 82+ | 100K+/mo | Major automotive publisher trust, integrated with car values | Generic recall content |
| **CheckToProtect.org** | 60+ | 50K+/mo | NSC backing, CARFAX-powered, Spanish language support, media coverage | Limited organic search optimization |
| **GoodCar.com** | 45+ | 20K+/mo | Integrated with vehicle history reports | Low brand recognition |
| **iSeeCars.com** | 70+ | 300K+/mo | Data journalism, recall studies, media backlinks | Not a primary recall tool |

### 6.2 Keyword Positioning Analysis

| Keyword | NHTSA | CARFAX | KBB | RecalledRides | Difficulty |
|---------|-------|--------|-----|---------------|------------|
| "check recall by VIN" | #1 | #2 | — | Not targeting | Very Hard |
| "car recall check" | #1 | #2 | #5 | Not ranking | Hard |
| "{make} {model} recalls" | — | #2-3 | — | **Opportunity** | Medium |
| "{year} {make} {model} recall" | #3 | #2 | — | **Opportunity** | Medium |
| "NHTSA campaign {ID}" | #1 | — | — | **Can compete** | Low-Medium |
| "what does {component} recall mean" | — | — | — | **Untapped** | Low |
| "is my {make} {model} under recall" | — | — | — | **Untapped** | Low |

### 6.3 Competitor SEO Tactics to Emulate

**From CARFAX:**
- VIN lookup capability (critical feature gap)
- Spanish language support (En Español)
- Mobile app integration
- State DMV partnership positioning

**From NHTSA:**
- Tire, car seat, and equipment recall coverage
- Official campaign number targeting
- Complaint filing integration

**From iSeeCars:**
- Data journalism ("Most/Least Recalled Cars" studies)
- Press-worthy content that earns backlinks
- Annual recall reports

**From CheckToProtect:**
- Non-profit/government partnership positioning
- Public safety messaging
- Multi-channel awareness campaigns

---

## 7. SWOT Analysis

### Strengths
- Exceptional technical SEO implementation
- Excellent Core Web Vitals (97 Performance score)
- Comprehensive schema markup (6+ types)
- Plain English translations (true differentiation)
- Clean, fast, accessible UI
- Dynamic OG images per page
- Modern web standards (HTTP/2, HSTS preload, speculation rules)

### Weaknesses
- New domain with no backlink profile
- No VIN lookup (table stakes in this vertical)
- Limited content depth (no blog, no educational content)
- Low brand recognition
- No CrUX field data (too new/low traffic)
- No multi-language support

### Opportunities
- Long-tail keyword dominance: "{year} {make} {model} {component} recall"
- FAQ rich snippets (schema already implemented)
- Educational content hub ("What is a recall?" etc.)
- Data journalism (recall statistics, annual reports)
- VIN lookup feature (closes critical gap)
- Spanish-language version
- Dealer locator API integration
- Mobile app

### Threats
- NHTSA improving their own UX (they've added license plate lookup recently)
- CARFAX's massive brand + distribution through DMVs
- Google's AI Overviews answering recall questions directly
- New entrants with VC funding
- NHTSA API changes or rate limiting

---

## 8. Prioritized Action Plan

### Phase 1: Critical Fixes (Week 1-2)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Add VIN lookup feature** | High — Closes critical feature gap vs all competitors | High |
| 2 | **Version CSS filenames for immutable caching** | Medium — Improves repeat-visit performance | Low |
| 3 | **Submit to Google Search Console** if not already | High — Essential for monitoring indexation | Low |

### Phase 2: High-Impact Improvements (Week 3-6)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 4 | **Add educational content hub** — "What is a recall?", "How recall repairs work", "Recall FAQs" | High — Captures informational queries, builds topical authority | Medium |
| 5 | **Create comparison pages** — "RecalledRides vs NHTSA" explaining the plain-English value | Medium — Differentiation + conversion | Low |
| 6 | **Add tire/car seat/equipment recall coverage** | Medium — Expands addressable market | High |
| 7 | **Implement dealer locator** (link to manufacturer dealer finders) | Medium — User value + retention | Low |

### Phase 3: Content & Authority Building (Month 2-3)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 8 | **Publish data journalism** — "Most Recalled Cars of 2026", "Least Reliable Brands by Recall Count" | High — Backlink magnet, media coverage | Medium |
| 9 | **Create annual recall report** | High — Evergreen content, annual refresh | Medium |
| 10 | **Outreach to automotive bloggers/safety organizations** | High — Build initial backlink profile | Medium |
| 11 | **Add Spanish language support** | Medium — 13% of US market | Medium |

### Phase 4: Long-term Strategic (Month 3-6)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 12 | **Mobile app** (iOS/Android) with push notifications for new recalls | High — Retention, recurring traffic | High |
| 13 | **API/API access for partners** | Medium — B2B revenue + backlinks | High |
| 14 | **User accounts + vehicle tracking** (notify me of new recalls) | High — Engagement, retention | High |
| 15 | **Expand beyond US (Canada, UK recalls)** | Medium — Market expansion | High |

---

## 9. Key Metrics to Track

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Indexed Pages | ~100+ (estimated) | 5,000+ (all make/model/year combinations) |
| Organic Traffic | Minimal | 10,000+ monthly sessions |
| Average Position | >50 (not ranking) | Top 20 for 50+ long-tail keywords |
| Backlinks | 0-5 | 50+ quality backlinks |
| Domain Authority | ~1-5 | 15-20 |
| Core Web Vitals (LCP) | 1.8s | Maintain <2.0s |
| Core Web Vitals (CLS) | 0 | Maintain 0 |

---

## 10. Conclusion

RecalledRides.com is a **technically excellent website** with a clear, differentiated value proposition (plain-English recall translations). The technical SEO implementation is among the best in class — comprehensive schema markup, perfect Core Web Vitals, clean architecture, and modern web standards throughout.

The primary challenges are **domain authority and feature completeness**. Competing against NHTSA.gov and CARFAX requires either significant backlink acquisition (difficult, expensive) or strategic differentiation through content depth and user experience (achievable).

**The most impactful near-term actions are:**
1. Adding VIN lookup (table stakes)
2. Building educational content (captures informational queries)
3. Publishing data journalism (earns backlinks organically)
4. Improving CSS caching (quick performance win)

With these improvements, RecalledRides.com has a strong path to capturing significant organic traffic in the long-tail vehicle recall search space within 6-12 months.

---

*End of Audit Report*

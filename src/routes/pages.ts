import { Hono } from "hono";
import type { Context } from "hono";
import { getCachedOrRender } from "../lib/cache";
import { escapeHtml, slugify, titleCase } from "../lib/utils";
import { layout } from "../templates/layout";
import { homeTemplate } from "../templates/home";
import { makePageTemplate } from "../templates/make-page";
import { modelPageTemplate } from "../templates/model-page";
import { yearPageTemplate } from "../templates/year-page";
import { recallCard } from "../templates/components/recall-card";
import { dealerLeadGen } from "../templates/components/dealer-lead-gen";
import { breadcrumbs } from "../templates/components/breadcrumbs";
import {
  faqPageJsonLd,
  breadcrumbListJsonLd,
  websiteJsonLd,
  organizationJsonLd,
  vehicleJsonLd,
  itemListJsonLd,
  articleJsonLd,
  howToJsonLd,
} from "../templates/components/json-ld";
import { campaignPageTemplate } from "../templates/campaign-page";
import type { SeverityLevel } from "../db/schema";
import { aboutTemplate } from "../templates/about";
import { componentPageTemplate } from "../templates/component-page";
import { makeComponentPageTemplate } from "../templates/make-component-page";
import { modelStatsPageTemplate } from "../templates/model-stats-page";
import { vinLookupPageTemplate } from "../templates/vin-lookup-page";
import { relatedLinks } from "../templates/components/related-links";
import { gradeDescription } from "../lib/risk-score";
import { POPULAR_MAKES } from "../lib/constants";
import { acceptsMarkdown, htmlToMarkdown } from "../lib/utils";

export const pageRoutes = new Hono<{ Bindings: Env }>();

const CACHE_CONTROL = "public, s-maxage=43200, stale-while-revalidate=86400";
const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };
const PAGE_CACHE_VERSION = "v9";

function linkHeaders(siteUrl: string): Record<string, string> {
  return {
    link:
      `<${siteUrl}/.well-known/api-catalog>; rel="api-catalog", ` +
      `<${siteUrl}/.well-known/oauth-authorization-server>; rel="oauth-authorization-server", ` +
      `<${siteUrl}/.well-known/oauth-protected-resource>; rel="oauth-protected-resource", ` +
      `<${siteUrl}/.well-known/mcp/server-card.json>; rel="mcp-server-card", ` +
      `<${siteUrl}/.well-known/agent-skills/index.json>; rel="agent-skills", ` +
      `<${siteUrl}/auth.md>; rel="auth-md", ` +
      `<${siteUrl}/sitemap.xml>; rel="sitemap"`,
  };
}

function maybeMarkdown(c: Context, html: string, status: 200 | 404 = 200): Response {
  if (acceptsMarkdown(c)) {
    const markdown = htmlToMarkdown(html);
    return c.body(markdown, status, {
      "content-type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(markdown.split(/\s+/).length),
    });
  }
  return c.body(html, status, HTML_HEADERS);
}

interface CachedPageResponse {
  html: string;
  status: 200 | 404;
}

// GET /og/:makeSlug/:modelSlug/:year.svg — Dynamic OG image
pageRoutes.get("/og/:makeSlug{[a-z0-9-]+}/:modelSlug{[a-z0-9-]+}/:year{[0-9]+}.svg", async (c) => {
  const { makeSlug, modelSlug, year } = c.req.param();
  const yearNum = Number(year);

  const make = await c.env.DB.prepare("SELECT name FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ name: string }>();
  const model = await c.env.DB.prepare("SELECT name FROM models WHERE slug = ?")
    .bind(modelSlug).first<{ name: string }>();

  if (!make || !model || !yearNum || yearNum < 1900 || yearNum > 2100) {
    return c.notFound();
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0c"/>
  <rect x="60" y="60" width="1080" height="510" fill="none" stroke="#27272a" stroke-width="2"/>
  <rect x="100" y="100" width="60" height="60" fill="#f97316"/>
  <text x="130" y="145" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle">!</text>
  <text x="180" y="148" font-family="system-ui, sans-serif" font-size="48" font-weight="700" fill="#fafafa">Recalled Rides</text>
  <text x="100" y="280" font-family="system-ui, sans-serif" font-size="64" font-weight="700" fill="#fafafa">${year} ${escapeHtml(make.name)} ${escapeHtml(model.name)}</text>
  <text x="100" y="360" font-family="system-ui, sans-serif" font-size="32" fill="#a1a1aa">Check safety recalls and get free repairs.</text>
  <rect x="100" y="420" width="200" height="4" fill="#f97316"/>
  <text x="100" y="500" font-family="system-ui, sans-serif" font-size="22" fill="#71717a">Data sourced from NHTSA · RecalledRides.com</text>
</svg>`;

  return c.body(svg, 200, {
    "content-type": "image/svg+xml",
    "cache-control": "public, max-age=86400, s-maxage=43200, stale-while-revalidate=86400",
  });
});

// GET /search — Redirect search queries to browse or search results
pageRoutes.get("/search", (c) => {
  const q = (c.req.query("q") || "").trim();
  if (!q) return c.redirect("/", 302);
  // Redirect to the homepage with the search query — the JS typeahead will handle it
  return c.redirect(`/?q=${encodeURIComponent(q)}`, 302);
});

// GET / — Homepage
pageRoutes.get("/", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const { value: html, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withPageCacheVersion("page:home"),
    86400,
    async () => {
      const lastUpdatedResult = await c.env.DB.prepare(
        "SELECT MAX(completed_at) as last_run FROM ingestion_logs WHERE status = 'completed'",
      ).first<{ last_run: string | null }>();

      const [makesResult, statsResult, popularModelsResult] = await Promise.all([
        c.env.DB.prepare(
          `SELECT m.name, m.slug, COUNT(DISTINCT md.id) as model_count, COUNT(r.id) as recall_count
         FROM makes m
         LEFT JOIN models md ON md.make_id = m.id
         LEFT JOIN vehicle_years vy ON vy.model_id = md.id
         LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
         GROUP BY m.id
         ORDER BY m.name`,
        ).all<{ name: string; slug: string; model_count: number; recall_count: number }>(),

        Promise.all([
          c.env.DB.prepare("SELECT COUNT(*) as count FROM recalls").first<{ count: number }>(),
          c.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years").first<{ count: number }>(),
          c.env.DB.prepare("SELECT COUNT(*) as count FROM makes").first<{ count: number }>(),
        ]),

        c.env.DB.prepare(
          `SELECT mk.name as make_name,
                mk.slug as make_slug,
                m.name as model_name,
                m.slug as model_slug,
                COUNT(DISTINCT vy.id) as year_count,
                COUNT(r.id) as recall_count
         FROM models m
         JOIN makes mk ON mk.id = m.make_id
         JOIN vehicle_years vy ON vy.model_id = m.id
         JOIN recalls r ON r.vehicle_year_id = vy.id
         GROUP BY m.id, mk.name, mk.slug, m.name, m.slug
         ORDER BY recall_count DESC, year_count DESC, mk.name, m.name
         LIMIT 12`,
        ).all<{
          make_name: string;
          make_slug: string;
          model_name: string;
          model_slug: string;
          year_count: number;
          recall_count: number;
        }>(),
      ]);
      const [recallCount, yearCount, makeCount] = statsResult;

      // Latest recalls for "trending" section
      const latestRecallsResult = await c.env.DB.prepare(
        `SELECT r.nhtsa_campaign_number, r.component, r.severity_level,
                r.report_received_date,
                mk.name as make_name, mk.slug as make_slug,
                m.name as model_name, m.slug as model_slug,
                vy.year
         FROM recalls r
         JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
         JOIN models m ON m.id = vy.model_id
         JOIN makes mk ON mk.id = m.make_id
         ORDER BY r.report_received_date DESC
         LIMIT 6`,
      ).all<{
        nhtsa_campaign_number: string;
        component: string;
        severity_level: SeverityLevel;
        report_received_date: string | null;
        make_name: string;
        make_slug: string;
        model_name: string;
        model_slug: string;
        year: number;
      }>();

      const popularNames = new Set(POPULAR_MAKES.map((n) => n.toUpperCase()));
      const popularMakes = makesResult.results
        .filter((m) => popularNames.has(m.name.toUpperCase()))
        .slice(0, 6);

      const jsonLd =
        websiteJsonLd(
          siteUrl,
          "Recalled Rides",
          "Search and understand vehicle recalls in plain English. Check if your car has open safety recalls.",
        ) + organizationJsonLd({ name: "Recalled Rides", url: siteUrl });

      return layout({
        googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
        analyticsToken: c.env.CF_ANALYTICS_TOKEN,
        title: "Vehicle Recall Search — Check Your Car Free | Recalled Rides",
        description:
          "Check if your car has open safety recalls. Free, plain-English recall lookup sourced from NHTSA. Enter a make, model, or year to see safety issues and get free repairs.",
        canonical: siteUrl,
        ogType: "website",
        ogImage: "/og-image-home.svg",
        lastUpdated: lastUpdatedResult?.last_run ? new Date(lastUpdatedResult.last_run).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : undefined,
        body: homeTemplate(makesResult.results, {
          recalls: recallCount?.count ?? 0,
          vehicles: yearCount?.count ?? 0,
          makes: makeCount?.count ?? 0,
        }, popularMakes, popularModelsResult.results, latestRecallsResult.results),
        jsonLd,
      });
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, html);
});

// GET /about — About page
pageRoutes.get("/about", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const { value: html, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withPageCacheVersion("page:about"),
    86400,
    async () => {
      return layout({
        googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
        analyticsToken: c.env.CF_ANALYTICS_TOKEN,
        title: "About Recalled Rides",
        description:
          "Learn how Recalled Rides sources vehicle recall data from NHTSA and simplifies it into plain English for drivers.",
        canonical: `${siteUrl}/about`,
        ogType: "website",
        ogImage: "/og-image-home.svg",
        body: aboutTemplate(siteUrl),
        jsonLd:
          organizationJsonLd({ name: "Recalled Rides", url: siteUrl }) +
          `<script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "About Recalled Rides",
            url: `${siteUrl}/about`,
            description: "Learn how Recalled Rides sources vehicle recall data from NHTSA and simplifies it into plain English for drivers.",
          })}</script>`,
      });
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, html);
});

// GET /vin-lookup — VIN Lookup landing page
pageRoutes.get("/vin-lookup", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const { value: html, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withPageCacheVersion("page:vin-lookup"),
    86400,
    async () => {
      return layout({
        googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
        analyticsToken: c.env.CF_ANALYTICS_TOKEN,
        title: "Free VIN Recall Check | Recalled Rides",
        description:
          "Enter your Vehicle Identification Number (VIN) to check for open safety recalls. Free, instant lookup sourced directly from NHTSA.",
        canonical: `${siteUrl}/vin-lookup`,
        ogType: "website",
        ogImage: "/og-image-home.svg",
        body: vinLookupPageTemplate(siteUrl),
        jsonLd:
          breadcrumbListJsonLd(siteUrl, [
            { name: "Home", item: siteUrl },
            { name: "VIN Lookup", item: `${siteUrl}/vin-lookup` },
          ]) +
          organizationJsonLd({ name: "Recalled Rides", url: siteUrl }),
      });
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, html);
});

// GET /stats/:makeSlug/:modelSlug — Model reliability scorecard
pageRoutes.get("/stats/:makeSlug{[a-z0-9-]+}/:modelSlug{[a-z0-9-]+}", async (c) => {
  const { makeSlug, modelSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:stats:${makeSlug}:${modelSlug}`),
    86400,
    async () => {
      const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
        .bind(makeSlug)
        .first<{ id: number; name: string }>();
      if (!make) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that vehicle manufacturer. It may not be in our database yet.", siteUrl),
          }),
          status: 404,
        };
      }

      const model = await c.env.DB.prepare("SELECT id, name, slug FROM models WHERE make_id = ? AND slug = ?")
        .bind(make.id, modelSlug)
        .first<{ id: number; name: string; slug: string }>();
      if (!model) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that model. It may not be in our database yet or might be listed under a different name.", siteUrl),
          }),
          status: 404,
        };
      }

      const yearStatsResult = await c.env.DB.prepare(
        `SELECT vy.year,
              COUNT(r.id) as recall_count,
              vy.risk_grade,
              COUNT(CASE WHEN r.severity_level = 'CRITICAL' THEN 1 END) as critical_count,
              COUNT(CASE WHEN r.severity_level = 'HIGH' THEN 1 END) as high_count
       FROM vehicle_years vy
       LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = ?
       GROUP BY vy.year, vy.risk_grade
       ORDER BY vy.year DESC`
      )
        .bind(model.id)
        .all<{ year: number; recall_count: number; risk_grade: string | null; critical_count: number; high_count: number }>();

      const yearStats = yearStatsResult.results;

      const componentStatsResult = await c.env.DB.prepare(
        `SELECT TRIM(CASE WHEN INSTR(r.component, ':') > 0 THEN SUBSTR(r.component, 1, INSTR(r.component, ':') - 1) ELSE r.component END) as name,
              COUNT(*) as count
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       WHERE vy.model_id = ?
       GROUP BY name
       ORDER BY count DESC
       LIMIT 10`
      )
        .bind(model.id)
        .all<{ name: string; count: number }>();

      const mostSevereResult = await c.env.DB.prepare(
        `SELECT vy.year, r.nhtsa_campaign_number, r.component, r.severity_level,
              COALESCE(r.summary_enriched, r.summary_raw) as summary
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       WHERE vy.model_id = ? AND r.severity_level IN ('CRITICAL', 'HIGH')
       ORDER BY vy.year DESC
       LIMIT 5`
      )
        .bind(model.id)
        .all<{ year: number; nhtsa_campaign_number: string; component: string; severity_level: SeverityLevel; summary: string }>();

      const brandAvgResult = await c.env.DB.prepare(
        `SELECT AVG(recall_count) as avg FROM (
          SELECT COUNT(r.id) as recall_count
          FROM vehicle_years vy
          LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
          JOIN models m ON m.id = vy.model_id
          WHERE m.make_id = ?
          GROUP BY vy.id
        )`
      )
        .bind(make.id)
        .first<{ avg: number | null }>();

      const totalRecalls = yearStats.reduce((sum, y) => sum + y.recall_count, 0);
      const brandAvgRecalls = brandAvgResult?.avg ?? 0;

      const sortedByRecalls = [...yearStats].sort((a, b) => a.recall_count - b.recall_count);
      const bestYears = sortedByRecalls.slice(0, 3).filter((y) => y.recall_count > 0);
      const worstYears = [...sortedByRecalls].reverse().slice(0, 3);

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${makeSlug}`, label: make.name },
        { href: `/${makeSlug}/${modelSlug}`, label: model.name },
        { href: `/stats/${makeSlug}/${modelSlug}`, label: "Statistics" },
      ]);

      const body =
        crumbs +
        modelStatsPageTemplate({
          make: make.name,
          makeSlug,
          model: model.name,
          modelSlug,
          yearStats,
          componentStats: componentStatsResult.results,
          mostSevereRecalls: mostSevereResult.results,
          bestYears,
          worstYears,
          brandAvgRecalls,
          totalRecalls,
        });

      const statsUrl = `${siteUrl}/stats/${makeSlug}/${modelSlug}`;

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title: `${make.name} ${model.name} Recall Statistics & Reliability Scorecard | Recalled Rides`,
          description: `Original analysis: ${totalRecalls} total recalls across ${yearStats.length} years. Best and worst years, common components, and risk grades for the ${make.name} ${model.name}.`,
          canonical: statsUrl,
          ogType: "website",
          ogImage: "/og-image-home.svg",
          body,
          jsonLd:
            breadcrumbListJsonLd(siteUrl, [
              { name: "Home", item: siteUrl },
              { name: make.name, item: `${siteUrl}/${makeSlug}` },
              { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
              { name: "Statistics", item: statsUrl },
            ]) +
            organizationJsonLd({ name: "Recalled Rides", url: siteUrl }),
        }),
        status: 200,
      };
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, value.html, value.status);
});

// GET /:makeSlug/:componentSlug-recalls — Make-level component aggregation
pageRoutes.get("/:makeSlug{[a-z0-9-]+}/:componentSlug{[a-z0-9-]+}-recalls", async (c) => {
  const { makeSlug, componentSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:make-component:${makeSlug}:${componentSlug}`),
    86400,
    async () => {
      const make = await c.env.DB.prepare("SELECT id, name, slug FROM makes WHERE slug = ?")
        .bind(makeSlug)
        .first<{ id: number; name: string; slug: string }>();
      if (!make) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that vehicle manufacturer. It may not be in our database yet.", siteUrl),
          }),
          status: 404,
        };
      }

      const recallsResult = await c.env.DB.prepare(
        `SELECT m.name as model_name, m.slug as model_slug, vy.year,
              r.nhtsa_campaign_number, r.component, r.severity_level,
              COALESCE(r.summary_enriched, r.summary_raw) as summary,
              r.report_received_date
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       JOIN models m ON m.id = vy.model_id
       WHERE m.make_id = ?
       ORDER BY r.report_received_date DESC`
      )
        .bind(make.id)
        .all<{
          model_name: string;
          model_slug: string;
          year: number;
          nhtsa_campaign_number: string;
          component: string;
          severity_level: SeverityLevel;
          summary: string;
          report_received_date: string | null;
        }>();

      // Filter by component slug
      const filteredRecalls = recallsResult.results.filter((r) => {
        const primary = r.component.split(":")[0].trim();
        return slugify(primary) === componentSlug;
      });

      if (filteredRecalls.length === 0) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "No recalls match this component for this manufacturer. Try browsing by model instead. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("No recalls match this component for this manufacturer. Try browsing by model instead.", siteUrl),
          }),
          status: 404,
        };
      }

      const componentName = filteredRecalls[0].component.split(":")[0].trim();

      const severityBreakdown: Record<SeverityLevel, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0,
      };
      for (const r of filteredRecalls) {
        severityBreakdown[r.severity_level]++;
      }

      const modelYearSet = new Set<string>();
      const years: number[] = [];
      for (const r of filteredRecalls) {
        const key = `${r.model_slug}-${r.year}`;
        if (!modelYearSet.has(key)) {
          modelYearSet.add(key);
          years.push(r.year);
        }
      }
      const totalModelYears = modelYearSet.size;
      const yearRange = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : "—";

      // Other components for this make
      const otherComponentsResult = await c.env.DB.prepare(
        `SELECT TRIM(CASE WHEN INSTR(r.component, ':') > 0 THEN SUBSTR(r.component, 1, INSTR(r.component, ':') - 1) ELSE r.component END) as name,
              COUNT(*) as count
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       JOIN models m ON m.id = vy.model_id
       WHERE m.make_id = ?
       GROUP BY name
       ORDER BY count DESC`
      )
        .bind(make.id)
        .all<{ name: string; count: number }>();

      const otherComponents = otherComponentsResult.results
        .filter((c) => slugify(c.name) !== componentSlug)
        .map((c) => ({ name: c.name, slug: slugify(c.name), count: c.count }));

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${makeSlug}`, label: make.name },
        { href: `/${makeSlug}/${componentSlug}-recalls`, label: `${componentName} Recalls` },
      ]);

      const body =
        crumbs +
        makeComponentPageTemplate({
          make: make.name,
          makeSlug,
          component: componentName,
          componentSlug,
          recalls: filteredRecalls,
          totalModelYears,
          yearRange,
          severityBreakdown,
          otherComponents,
        });

      const pageUrl = `${siteUrl}/${makeSlug}/${componentSlug}-recalls`;

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title: `${make.name} ${titleCase(componentName)} Recalls — Complete List by Model & Year | Recalled Rides`,
          description: `Complete list of ${filteredRecalls.length} ${componentName} recalls for ${make.name} vehicles. Covers ${totalModelYears} model-years from ${yearRange}.`,
          canonical: pageUrl,
          ogType: "website",
          ogImage: "/og-image-home.svg",
          body,
          jsonLd:
            breadcrumbListJsonLd(siteUrl, [
              { name: "Home", item: siteUrl },
              { name: make.name, item: `${siteUrl}/${makeSlug}` },
              { name: `${componentName} Recalls`, item: pageUrl },
            ]) +
            organizationJsonLd({ name: "Recalled Rides", url: siteUrl }),
        }),
        status: 200,
      };
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, value.html, value.status);
});

// GET /:makeSlug — Make landing page
pageRoutes.get("/:makeSlug{[a-z0-9-]+}", async (c) => {
  const { makeSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:make:${makeSlug}`),
    86400,
    async () => {
      const make = await c.env.DB.prepare("SELECT id, name, slug FROM makes WHERE slug = ?")
        .bind(makeSlug)
        .first<{ id: number; name: string; slug: string }>();
      if (!make) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that vehicle manufacturer. It may not be in our database yet.", siteUrl),
          }),
          status: 404,
        };
      }

      const models = await c.env.DB.prepare(
        `SELECT m.name, m.slug,
              MIN(vy.year) as min_year, MAX(vy.year) as max_year,
              COUNT(DISTINCT r.id) as recall_count
       FROM models m
       LEFT JOIN vehicle_years vy ON vy.model_id = m.id
       LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE m.make_id = ?
       GROUP BY m.id
       ORDER BY m.name`,
      )
        .bind(make.id)
        .all<{ name: string; slug: string; min_year: number | null; max_year: number | null; recall_count: number }>();

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${makeSlug}`, label: make.name },
      ]);
      const body = crumbs + makePageTemplate(make.name, make.slug, models.results);

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title: `${make.name} Vehicle Recalls & Safety Issues | Recalled Rides`,
          description: `Browse all ${make.name} vehicle recalls and safety issues. Find recalls for your ${make.name} by model and year.`,
          canonical: `${siteUrl}/${makeSlug}`,
          ogType: "website",
          ogImage: "/og-image-home.svg",
          body,
          jsonLd:
            breadcrumbListJsonLd(siteUrl, [
              { name: "Home", item: siteUrl },
              { name: make.name, item: `${siteUrl}/${makeSlug}` },
            ]) +
            itemListJsonLd(
              `${make.name} Models`,
              models.results.map((m) => ({
                name: m.name,
                url: `${siteUrl}/${makeSlug}/${m.slug}`,
                description:
                  m.recall_count > 0 ? `${m.recall_count} recall${m.recall_count !== 1 ? "s" : ""}` : undefined,
              })),
              `${siteUrl}/${makeSlug}`,
            ),
        }),
        status: 200,
      };
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, value.html, value.status);
});

// GET /:makeSlug/:modelSlug — Model landing page
pageRoutes.get("/:makeSlug{[a-z0-9-]+}/:modelSlug{[a-z0-9-]+}", async (c) => {
  const { makeSlug, modelSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:model:${makeSlug}:${modelSlug}`),
    86400,
    async () => {
      const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
        .bind(makeSlug)
        .first<{ id: number; name: string }>();
      if (!make) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that vehicle manufacturer. It may not be in our database yet.", siteUrl),
          }),
          status: 404,
        };
      }

      const model = await c.env.DB.prepare("SELECT id, name, slug FROM models WHERE make_id = ? AND slug = ?")
        .bind(make.id, modelSlug)
        .first<{ id: number; name: string; slug: string }>();
      if (!model) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that model. It may not be in our database yet or might be listed under a different name.", siteUrl),
          }),
          status: 404,
        };
      }

      const years = await c.env.DB.prepare(
        `SELECT vy.year,
              COUNT(r.id) as recall_count,
              vy.risk_grade,
              vy.risk_score,
              CASE MIN(CASE r.severity_level
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                WHEN 'LOW' THEN 4
                ELSE 5
              END)
                WHEN 1 THEN 'CRITICAL'
                WHEN 2 THEN 'HIGH'
                WHEN 3 THEN 'MEDIUM'
                WHEN 4 THEN 'LOW'
                ELSE NULL
              END as highest_severity
       FROM vehicle_years vy
       LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = ?
       GROUP BY vy.year, vy.risk_grade, vy.risk_score
       ORDER BY vy.year DESC`,
      )
        .bind(model.id)
        .all<{ year: number; recall_count: number; risk_grade: string | null; risk_score: number | null; highest_severity: SeverityLevel | null }>();

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${makeSlug}`, label: make.name },
        { href: `/${makeSlug}/${modelSlug}`, label: model.name },
      ]);
      const body = crumbs + modelPageTemplate(make.name, makeSlug, model.name, modelSlug, years.results);

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title: `${make.name} ${model.name} Recalls by Year | Recalled Rides`,
          description: `Check ${make.name} ${model.name} recalls by model year. Find safety issues and get free repairs for your vehicle.`,
          noIndex: years.results.length === 0,
          canonical: `${siteUrl}/${makeSlug}/${modelSlug}`,
          ogType: "website",
          ogImage: "/og-image-home.svg",
          body,
          jsonLd:
            breadcrumbListJsonLd(siteUrl, [
              { name: "Home", item: siteUrl },
              { name: make.name, item: `${siteUrl}/${makeSlug}` },
              { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
            ]) +
            itemListJsonLd(
              `${make.name} ${model.name} Recall History`,
              years.results.map((y) => ({
                name: String(y.year),
                url: `${siteUrl}/${makeSlug}/${modelSlug}/${y.year}`,
                description:
                  y.recall_count > 0 ? `${y.recall_count} recall${y.recall_count !== 1 ? "s" : ""}` : undefined,
              })),
              `${siteUrl}/${makeSlug}/${modelSlug}`,
            ),
        }),
        status: 200,
      };
    },
  );
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, value.html, value.status);
});

// GET /:makeSlug/:modelSlug/:year/:componentSlug — Component-specific recalls
pageRoutes.get("/:makeSlug/:modelSlug/:year/:componentSlug", async (c) => {
  const { makeSlug, modelSlug, year, componentSlug } = c.req.param();
  const yearNum = Number(year);
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  if (!yearNum || yearNum < 1900 || yearNum > 2100) {
    c.header("X-Robots-Tag", "noindex, nofollow");
    return c.html(
      layout({
        googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
        analyticsToken: c.env.CF_ANALYTICS_TOKEN,
        title: "Page Not Found | Recalled Rides",
        description: "This vehicle year could not be found. Browse all makes on Recalled Rides.",
        noIndex: true,
        body: notFoundBody("Please check the year and try again. We cover most vehicles from 1950 to present.", siteUrl),
      }),
      404,
    );
  }

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:component:${makeSlug}:${modelSlug}:${year}:${componentSlug}`),
    43200,
    async () => {
      const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
        .bind(makeSlug)
        .first<{ id: number; name: string }>();
      if (!make) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that vehicle manufacturer. It may not be in our database yet.", siteUrl),
          }),
          status: 404,
        };
      }

      const model = await c.env.DB.prepare("SELECT id, name FROM models WHERE make_id = ? AND slug = ?")
        .bind(make.id, modelSlug)
        .first<{ id: number; name: string }>();
      if (!model) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that model. It may not be in our database yet or might be listed under a different name.", siteUrl),
          }),
          status: 404,
        };
      }

      const recallsResult = await c.env.DB.prepare(
        `SELECT r.id, r.nhtsa_campaign_number, r.component, r.manufacturer,
              r.summary_raw, r.consequence_raw, r.remedy_raw,
              r.summary_enriched, r.consequence_enriched, r.remedy_enriched,
              r.severity_level, r.report_received_date, r.enriched_at
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       JOIN models m ON m.id = vy.model_id
       WHERE m.make_id = ? AND m.slug = ? AND vy.year = ?
       ORDER BY
         CASE r.severity_level
           WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5
         END ASC,
         r.report_received_date DESC`,
      )
        .bind(make.id, modelSlug, yearNum)
        .all<{
          id: number;
          nhtsa_campaign_number: string;
          component: string;
          manufacturer: string | null;
          summary_raw: string;
          consequence_raw: string;
          remedy_raw: string;
          summary_enriched: string | null;
          consequence_enriched: string | null;
          remedy_enriched: string | null;
          severity_level: SeverityLevel;
          report_received_date: string | null;
          enriched_at: string | null;
        }>();

      // Filter recalls by component slug
      const allRecalls = recallsResult.results;
      const filteredRecalls = allRecalls.filter((r) => {
        const primary = r.component.split(":")[0].trim();
        return slugify(primary) === componentSlug;
      });

      if (filteredRecalls.length === 0) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "No recalls match this component for this manufacturer. Try browsing by model instead. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("No recalls match this component for this vehicle year. Try viewing all recalls for this year instead.", siteUrl),
          }),
          status: 404,
        };
      }

      const componentName = filteredRecalls[0].component.split(":")[0].trim();
      const topSeverity = filteredRecalls[0]?.severity_level ?? "UNKNOWN";

      const title = `${year} ${make.name} ${model.name} ${titleCase(componentName)} Recalls | Recalled Rides`;
      const description = `Check ${filteredRecalls.length} ${componentName} recalls for the ${year} ${make.name} ${model.name}. Get plain-English explanations and find out how to get free repairs.`;

      const cards = filteredRecalls.map(recallCard).join("");

      // Compute related components (all components for this year except current)
      const componentMap = new Map<string, { name: string; slug: string; count: number }>();
      for (const r of allRecalls) {
        const primary = r.component.split(":")[0].trim();
        const compSlug = slugify(primary);
        if (!componentMap.has(compSlug)) {
          componentMap.set(compSlug, { name: primary, slug: compSlug, count: 0 });
        }
        componentMap.get(compSlug)!.count++;
      }
      const relatedComponents = Array.from(componentMap.values())
        .filter((c) => c.slug !== componentSlug)
        .sort((a, b) => b.count - a.count)
        .map((c) => ({ ...c, isCurrent: false }));

      const relatedYearsResult = await c.env.DB.prepare(
        `SELECT vy.year, COUNT(r.id) as recall_count
       FROM vehicle_years vy
       JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = ? AND vy.year != ?
       GROUP BY vy.year
       ORDER BY vy.year DESC`,
      )
        .bind(model.id, yearNum)
        .all<{ year: number; recall_count: number }>();

      const relatedYears = relatedYearsResult.results.map((y) => ({
        year: y.year,
        recallCount: y.recall_count,
        isCurrent: y.year === yearNum,
      }));

      // Related recalls — same component across different models
      const relatedRecallsResult = await c.env.DB.prepare(
        `SELECT DISTINCT mk.name as make_name, mk.slug as make_slug,
                m.name as model_name, m.slug as model_slug,
                vy.year, COUNT(r2.id) as recall_count
         FROM recalls r1
         JOIN vehicle_years vy1 ON vy1.id = r1.vehicle_year_id
         JOIN models m1 ON m1.id = vy1.model_id
         JOIN recalls r2 ON (
           TRIM(CASE WHEN INSTR(r2.component, ':') > 0 THEN SUBSTR(r2.component, 1, INSTR(r2.component, ':') - 1) ELSE r2.component END) = ?
         )
         JOIN vehicle_years vy ON vy.id = r2.vehicle_year_id
         JOIN models m ON m.id = vy.model_id
         JOIN makes mk ON mk.id = m.make_id
         WHERE m1.make_id = ? AND m1.slug = ? AND vy1.year = ?
           AND (m.id != m1.id OR vy.year != vy1.year)
         GROUP BY mk.name, mk.slug, m.name, m.slug, vy.year
         ORDER BY recall_count DESC
         LIMIT 6`,
      )
        .bind(componentName, make.id, modelSlug, yearNum)
        .all<{
          make_name: string;
          make_slug: string;
          model_name: string;
          model_slug: string;
          year: number;
          recall_count: number;
        }>();

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${makeSlug}`, label: make.name },
        { href: `/${makeSlug}/${modelSlug}`, label: model.name },
        { href: `/${makeSlug}/${modelSlug}/${year}`, label: year },
        { href: `/${makeSlug}/${modelSlug}/${year}/${componentSlug}`, label: componentName },
      ]);

      const body =
        crumbs +
        componentPageTemplate({
          make: make.name,
          makeSlug,
          model: model.name,
          modelSlug,
          year,
          component: componentName,
          recallCount: filteredRecalls.length,
          topSeverity,
          cards,
          leadGen: dealerLeadGen(),
          relatedComponents,
          relatedYears,
          relatedRecalls: relatedRecallsResult.results,
        });

      const componentPageUrl = `${siteUrl}/${makeSlug}/${modelSlug}/${year}/${componentSlug}`;
      const remedySteps = filteredRecalls
        .filter((r) => (r.remedy_enriched ?? r.remedy_raw).length > 0)
        .slice(0, 1)
        .map((r) => {
          const remedyText = r.remedy_enriched ?? r.remedy_raw;
          return {
            name: `Repair for ${r.component} (Campaign #${r.nhtsa_campaign_number})`,
            text: remedyText,
          };
        });
      const jsonLd =
        faqPageJsonLd(
          filteredRecalls.map((r) => ({
            campaign: r.nhtsa_campaign_number,
            component: r.component,
            make: make.name,
            model: model.name,
            year,
            summary: r.summary_enriched ?? r.summary_raw,
            consequence: r.consequence_enriched ?? r.consequence_raw,
            remedy: r.remedy_enriched ?? r.remedy_raw,
            reportReceivedDate: r.report_received_date,
          })),
          componentPageUrl,
        ) +
        breadcrumbListJsonLd(siteUrl, [
          { name: "Home", item: siteUrl },
          { name: make.name, item: `${siteUrl}/${makeSlug}` },
          { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
          { name: year, item: `${siteUrl}/${makeSlug}/${modelSlug}/${year}` },
          { name: componentName, item: componentPageUrl },
        ]) +
        vehicleJsonLd(make.name, model.name, yearNum, componentPageUrl, filteredRecalls.length) +
        (remedySteps.length > 0
          ? howToJsonLd(
              `How to get the ${componentName} recall fixed for your ${year} ${make.name} ${model.name}`,
              `Dealers will repair ${componentName} issues free of charge. Here's what the fix involves.`,
              remedySteps,
              componentPageUrl,
            )
          : "");

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title,
          description,
          canonical: componentPageUrl,
          ogType: "website",
          ogImage: `/og/${makeSlug}/${modelSlug}/${year}.svg`,
          body,
          jsonLd,
        }),
        status: 200,
      };
    },
  );

  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, value.html, value.status);
});

// GET /:makeSlug/:modelSlug/:year — THE MONEY PAGE
pageRoutes.get("/:makeSlug{[a-z0-9-]+}/:modelSlug{[a-z0-9-]+}/:year{[0-9]+}", async (c) => {
  const { makeSlug, modelSlug, year } = c.req.param();
  const yearNum = Number(year);
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  if (!yearNum || yearNum < 1900 || yearNum > 2100) {
    c.header("X-Robots-Tag", "noindex, nofollow");
    return c.html(
      layout({
        googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
        analyticsToken: c.env.CF_ANALYTICS_TOKEN,
        title: "Page Not Found | Recalled Rides",
        description: "This vehicle year could not be found. Browse all makes on Recalled Rides.",
        noIndex: true,
        body: notFoundBody("Please check the year and try again. We cover most vehicles from 1950 to present.", siteUrl),
      }),
      404,
    );
  }

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:year:${makeSlug}:${modelSlug}:${year}`),
    43200,
    async () => {
      const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
        .bind(makeSlug)
        .first<{ id: number; name: string }>();
      if (!make) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that vehicle manufacturer. It may not be in our database yet.", siteUrl),
          }),
          status: 404,
        };
      }

      const model = await c.env.DB.prepare("SELECT id, name FROM models WHERE make_id = ? AND slug = ?")
        .bind(make.id, modelSlug)
        .first<{ id: number; name: string }>();
      if (!model) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This vehicle page could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that model. It may not be in our database yet or might be listed under a different name.", siteUrl),
          }),
          status: 404,
        };
      }

      // Fetch vehicle_year record including risk score
      const vehicleYear = await c.env.DB.prepare(
        `SELECT vy.id, vy.risk_score, vy.risk_grade, vy.recall_count
         FROM vehicle_years vy
         JOIN models m ON m.id = vy.model_id
         WHERE m.make_id = ? AND m.slug = ? AND vy.year = ?`
      )
        .bind(make.id, modelSlug, yearNum)
        .first<{ id: number; risk_score: number | null; risk_grade: string | null; recall_count: number | null }>();

      const recallsResult = await c.env.DB.prepare(
        `SELECT r.id, r.nhtsa_campaign_number, r.component, r.manufacturer,
              r.summary_raw, r.consequence_raw, r.remedy_raw,
              r.summary_enriched, r.consequence_enriched, r.remedy_enriched,
              r.severity_level, r.report_received_date, r.enriched_at
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       JOIN models m ON m.id = vy.model_id
       WHERE m.make_id = ? AND m.slug = ? AND vy.year = ?
       ORDER BY
         CASE r.severity_level
           WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5
         END ASC,
         r.report_received_date DESC`,
      )
        .bind(make.id, modelSlug, yearNum)
        .all<{
          id: number;
          nhtsa_campaign_number: string;
          component: string;
          manufacturer: string | null;
          summary_raw: string;
          consequence_raw: string;
          remedy_raw: string;
          summary_enriched: string | null;
          consequence_enriched: string | null;
          remedy_enriched: string | null;
          severity_level: SeverityLevel;
          report_received_date: string | null;
          enriched_at: string | null;
        }>();

      const recalls = recallsResult.results;
      const topSeverity = recalls[0]?.severity_level ?? "UNKNOWN";
      const riskGrade = vehicleYear?.risk_grade ?? null;
      const riskScore = vehicleYear?.risk_score ?? null;

      // Extract top component from most severe recall (first segment before colon)
      const topComponent = recalls.length > 0 ? recalls[0].component.split(":")[0].trim() : null;

      // Compute component links for this year
      const componentMap = new Map<string, { name: string; slug: string; count: number }>();
      for (const r of recalls) {
        const primary = r.component.split(":")[0].trim();
        const compSlug = slugify(primary);
        if (!componentMap.has(compSlug)) {
          componentMap.set(compSlug, { name: primary, slug: compSlug, count: 0 });
        }
        componentMap.get(compSlug)!.count++;
      }
      const components = Array.from(componentMap.values()).sort((a, b) => b.count - a.count);

      const title =
        recalls.length > 0 && topComponent && riskGrade
          ? `${year} ${make.name} ${model.name} Recalls: ${recalls.length} Safety Issues, Risk Grade ${riskGrade} | Recalled Rides`
          : recalls.length > 0 && topComponent
            ? `${year} ${make.name} ${model.name} Recalls: ${topComponent} Issues Explained | Recalled Rides`
            : `${year} ${make.name} ${model.name} Recall & Safety Information | Recalled Rides`;

      const description =
        recalls.length > 0 && riskGrade
          ? `Check ${recalls.length} open recalls, NHTSA investigations, and owner complaints for the ${year} ${make.name} ${model.name}. Risk Grade: ${riskGrade}. ${topComponent ?? "Safety"} issues explained in plain English.`
          : recalls.length > 0 && topComponent
            ? `Check ${recalls.length} known recalls for the ${year} ${make.name} ${model.name}. Get plain-English explanations of ${topComponent.toLowerCase()} issues and find out how to get free repairs at your local dealer.`
            : `Good news: the ${year} ${make.name} ${model.name} has no open safety recalls. Check back anytime — we update weekly from NHTSA data.`;

      const cards =
        recalls.length > 0
          ? recalls.map(recallCard).join("")
          : "<p class='text-gray-500 py-4'>No recalls found for this vehicle year.</p>";

      const relatedYearsResult = await c.env.DB.prepare(
        `SELECT vy.year, COUNT(r.id) as recall_count
       FROM vehicle_years vy
       JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = ? AND vy.year != ?
       GROUP BY vy.year
       ORDER BY vy.year DESC`,
      )
        .bind(model.id, yearNum)
        .all<{ year: number; recall_count: number }>();

      const relatedYears = relatedYearsResult.results.map((y) => ({
        year: y.year,
        recallCount: y.recall_count,
        isCurrent: y.year === yearNum,
      }));

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${makeSlug}`, label: make.name },
        { href: `/${makeSlug}/${modelSlug}`, label: model.name },
        { href: `/${makeSlug}/${modelSlug}/${year}`, label: year },
      ]);

      const body =
        crumbs +
        yearPageTemplate({
          make: make.name,
          makeSlug,
          model: model.name,
          modelSlug,
          year,
          recallCount: recalls.length,
          topSeverity,
          riskGrade,
          riskScore,
          cards,
          leadGen: dealerLeadGen(),
          relatedYears,
          components,
        }) +
        relatedLinks({ make: make.name, makeSlug, model: model.name, modelSlug, year });

      const yearPageUrl = `${siteUrl}/${makeSlug}/${modelSlug}/${year}`;
      const mostRecentDate = recalls[0]?.report_received_date ?? undefined;
      const yearRemedySteps = recalls
        .filter((r) => (r.remedy_enriched ?? r.remedy_raw).length > 0)
        .slice(0, 1)
        .map((r) => {
          const remedyText = r.remedy_enriched ?? r.remedy_raw;
          return {
            name: `Repair for ${r.component} (Campaign #${r.nhtsa_campaign_number})`,
            text: remedyText,
          };
        });
      const jsonLd =
        faqPageJsonLd(
          recalls.map((r) => ({
            campaign: r.nhtsa_campaign_number,
            component: r.component,
            make: make.name,
            model: model.name,
            year,
            summary: r.summary_enriched ?? r.summary_raw,
            consequence: r.consequence_enriched ?? r.consequence_raw,
            remedy: r.remedy_enriched ?? r.remedy_raw,
            reportReceivedDate: r.report_received_date,
          })),
          yearPageUrl,
          mostRecentDate,
          riskGrade,
          recalls.length,
          topSeverity,
        ) +
        breadcrumbListJsonLd(siteUrl, [
          { name: "Home", item: siteUrl },
          { name: make.name, item: `${siteUrl}/${makeSlug}` },
          { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
          { name: year, item: yearPageUrl },
        ]) +
        vehicleJsonLd(make.name, model.name, yearNum, yearPageUrl, recalls.length) +
        (yearRemedySteps.length > 0
          ? howToJsonLd(
              `How to get recalls fixed for your ${year} ${make.name} ${model.name}`,
              `Dealers will repair safety issues free of charge. Here's what the fix involves.`,
              yearRemedySteps,
              yearPageUrl,
            )
          : "");

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title,
          description,
          noIndex: recalls.length === 0,
          canonical: `${siteUrl}/${makeSlug}/${modelSlug}/${year}`,
          ogType: "website",
          ogImage: `/og/${makeSlug}/${modelSlug}/${year}.svg`,
          body,
          jsonLd,
        }),
        status: 200,
      };
    },
  );

  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  Object.entries(linkHeaders(siteUrl)).forEach(([k, v]) => c.header(k, v));
  return maybeMarkdown(c, value.html, value.status);
});

// GET /recall/:campaignNumber — Campaign detail page
pageRoutes.get("/recall/:campaignNumber{[A-Za-z0-9]+}", async (c) => {
  const { campaignNumber } = c.req.param();
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const { value, hit } = await getCachedOrRender<CachedPageResponse>(
    c.env.PAGE_CACHE,
    withPageCacheVersion(`page:campaign:${campaignNumber}`),
    86400,
    async () => {
      const recallsResult = await c.env.DB.prepare(
        `SELECT r.id, r.nhtsa_campaign_number, r.component, r.manufacturer,
              r.summary_raw, r.consequence_raw, r.remedy_raw,
              r.summary_enriched, r.consequence_enriched, r.remedy_enriched,
              r.severity_level, r.report_received_date, r.enriched_at,
              m.name as make_name, m.slug as make_slug,
              md.name as model_name, md.slug as model_slug,
              vy.year
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       JOIN models md ON md.id = vy.model_id
       JOIN makes m ON m.id = md.make_id
       WHERE r.nhtsa_campaign_number = ?
       ORDER BY vy.year DESC`,
      )
        .bind(campaignNumber)
        .all<{
          id: number;
          nhtsa_campaign_number: string;
          component: string;
          manufacturer: string | null;
          summary_raw: string;
          consequence_raw: string;
          remedy_raw: string;
          summary_enriched: string | null;
          consequence_enriched: string | null;
          remedy_enriched: string | null;
          severity_level: SeverityLevel;
          report_received_date: string | null;
          enriched_at: string | null;
          make_name: string;
          make_slug: string;
          model_name: string;
          model_slug: string;
          year: number;
        }>();

      if (recallsResult.results.length === 0) {
        return {
          html: layout({
            googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
            analyticsToken: c.env.CF_ANALYTICS_TOKEN,
            title: "Page Not Found | Recalled Rides",
            description: "This recall campaign could not be found. Browse all makes on Recalled Rides.",
            noIndex: true,
            body: notFoundBody("We couldn't find that recall campaign number. It may have been updated or merged with another campaign.", siteUrl),
          }),
          status: 404,
        };
      }

      const primaryRecall = recallsResult.results[0];
      const summary = primaryRecall.summary_enriched ?? primaryRecall.summary_raw;
      const consequence = primaryRecall.consequence_enriched ?? primaryRecall.consequence_raw;
      const remedy = primaryRecall.remedy_enriched ?? primaryRecall.remedy_raw;

      const title = `NHTSA Campaign ${primaryRecall.nhtsa_campaign_number} Recall Details | Recalled Rides`;
      const description = `${primaryRecall.component} recall for the ${primaryRecall.year} ${primaryRecall.make_name} ${primaryRecall.model_name}. ${summary.slice(0, 120)}...`;

      const affectedVehicles = recallsResult.results.map((r) => ({
        make: r.make_name,
        makeSlug: r.make_slug,
        model: r.model_name,
        modelSlug: r.model_slug,
        year: r.year,
      }));

      const crumbs = breadcrumbs([
        { href: "/", label: "Home" },
        { href: `/${primaryRecall.make_slug}`, label: primaryRecall.make_name },
        { href: `/${primaryRecall.make_slug}/${primaryRecall.model_slug}`, label: primaryRecall.model_name },
        { href: `/${primaryRecall.make_slug}/${primaryRecall.model_slug}/${primaryRecall.year}`, label: String(primaryRecall.year) },
      ]);

      const body = crumbs + campaignPageTemplate({
        campaign: primaryRecall.nhtsa_campaign_number,
        component: primaryRecall.component,
        manufacturer: primaryRecall.manufacturer,
        summary,
        consequence,
        remedy,
        severity: primaryRecall.severity_level,
        reportReceivedDate: primaryRecall.report_received_date,
        isEnriched: !!primaryRecall.enriched_at,
        affectedVehicles,
      });

      const campaignUrl = `${siteUrl}/recall/${primaryRecall.nhtsa_campaign_number}`;
      const jsonLd =
        breadcrumbListJsonLd(siteUrl, [
          { name: "Home", item: siteUrl },
          { name: primaryRecall.make_name, item: `${siteUrl}/${primaryRecall.make_slug}` },
          { name: primaryRecall.model_name, item: `${siteUrl}/${primaryRecall.make_slug}/${primaryRecall.model_slug}` },
          { name: String(primaryRecall.year), item: `${siteUrl}/${primaryRecall.make_slug}/${primaryRecall.model_slug}/${primaryRecall.year}` },
          { name: `Campaign ${primaryRecall.nhtsa_campaign_number}`, item: campaignUrl },
        ]) +
        articleJsonLd({
          headline: `NHTSA Campaign ${primaryRecall.nhtsa_campaign_number}: ${primaryRecall.component} Recall`,
          description: summary.slice(0, 200),
          url: campaignUrl,
          datePublished: primaryRecall.report_received_date ?? undefined,
          dateModified: primaryRecall.enriched_at ?? primaryRecall.report_received_date ?? undefined,
          author: "Recalled Rides",
        });

      return {
        html: layout({
          googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
          analyticsToken: c.env.CF_ANALYTICS_TOKEN,
          title,
          description,
          canonical: campaignUrl,
          ogType: "website",
          ogImage: "/og-image-detail.svg",
          body,
          jsonLd,
        }),
        status: 200,
      };
    },
  );

  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  if (value.status === 404) c.header("X-Robots-Tag", "noindex, nofollow");
  return c.body(value.html, value.status, HTML_HEADERS);
});

function notFoundBody(message: string, _siteUrl: string): string {
  return `
    <div class="rr-empty">
      <h1 class="rr-empty__title">Page Not Found</h1>
      <p class="rr-empty__text">${escapeHtml(message)}</p>
      <a href="/" class="rr-empty__action">Browse All Makes</a>
    </div>
  `;
}

function withPageCacheVersion(key: string): string {
  return `${PAGE_CACHE_VERSION}:${key}`;
}

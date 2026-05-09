import { Hono } from "hono";
import type { Env } from "../env";
import { getCachedOrRender } from "../lib/cache";
import { escapeHtml, slugify } from "../lib/utils";
import { layout } from "../templates/layout";
import { homeTemplate } from "../templates/home";
import { makePageTemplate } from "../templates/make-page";
import { modelPageTemplate } from "../templates/model-page";
import { yearPageTemplate } from "../templates/year-page";
import { recallCard } from "../templates/components/recall-card";
import { dealerLeadGen } from "../templates/components/dealer-lead-gen";
import { breadcrumbs } from "../templates/components/breadcrumbs";
import { faqPageJsonLd, breadcrumbListJsonLd, websiteJsonLd, organizationJsonLd, vehicleJsonLd } from "../templates/components/json-ld";
import type { SeverityLevel } from "../db/schema";
import { aboutTemplate } from "../templates/about";
import { componentPageTemplate } from "../templates/component-page";

export const pageRoutes = new Hono<{ Bindings: Env }>();

const CACHE_CONTROL = "public, s-maxage=43200, stale-while-revalidate=86400";

// GET / — Homepage
pageRoutes.get("/", async (c) => {
  const siteUrl = c.env.SITE_URL;
  const { html, hit } = await getCachedOrRender(c.env.PAGE_CACHE, "page:home", 86400, async () => {
    const [makesResult, statsResult] = await Promise.all([
      c.env.DB.prepare("SELECT name, slug FROM makes ORDER BY name").all<{ name: string; slug: string }>(),
      Promise.all([
        c.env.DB.prepare("SELECT COUNT(*) as count FROM recalls").first<{ count: number }>(),
        c.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years").first<{ count: number }>(),
        c.env.DB.prepare("SELECT COUNT(*) as count FROM makes").first<{ count: number }>(),
      ]),
    ]);
    const [recallCount, yearCount, makeCount] = statsResult;
    const jsonLd = websiteJsonLd(siteUrl, "RecallRadar", "Search and understand vehicle recalls in plain English. Check if your car has open safety recalls.")
      + organizationJsonLd({ name: "RecallRadar", url: siteUrl });

    return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
      title: "RecallRadar — Vehicle Recall Search",
      description: "Search and understand vehicle recalls in plain English. Check if your car has open safety recalls.",
      canonical: siteUrl,
      ogType: "website",
      body: homeTemplate(makesResult.results, {
        recalls: recallCount?.count ?? 0,
        vehicles: yearCount?.count ?? 0,
        makes: makeCount?.count ?? 0,
      }),
      jsonLd,
    });
  });
  c.header("Cache-Control", CACHE_CONTROL);
  return c.html(html);
});

// GET /about — About page
pageRoutes.get("/about", async (c) => {
  const siteUrl = c.env.SITE_URL;
  const html = await getCachedOrRender(c.env.PAGE_CACHE, "page:about", 86400, async () => {
    return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
      title: "About RecallRadar",
      description: "Learn how RecallRadar sources vehicle recall data from NHTSA and simplifies it into plain English for drivers.",
      canonical: `${siteUrl}/about`,
      body: aboutTemplate(siteUrl),
    });
  });
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  return c.html(html);
});

// GET /:makeSlug — Make landing page
pageRoutes.get("/:makeSlug{[a-z0-9-]+}", async (c) => {
  const { makeSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL;

  const make = await c.env.DB.prepare("SELECT id, name, slug FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string; slug: string }>();
  if (!make) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const { html, hit } = await getCachedOrRender(c.env.PAGE_CACHE, `page:make:${makeSlug}`, 86400, async () => {
    const models = await c.env.DB.prepare(
      `SELECT m.name, m.slug,
              MIN(vy.year) as min_year, MAX(vy.year) as max_year,
              COUNT(DISTINCT r.id) as recall_count
       FROM models m
       LEFT JOIN vehicle_years vy ON vy.model_id = m.id
       LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE m.make_id = ?
       GROUP BY m.id ORDER BY m.name`
    ).bind(make.id).all<{ name: string; slug: string; min_year: number | null; max_year: number | null; recall_count: number }>();

    const crumbs = breadcrumbs([
      { href: "/", label: "Home" },
      { href: `/${makeSlug}`, label: make.name },
    ]);
    const body = crumbs + makePageTemplate(make.name, make.slug, models.results);

    return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
      title: `${make.name} Vehicle Recalls & Safety Issues | RecallRadar`,
      description: `Browse all ${make.name} vehicle recalls and safety issues. Find recalls for your ${make.name} by model and year.`,
      canonical: `${siteUrl}/${makeSlug}`,
      body,
      jsonLd: breadcrumbListJsonLd(siteUrl, [
        { name: "Home", item: siteUrl },
        { name: make.name, item: `${siteUrl}/${makeSlug}` },
      ]),
    });
  });
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  return c.html(html);
});

// GET /:makeSlug/:modelSlug — Model landing page
pageRoutes.get("/:makeSlug{[a-z0-9-]+}/:modelSlug{[a-z0-9-]+}", async (c) => {
  const { makeSlug, modelSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL;

  const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string }>();
  if (!make) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const model = await c.env.DB.prepare("SELECT id, name, slug FROM models WHERE make_id = ? AND slug = ?")
    .bind(make.id, modelSlug).first<{ id: number; name: string; slug: string }>();
  if (!model) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle model not found.", siteUrl) }), 404);
  }

  const { html, hit } = await getCachedOrRender(c.env.PAGE_CACHE, `page:model:${makeSlug}:${modelSlug}`, 86400, async () => {
    const years = await c.env.DB.prepare(
      `SELECT vy.year,
              COUNT(r.id) as recall_count,
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
       GROUP BY vy.year ORDER BY vy.year DESC`
    ).bind(model.id).all<{ year: number; recall_count: number; highest_severity: SeverityLevel | null }>();

    const crumbs = breadcrumbs([
      { href: "/", label: "Home" },
      { href: `/${makeSlug}`, label: make.name },
      { href: `/${makeSlug}/${modelSlug}`, label: model.name },
    ]);
    const body = crumbs + modelPageTemplate(make.name, makeSlug, model.name, modelSlug, years.results);

    return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION,
      title: `${make.name} ${model.name} Recalls by Year | RecallRadar`,
      description: `Check ${make.name} ${model.name} recalls by model year. Find safety issues and get free repairs for your vehicle.`,
      canonical: `${siteUrl}/${makeSlug}/${modelSlug}`,
      body,
      jsonLd: breadcrumbListJsonLd(siteUrl, [
        { name: "Home", item: siteUrl },
        { name: make.name, item: `${siteUrl}/${makeSlug}` },
        { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
      ]),
    });
  });
  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  return c.html(html);
});

// GET /:makeSlug/:modelSlug/:year/:componentSlug — Component-specific recalls
pageRoutes.get("/:makeSlug/:modelSlug/:year/:componentSlug", async (c) => {
  const { makeSlug, modelSlug, year, componentSlug } = c.req.param();
  const yearNum = Number(year);
  const siteUrl = c.env.SITE_URL;

  if (!yearNum || yearNum < 1900 || yearNum > 2100) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle year could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Invalid year.", siteUrl) }), 404);
  }

  const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string }>();
  if (!make) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const model = await c.env.DB.prepare("SELECT id, name FROM models WHERE make_id = ? AND slug = ?")
    .bind(make.id, modelSlug).first<{ id: number; name: string }>();
  if (!model) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle model not found.", siteUrl) }), 404);
  }

  const html = await getCachedOrRender(c.env.PAGE_CACHE, `page:component:${makeSlug}:${modelSlug}:${year}:${componentSlug}`, 43200, async () => {
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
         r.report_received_date DESC`
    ).bind(make.id, modelSlug, yearNum).all<{
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
      // No recalls match this component — return 404
      return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "No recalls found for this component. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Component not found for this vehicle year.", siteUrl) });
    }

    const componentName = filteredRecalls[0].component.split(":")[0].trim();
    const topSeverity = filteredRecalls[0]?.severity_level ?? "UNKNOWN";

    const title = `${year} ${make.name} ${model.name} ${componentName} Recalls | RecallRadar`;
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
       LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = ? AND vy.year != ?
       GROUP BY vy.year
       ORDER BY vy.year DESC`
    ).bind(model.id, yearNum).all<{ year: number; recall_count: number }>();

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
      { href: `/${makeSlug}/${modelSlug}/${year}/${componentSlug}`, label: componentName },
    ]);

    const body = crumbs + componentPageTemplate({
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
    });

    const componentPageUrl = `${siteUrl}/${makeSlug}/${modelSlug}/${year}/${componentSlug}`;
    const jsonLd = faqPageJsonLd(filteredRecalls.map((r) => ({
      campaign: r.nhtsa_campaign_number,
      component: r.component,
      make: make.name,
      model: model.name,
      year,
      summary: r.summary_enriched ?? r.summary_raw,
      consequence: r.consequence_enriched ?? r.consequence_raw,
      remedy: r.remedy_enriched ?? r.remedy_raw,
      reportReceivedDate: r.report_received_date,
    })), componentPageUrl)
      + breadcrumbListJsonLd(siteUrl, [
        { name: "Home", item: siteUrl },
        { name: make.name, item: `${siteUrl}/${makeSlug}` },
        { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
        { name: year, item: `${siteUrl}/${makeSlug}/${modelSlug}/${year}` },
        { name: componentName, item: componentPageUrl },
      ])
      + vehicleJsonLd(make.name, model.name, yearNum, componentPageUrl, filteredRecalls.length);

    return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title, description, canonical: componentPageUrl, body, jsonLd });
  });

  c.header("Cache-Control", CACHE_CONTROL);
  return c.html(html);
});

// GET /:makeSlug/:modelSlug/:year — THE MONEY PAGE
pageRoutes.get("/:makeSlug{[a-z0-9-]+}/:modelSlug{[a-z0-9-]+}/:year{[0-9]+}", async (c) => {
  const { makeSlug, modelSlug, year } = c.req.param();
  const yearNum = Number(year);
  const siteUrl = c.env.SITE_URL;

  if (!yearNum || yearNum < 1900 || yearNum > 2100) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle year could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Invalid year.", siteUrl) }), 404);
  }

  const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string }>();
  if (!make) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const model = await c.env.DB.prepare("SELECT id, name FROM models WHERE make_id = ? AND slug = ?")
    .bind(make.id, modelSlug).first<{ id: number; name: string }>();
  if (!model) {
    return c.html(layout({ googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title: "Not Found", description: "This vehicle page could not be found. Browse all makes on RecallRadar.", noIndex: true, body: notFoundBody("Vehicle model not found.", siteUrl) }), 404);
  }

  const { html, hit } = await getCachedOrRender(c.env.PAGE_CACHE, `page:year:${makeSlug}:${modelSlug}:${year}`, 43200, async () => {
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
         r.report_received_date DESC`
    ).bind(make.id, modelSlug, yearNum).all<{
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

    const title = `${year} ${make.name} ${model.name} Recalls & Safety Issues | RecallRadar`;

    const description = `Check ${recalls.length} known recalls for the ${year} ${make.name} ${model.name}. Get plain-English explanations and find out how to get free repairs at your local dealer.`;

    const cards = recalls.length > 0
      ? recalls.map(recallCard).join("")
      : "<p class='text-gray-500 py-4'>No recalls found for this vehicle year.</p>";

    const relatedYearsResult = await c.env.DB.prepare(
      `SELECT vy.year, COUNT(r.id) as recall_count
       FROM vehicle_years vy
       LEFT JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = ? AND vy.year != ?
       GROUP BY vy.year
       ORDER BY vy.year DESC`
    ).bind(model.id, yearNum).all<{ year: number; recall_count: number }>();

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

    const body = crumbs + yearPageTemplate({
      make: make.name,
      makeSlug,
      model: model.name,
      modelSlug,
      year,
      recallCount: recalls.length,
      topSeverity,
      cards,
      leadGen: dealerLeadGen(),
      relatedYears,
      components,
    });

    const yearPageUrl = `${siteUrl}/${makeSlug}/${modelSlug}/${year}`;
    const jsonLd = faqPageJsonLd(recalls.map((r) => ({
      campaign: r.nhtsa_campaign_number,
      component: r.component,
      make: make.name,
      model: model.name,
      year,
      summary: r.summary_enriched ?? r.summary_raw,
      consequence: r.consequence_enriched ?? r.consequence_raw,
      remedy: r.remedy_enriched ?? r.remedy_raw,
      reportReceivedDate: r.report_received_date,
    })), yearPageUrl)
      + breadcrumbListJsonLd(siteUrl, [
        { name: "Home", item: siteUrl },
        { name: make.name, item: `${siteUrl}/${makeSlug}` },
        { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
        { name: year, item: yearPageUrl },
      ])
      + vehicleJsonLd(make.name, model.name, yearNum, yearPageUrl, recalls.length);

    return layout({
      googleVerification: c.env.GOOGLE_SITE_VERIFICATION, title, description, canonical: `${siteUrl}/${makeSlug}/${modelSlug}/${year}`, body, jsonLd });
  });

  c.header("Cache-Control", CACHE_CONTROL);
  c.header("X-Cache", hit ? "HIT" : "MISS");
  return c.html(html);
});

function notFoundBody(message: string, siteUrl: string): string {
  return `
    <div class="max-w-xl mx-auto py-16 text-center">
      <h1 class="text-3xl font-bold text-gray-800 mb-4">Vehicle Not Found</h1>
      <p class="text-gray-600 mb-8">${escapeHtml(message)}</p>
      <a href="/" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
        Browse All Makes
      </a>
    </div>
  `;
}

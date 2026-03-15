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
import { faqPageJsonLd, breadcrumbListJsonLd } from "../templates/components/json-ld";
import type { SeverityLevel } from "../db/schema";

export const pageRoutes = new Hono<{ Bindings: Env }>();

const CACHE_CONTROL = "public, s-maxage=43200, stale-while-revalidate=86400";

// GET / — Homepage
pageRoutes.get("/", async (c) => {
  const siteUrl = c.env.SITE_URL;
  const html = await getCachedOrRender(c.env.PAGE_CACHE, "page:home", 86400, async () => {
    const [makesResult, statsResult] = await Promise.all([
      c.env.DB.prepare("SELECT name, slug FROM makes ORDER BY name").all<{ name: string; slug: string }>(),
      Promise.all([
        c.env.DB.prepare("SELECT COUNT(*) as count FROM recalls").first<{ count: number }>(),
        c.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years").first<{ count: number }>(),
        c.env.DB.prepare("SELECT COUNT(*) as count FROM makes").first<{ count: number }>(),
      ]),
    ]);
    const [recallCount, yearCount, makeCount] = statsResult;
    return layout({
      title: "RecallRadar — Vehicle Recall Search",
      description: "Search and understand vehicle recalls in plain English. Check if your car has open safety recalls.",
      canonical: siteUrl,
      body: homeTemplate(makesResult.results, {
        recalls: recallCount?.count ?? 0,
        vehicles: yearCount?.count ?? 0,
        makes: makeCount?.count ?? 0,
      }),
    });
  });
  c.header("Cache-Control", CACHE_CONTROL);
  return c.html(html);
});

// GET /:makeSlug — Make landing page
pageRoutes.get("/:makeSlug", async (c) => {
  const { makeSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL;

  const make = await c.env.DB.prepare("SELECT id, name, slug FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string; slug: string }>();
  if (!make) {
    return c.html(layout({ title: "Not Found", body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const html = await getCachedOrRender(c.env.PAGE_CACHE, `page:make:${makeSlug}`, 86400, async () => {
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
  return c.html(html);
});

// GET /:makeSlug/:modelSlug — Model landing page
pageRoutes.get("/:makeSlug/:modelSlug", async (c) => {
  const { makeSlug, modelSlug } = c.req.param();
  const siteUrl = c.env.SITE_URL;

  const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string }>();
  if (!make) {
    return c.html(layout({ title: "Not Found", body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const model = await c.env.DB.prepare("SELECT id, name, slug FROM models WHERE make_id = ? AND slug = ?")
    .bind(make.id, modelSlug).first<{ id: number; name: string; slug: string }>();
  if (!model) {
    return c.html(layout({ title: "Not Found", body: notFoundBody("Vehicle model not found.", siteUrl) }), 404);
  }

  const html = await getCachedOrRender(c.env.PAGE_CACHE, `page:model:${makeSlug}:${modelSlug}`, 86400, async () => {
    const years = await c.env.DB.prepare(
      `SELECT vy.year,
              COUNT(r.id) as recall_count,
              MAX(r.severity_level) as highest_severity
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
  return c.html(html);
});

// GET /:makeSlug/:modelSlug/:year — THE MONEY PAGE
pageRoutes.get("/:makeSlug/:modelSlug/:year", async (c) => {
  const { makeSlug, modelSlug, year } = c.req.param();
  const yearNum = Number(year);
  const siteUrl = c.env.SITE_URL;

  if (!yearNum || yearNum < 1900 || yearNum > 2100) {
    return c.html(layout({ title: "Not Found", body: notFoundBody("Invalid year.", siteUrl) }), 404);
  }

  const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?")
    .bind(makeSlug).first<{ id: number; name: string }>();
  if (!make) {
    return c.html(layout({ title: "Not Found", body: notFoundBody("Vehicle make not found.", siteUrl) }), 404);
  }

  const model = await c.env.DB.prepare("SELECT id, name FROM models WHERE make_id = ? AND slug = ?")
    .bind(make.id, modelSlug).first<{ id: number; name: string }>();
  if (!model) {
    return c.html(layout({ title: "Not Found", body: notFoundBody("Vehicle model not found.", siteUrl) }), 404);
  }

  const html = await getCachedOrRender(c.env.PAGE_CACHE, `page:year:${makeSlug}:${modelSlug}:${year}`, 43200, async () => {
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
    const topComponent = recalls[0]?.component?.split(":")?.[0]?.trim() ?? "";

    const title = recalls.length > 0
      ? `${year} ${make.name} ${model.name} Recalls: ${escapeHtml(topComponent)} Issues Explained | RecallRadar`
      : `${year} ${make.name} ${model.name} Recall & Safety Information | RecallRadar`;

    const description = `Check ${recalls.length} known recalls for the ${year} ${make.name} ${model.name}. Get plain-English explanations${topComponent ? ` of ${topComponent} issues` : ""} and find out how to get free repairs at your local dealer.`;

    const cards = recalls.length > 0
      ? recalls.map(recallCard).join("")
      : "<p class='text-gray-500 py-4'>No recalls found for this vehicle year.</p>";

    const crumbs = breadcrumbs([
      { href: "/", label: "Home" },
      { href: `/${makeSlug}`, label: make.name },
      { href: `/${makeSlug}/${modelSlug}`, label: model.name },
      { href: `/${makeSlug}/${modelSlug}/${year}`, label: year },
    ]);

    const body = crumbs + yearPageTemplate({
      make: make.name,
      model: model.name,
      year,
      recallCount: recalls.length,
      topSeverity,
      cards,
      leadGen: dealerLeadGen(),
    });

    const jsonLd = faqPageJsonLd(recalls.map((r) => ({
      campaign: r.nhtsa_campaign_number,
      component: r.component,
      make: make.name,
      model: model.name,
      year,
      summary: r.summary_enriched ?? r.summary_raw,
      consequence: r.consequence_enriched ?? r.consequence_raw,
      remedy: r.remedy_enriched ?? r.remedy_raw,
    }))) + breadcrumbListJsonLd(siteUrl, [
      { name: "Home", item: siteUrl },
      { name: make.name, item: `${siteUrl}/${makeSlug}` },
      { name: model.name, item: `${siteUrl}/${makeSlug}/${modelSlug}` },
      { name: year, item: `${siteUrl}/${makeSlug}/${modelSlug}/${year}` },
    ]);

    return layout({ title, description, canonical: `${siteUrl}/${makeSlug}/${modelSlug}/${year}`, body, jsonLd });
  });

  c.header("Cache-Control", CACHE_CONTROL);
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

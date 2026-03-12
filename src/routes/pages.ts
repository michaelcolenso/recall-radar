import { Hono } from "hono";
import type { Env } from "../env";
import { readThroughPageCache } from "../lib/cache";
import { layout } from "../templates/layout";
import { homeTemplate } from "../templates/home";
import { makePageTemplate } from "../templates/make-page";
import { modelPageTemplate } from "../templates/model-page";
import { yearPageTemplate } from "../templates/year-page";
import { breadcrumbs } from "../templates/components/breadcrumbs";
import { dealerLeadGen } from "../templates/components/dealer-lead-gen";
import { recallCard } from "../templates/components/recall-card";
import { pageJsonLd } from "../templates/components/json-ld";

export const pageRoutes = new Hono<{ Bindings: Env }>();

pageRoutes.get("/", async (c) => {
  const html = await readThroughPageCache(c.env, "page:home", 600, async () => {
    const makes = await c.env.DB.prepare("SELECT name, slug FROM makes ORDER BY name LIMIT 50").all<{ name: string; slug: string }>();
    return layout("RecallRadar", homeTemplate(makes.results));
  });
  return c.html(html);
});

pageRoutes.get("/make/:makeSlug", async (c) => {
  const { makeSlug } = c.req.param();
  const html = await readThroughPageCache(c.env, `page:make:${makeSlug}`, 900, async () => {
    const make = await c.env.DB.prepare("SELECT id, name, slug FROM makes WHERE slug = ?").bind(makeSlug).first<{ id: number; name: string; slug: string }>();
    if (!make) return layout("Not Found", "<p>Make not found.</p>");
    const models = await c.env.DB.prepare("SELECT name, slug FROM models WHERE make_id = ? ORDER BY name").bind(make.id).all<{ name: string; slug: string }>();
    const body = breadcrumbs([{ href: "/", label: "Home" }, { href: c.req.path, label: make.name }]) + makePageTemplate(make.name, models.results);
    return layout(`${make.name} recalls`, body, pageJsonLd({ "@context": "https://schema.org", "@type": "CollectionPage", name: `${make.name} recalls` }));
  });
  return c.html(html);
});

pageRoutes.get("/make/:makeSlug/:modelSlug", async (c) => {
  const { makeSlug, modelSlug } = c.req.param();
  const make = await c.env.DB.prepare("SELECT id, name FROM makes WHERE slug = ?").bind(makeSlug).first<{ id: number; name: string }>();
  if (!make) return c.html(layout("Not Found", "<p>Make not found.</p>"), 404);
  const model = await c.env.DB.prepare("SELECT id, name, slug FROM models WHERE make_id = ? AND slug = ?").bind(make.id, modelSlug).first<{ id: number; name: string; slug: string }>();
  if (!model) return c.html(layout("Not Found", "<p>Model not found.</p>"), 404);

  const years = await c.env.DB.prepare("SELECT year FROM vehicle_years WHERE make_id = ? AND model_id = ? ORDER BY year DESC").bind(make.id, model.id).all<{ year: number }>();

  const body = breadcrumbs([
    { href: "/", label: "Home" },
    { href: `/make/${makeSlug}`, label: make.name },
    { href: c.req.path, label: model.name }
  ]) + modelPageTemplate(makeSlug, model.slug, years.results.map((y) => y.year));

  return c.html(layout(`${make.name} ${model.name} recalls`, body));
});

pageRoutes.get("/make/:makeSlug/:modelSlug/:year", async (c) => {
  const { makeSlug, modelSlug, year } = c.req.param();
  const y = Number(year);
  const rows = await c.env.DB.prepare(
    `SELECT r.campaign_number as campaignNumber, r.component, COALESCE(r.summary_enriched, r.summary_raw) as summary,
            r.consequence, r.remedy, r.severity
       FROM recalls r
       JOIN makes m ON m.id = r.make_id
       JOIN models md ON md.id = r.model_id
      WHERE m.slug = ? AND md.slug = ? AND r.year = ?
      ORDER BY r.campaign_number DESC`
  ).bind(makeSlug, modelSlug, y).all<{
    campaignNumber: string; component: string; summary: string; consequence: string; remedy: string; severity: "high"|"medium"|"low";
  }>();

  const cards = rows.results.map(recallCard).join("") || "<p>No recalls found.</p>";
  const body = breadcrumbs([
    { href: "/", label: "Home" },
    { href: `/make/${makeSlug}`, label: makeSlug },
    { href: `/make/${makeSlug}/${modelSlug}`, label: modelSlug },
    { href: c.req.path, label: year }
  ]) + yearPageTemplate(`${makeSlug} ${modelSlug} ${year} recalls`, cards, dealerLeadGen());

  return c.html(layout(`${makeSlug} ${modelSlug} ${year} recalls`, body));
});

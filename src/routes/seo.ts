import { Hono } from "hono";
import type { Env } from "../env";
import { getCachedOrRender } from "../lib/cache";

export const seoRoutes = new Hono<{ Bindings: Env }>();

const MAX_URLS_PER_SITEMAP = 50000;
const YEAR_SITEMAP_CHUNK_SIZE = 45000;

// GET /robots.txt
seoRoutes.get("/robots.txt", (c) => {
  const siteUrl = c.env.SITE_URL;
  return c.text(
    `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml`,
    200,
    { "content-type": "text/plain; charset=utf-8" }
  );
});

// GET /sitemap.xml
seoRoutes.get("/sitemap.xml", async (c) => {
  const siteUrl = c.env.SITE_URL;

  const [makeCount, modelCount, yearCount] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM makes").first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM models").first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years").first<{ count: number }>(),
  ]);

  const totalUrls = 1 + (makeCount?.count ?? 0) + (modelCount?.count ?? 0) + (yearCount?.count ?? 0);

  if (totalUrls > MAX_URLS_PER_SITEMAP) {
    const indexXml = await getCachedOrRender(c.env.PAGE_CACHE, "sitemap:index", 86400, async () => {
      const parts: string[] = [
        sitemapIndexUrl(`${siteUrl}/sitemap-makes.xml`),
        sitemapIndexUrl(`${siteUrl}/sitemap-models.xml`),
      ];

      const yearPages = Math.max(1, Math.ceil((yearCount?.count ?? 0) / YEAR_SITEMAP_CHUNK_SIZE));
      for (let i = 1; i <= yearPages; i++) {
        parts.push(sitemapIndexUrl(`${siteUrl}/sitemap-years-${i}.xml`));
      }

      return wrapSitemapIndex(parts);
    });

    return c.body(indexXml, 200, { "content-type": "application/xml; charset=utf-8" });
  }

  const xml = await getCachedOrRender(c.env.PAGE_CACHE, "sitemap:xml", 86400, async () => {
    const [makesResult, modelsResult, yearsResult] = await Promise.all([
      c.env.DB.prepare("SELECT slug FROM makes ORDER BY slug").all<{ slug: string }>(),
      c.env.DB.prepare(
        `SELECT mk.slug as make_slug, m.slug as model_slug
         FROM models m JOIN makes mk ON mk.id = m.make_id ORDER BY mk.slug, m.slug`
      ).all<{ make_slug: string; model_slug: string }>(),
      c.env.DB.prepare(
        `SELECT mk.slug as make_slug, m.slug as model_slug, vy.year
         FROM vehicle_years vy
         JOIN models m ON m.id = vy.model_id
         JOIN makes mk ON mk.id = m.make_id
         ORDER BY mk.slug, m.slug, vy.year DESC`
      ).all<{ make_slug: string; model_slug: string; year: number }>(),
    ]);

    const now = new Date().toISOString().split("T")[0];
    const urls: string[] = [];

    urls.push(sitemapUrl(`${siteUrl}/`, now, "1.0", "daily"));

    for (const make of makesResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${make.slug}`, now, "0.8", "weekly"));
    }

    for (const m of modelsResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${m.make_slug}/${m.model_slug}`, now, "0.7", "weekly"));
    }

    for (const y of yearsResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${y.make_slug}/${y.model_slug}/${y.year}`, now, "0.9", "weekly"));
    }

    return wrapSitemapUrls(urls);
  });

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

seoRoutes.get("/sitemap-makes.xml", async (c) => {
  const siteUrl = c.env.SITE_URL;
  const xml = await getCachedOrRender(c.env.PAGE_CACHE, "sitemap:makes", 86400, async () => {
    const [makesResult] = await Promise.all([
      c.env.DB.prepare("SELECT slug FROM makes ORDER BY slug").all<{ slug: string }>(),
    ]);

    const now = new Date().toISOString().split("T")[0];
    const urls = [sitemapUrl(`${siteUrl}/`, now, "1.0", "daily")];
    for (const make of makesResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${make.slug}`, now, "0.8", "weekly"));
    }
    return wrapSitemapUrls(urls);
  });

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

seoRoutes.get("/sitemap-models.xml", async (c) => {
  const siteUrl = c.env.SITE_URL;
  const xml = await getCachedOrRender(c.env.PAGE_CACHE, "sitemap:models", 86400, async () => {
    const modelsResult = await c.env.DB.prepare(
      `SELECT mk.slug as make_slug, m.slug as model_slug
       FROM models m JOIN makes mk ON mk.id = m.make_id ORDER BY mk.slug, m.slug`
    ).all<{ make_slug: string; model_slug: string }>();

    const now = new Date().toISOString().split("T")[0];
    const urls = modelsResult.results.map((m) => sitemapUrl(`${siteUrl}/${m.make_slug}/${m.model_slug}`, now, "0.7", "weekly"));
    return wrapSitemapUrls(urls);
  });

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

seoRoutes.get("/sitemap-years-:page.xml", async (c) => {
  const siteUrl = c.env.SITE_URL;
  const page = Math.max(1, Number(c.req.param("page") || "1"));
  const offset = (page - 1) * YEAR_SITEMAP_CHUNK_SIZE;

  const xml = await getCachedOrRender(c.env.PAGE_CACHE, `sitemap:years:${page}`, 86400, async () => {
    const yearsResult = await c.env.DB.prepare(
      `SELECT mk.slug as make_slug, m.slug as model_slug, vy.year
       FROM vehicle_years vy
       JOIN models m ON m.id = vy.model_id
       JOIN makes mk ON mk.id = m.make_id
       ORDER BY mk.slug, m.slug, vy.year DESC
       LIMIT ? OFFSET ?`
    ).bind(YEAR_SITEMAP_CHUNK_SIZE, offset).all<{ make_slug: string; model_slug: string; year: number }>();

    const now = new Date().toISOString().split("T")[0];
    const urls = yearsResult.results.map((y) => sitemapUrl(`${siteUrl}/${y.make_slug}/${y.model_slug}/${y.year}`, now, "0.9", "weekly"));
    return wrapSitemapUrls(urls);
  });

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

function sitemapUrl(loc: string, lastmod: string, priority: string, changefreq: string): string {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function sitemapIndexUrl(loc: string): string {
  return `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`;
}

function wrapSitemapUrls(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

function wrapSitemapIndex(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`;
}

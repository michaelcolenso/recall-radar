import { Hono } from "hono";
import type { Env } from "../env";
import { getCachedOrRender } from "../lib/cache";

export const seoRoutes = new Hono<{ Bindings: Env }>();

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

    // Homepage
    urls.push(sitemapUrl(`${siteUrl}/`, now, "1.0", "daily"));

    // Make pages
    for (const make of makesResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${make.slug}`, now, "0.8", "weekly"));
    }

    // Model pages
    for (const m of modelsResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${m.make_slug}/${m.model_slug}`, now, "0.7", "weekly"));
    }

    // Vehicle year pages (money pages)
    for (const y of yearsResult.results) {
      urls.push(sitemapUrl(`${siteUrl}/${y.make_slug}/${y.model_slug}/${y.year}`, now, "0.9", "weekly"));
    }

    const totalUrls = 1 + makesResult.results.length + modelsResult.results.length + yearsResult.results.length;

    // If >50k URLs, note: implement sitemap index (for now single sitemap)
    if (totalUrls > 50000) {
      console.warn(`Sitemap has ${totalUrls} URLs, consider splitting into sitemap index`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
  });

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

function sitemapUrl(loc: string, lastmod: string, priority: string, changefreq: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

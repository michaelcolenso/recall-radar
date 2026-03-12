import { Hono } from "hono";

export const seoRoutes = new Hono();

seoRoutes.get("/robots.txt", (c) =>
  c.text("User-agent: *\nAllow: /\nSitemap: https://recallradar.example/sitemap.xml", 200, { "content-type": "text/plain" })
);

seoRoutes.get("/sitemap.xml", async (c) => {
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://recallradar.example/</loc><lastmod>${now}</lastmod></url></urlset>`;
  return c.body(xml, 200, { "content-type": "application/xml" });
});

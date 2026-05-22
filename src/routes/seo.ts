import { Hono } from "hono";
import { getCachedOrRender } from "../lib/cache";
import { slugify } from "../lib/utils";

export const seoRoutes = new Hono<{ Bindings: Env }>();

const MAX_URLS_PER_SITEMAP = 50000;
const YEAR_SITEMAP_CHUNK_SIZE = 45000;
const COMPONENT_SITEMAP_CHUNK_SIZE = 45000;
const CAMPAIGN_SITEMAP_CHUNK_SIZE = 45000;
const SEO_CACHE_VERSION = "v5";

interface CountRow {
  count: number;
}

interface MakeSitemapRow {
  slug: string;
  lastmod: string;
}

interface ModelSitemapRow {
  make_slug: string;
  model_slug: string;
  lastmod: string;
}

interface YearSitemapRow {
  make_slug: string;
  model_slug: string;
  year: number;
  lastmod: string;
}

interface ComponentSitemapRow {
  make_slug: string;
  model_slug: string;
  year: number;
  component_name: string;
  lastmod: string;
}

interface CampaignSitemapRow {
  campaign_number: string;
  lastmod: string;
}

// GET /robots.txt
seoRoutes.get("/robots.txt", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  // Sitemap is a non-group record and must be at top-level.
  // Specific crawler blocks ensure Disallow is respected even if a prior
  // generic User-agent: * block exists (e.g. Cloudflare managed content).
  return c.text(
    `Sitemap: ${siteUrl}/sitemap.xml\n\n` +
      `User-agent: *\nAllow: /\nDisallow: /api/\n\n` +
      `User-agent: Googlebot\nAllow: /\nDisallow: /api/\n\n` +
      `User-agent: Bingbot\nAllow: /\nDisallow: /api/`,
    200,
    { "content-type": "text/plain; charset=utf-8" },
  );
});

// GET /sitemap.xml
seoRoutes.get("/sitemap.xml", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const [makeCount, modelCount, yearCount, componentCount, campaignCount] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM makes").first<CountRow>(),
    getModelUrlCount(c.env.DB),
    getYearUrlCount(c.env.DB),
    getComponentUrlCount(c.env.DB),
    getCampaignUrlCount(c.env.DB),
  ]);

  const totalUrls =
    1 +
    (makeCount?.count ?? 0) +
    (modelCount?.count ?? 0) +
    (yearCount?.count ?? 0) +
    (componentCount?.count ?? 0) +
    (campaignCount?.count ?? 0);

  if (totalUrls > MAX_URLS_PER_SITEMAP) {
    const { value: indexXml, hit: indexHit } = await getCachedOrRender(
      c.env.PAGE_CACHE,
      withSeoCacheVersion("sitemap:index"),
      86400,
      async () => {
        const now = new Date().toISOString().split("T")[0];
        const parts: string[] = [
          sitemapIndexUrl(`${siteUrl}/sitemap-makes.xml`, now),
          sitemapIndexUrl(`${siteUrl}/sitemap-models.xml`, now),
        ];

        const yearPages = Math.max(1, Math.ceil((yearCount?.count ?? 0) / YEAR_SITEMAP_CHUNK_SIZE));
        for (let i = 1; i <= yearPages; i++) {
          parts.push(sitemapIndexUrl(`${siteUrl}/sitemap-years-${i}.xml`, now));
        }

        const componentPages = Math.max(1, Math.ceil((componentCount?.count ?? 0) / COMPONENT_SITEMAP_CHUNK_SIZE));
        for (let i = 1; i <= componentPages; i++) {
          parts.push(sitemapIndexUrl(`${siteUrl}/sitemap-components-${i}.xml`, now));
        }

        const campaignPages = Math.max(1, Math.ceil((campaignCount?.count ?? 0) / CAMPAIGN_SITEMAP_CHUNK_SIZE));
        for (let i = 1; i <= campaignPages; i++) {
          parts.push(sitemapIndexUrl(`${siteUrl}/sitemap-campaigns-${i}.xml`, now));
        }

        return wrapSitemapIndex(parts);
      },
    );

    return c.body(indexXml, 200, {
      "content-type": "application/xml; charset=utf-8",
      "X-Cache": indexHit ? "HIT" : "MISS",
    });
  }

  const { value: xml, hit: xmlHit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withSeoCacheVersion("sitemap:xml"),
    86400,
    async () => {
      const [makesResult, modelsResult, yearsResult, componentRows, campaignRows] = await Promise.all([
        getMakeRows(c.env.DB),
        getModelRows(c.env.DB),
        getYearRows(c.env.DB),
        getComponentRows(c.env.DB),
        getCampaignRows(c.env.DB),
      ]);

      const now = new Date().toISOString().split("T")[0];
      const urls: string[] = [];

      urls.push(sitemapUrl(`${siteUrl}/`, now, "1.0", "daily"));

      for (const make of makesResult.results) {
        urls.push(sitemapUrl(`${siteUrl}/${make.slug}`, make.lastmod, "0.8", "weekly"));
      }

      for (const m of modelsResult.results) {
        urls.push(sitemapUrl(`${siteUrl}/${m.make_slug}/${m.model_slug}`, m.lastmod, "0.7", "monthly"));
      }

      for (const y of yearsResult.results) {
        urls.push(sitemapUrl(`${siteUrl}/${y.make_slug}/${y.model_slug}/${y.year}`, y.lastmod, "0.9", "weekly"));
      }

      for (const component of componentRows.results) {
        urls.push(
          sitemapUrl(
            `${siteUrl}/${component.make_slug}/${component.model_slug}/${component.year}/${slugify(component.component_name)}`,
            component.lastmod,
            "0.6",
            "monthly",
          ),
        );
      }

      for (const campaign of campaignRows.results) {
        urls.push(sitemapUrl(`${siteUrl}/recall/${campaign.campaign_number}`, campaign.lastmod, "0.5", "monthly"));
      }

      return wrapSitemapUrls(urls);
    },
  );

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "X-Cache": xmlHit ? "HIT" : "MISS" });
});

seoRoutes.get("/sitemap-makes.xml", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const { value: xml, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withSeoCacheVersion("sitemap:makes"),
    86400,
    async () => {
      const makesResult = await getMakeRows(c.env.DB);

      const now = new Date().toISOString().split("T")[0];
      const urls = [sitemapUrl(`${siteUrl}/`, now, "1.0", "daily")];
      for (const make of makesResult.results) {
        urls.push(sitemapUrl(`${siteUrl}/${make.slug}`, make.lastmod, "0.8", "weekly"));
      }
      return wrapSitemapUrls(urls);
    },
  );

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "X-Cache": hit ? "HIT" : "MISS" });
});

seoRoutes.get("/sitemap-models.xml", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const { value: xml, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withSeoCacheVersion("sitemap:models"),
    86400,
    async () => {
      const modelsResult = await getModelRows(c.env.DB);

      const urls = modelsResult.results.map((m) =>
        sitemapUrl(`${siteUrl}/${m.make_slug}/${m.model_slug}`, m.lastmod, "0.7", "monthly"),
      );
      return wrapSitemapUrls(urls);
    },
  );

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "X-Cache": hit ? "HIT" : "MISS" });
});

seoRoutes.get("/sitemap-years-:page{.+\\.xml}", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const page = Math.max(1, Number(c.req.param("page")?.replace(/\.xml$/, "") || "1"));
  const offset = (page - 1) * YEAR_SITEMAP_CHUNK_SIZE;

  const { value: xml, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withSeoCacheVersion(`sitemap:years:${page}`),
    86400,
    async () => {
      const yearsResult = await getYearRows(c.env.DB, YEAR_SITEMAP_CHUNK_SIZE, offset);

      const urls = yearsResult.results.map((y) =>
        sitemapUrl(`${siteUrl}/${y.make_slug}/${y.model_slug}/${y.year}`, y.lastmod, "0.9", "weekly"),
      );
      return wrapSitemapUrls(urls);
    },
  );

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "X-Cache": hit ? "HIT" : "MISS" });
});

seoRoutes.get("/sitemap-components-:page{.+\\.xml}", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const page = Math.max(1, Number(c.req.param("page")?.replace(/\.xml$/, "") || "1"));
  const offset = (page - 1) * COMPONENT_SITEMAP_CHUNK_SIZE;

  const { value: xml, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withSeoCacheVersion(`sitemap:components:${page}`),
    86400,
    async () => {
      const componentsResult = await getComponentRows(c.env.DB, COMPONENT_SITEMAP_CHUNK_SIZE, offset);
      const urls = componentsResult.results.map((component) =>
        sitemapUrl(
          `${siteUrl}/${component.make_slug}/${component.model_slug}/${component.year}/${slugify(component.component_name)}`,
          component.lastmod,
          "0.6",
          "monthly",
        ),
      );

      return wrapSitemapUrls(urls);
    },
  );

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "X-Cache": hit ? "HIT" : "MISS" });
});

seoRoutes.get("/sitemap-campaigns-:page{.+\\.xml}", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const page = Math.max(1, Number(c.req.param("page")?.replace(/\.xml$/, "") || "1"));
  const offset = (page - 1) * CAMPAIGN_SITEMAP_CHUNK_SIZE;

  const { value: xml, hit } = await getCachedOrRender(
    c.env.PAGE_CACHE,
    withSeoCacheVersion(`sitemap:campaigns:${page}`),
    86400,
    async () => {
      const campaignsResult = await getCampaignRows(c.env.DB, CAMPAIGN_SITEMAP_CHUNK_SIZE, offset);
      const urls = campaignsResult.results.map((campaign) =>
        sitemapUrl(`${siteUrl}/recall/${campaign.campaign_number}`, campaign.lastmod, "0.5", "monthly"),
      );

      return wrapSitemapUrls(urls);
    },
  );

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8", "X-Cache": hit ? "HIT" : "MISS" });
});

function sitemapUrl(loc: string, lastmod: string, priority: string, changefreq: string): string {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function sitemapIndexUrl(loc: string, lastmod?: string): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <sitemap>\n    <loc>${loc}</loc>${lastmodTag}\n  </sitemap>`;
}

function wrapSitemapUrls(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

function wrapSitemapIndex(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`;
}

function withSeoCacheVersion(key: string): string {
  return `${SEO_CACHE_VERSION}:${key}`;
}

function getMakeRows(db: D1Database): Promise<D1Result<MakeSitemapRow>> {
  return db
    .prepare(
      `SELECT m.slug,
            COALESCE(date(MAX(vy.last_ingested_at)), date(m.updated_at)) as lastmod
     FROM makes m
     LEFT JOIN models md ON md.make_id = m.id
     LEFT JOIN vehicle_years vy ON vy.model_id = md.id
     GROUP BY m.id, m.slug
     ORDER BY m.slug`,
    )
    .all<MakeSitemapRow>();
}

function getModelRows(db: D1Database): Promise<D1Result<ModelSitemapRow>> {
  return db
    .prepare(
      `SELECT mk.slug as make_slug, m.slug as model_slug,
            COALESCE(date(MAX(vy.last_ingested_at)), date(m.updated_at)) as lastmod
     FROM models m
     JOIN makes mk ON mk.id = m.make_id
     LEFT JOIN vehicle_years vy ON vy.model_id = m.id
     WHERE EXISTS (
       SELECT 1
       FROM vehicle_years recall_year
       JOIN recalls r ON r.vehicle_year_id = recall_year.id
       WHERE recall_year.model_id = m.id
     )
     GROUP BY m.id, mk.slug, m.slug
     ORDER BY mk.slug, m.slug`,
    )
    .all<ModelSitemapRow>();
}

function getModelUrlCount(db: D1Database): Promise<CountRow | null> {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM models m
       WHERE EXISTS (
         SELECT 1
         FROM vehicle_years vy
         JOIN recalls r ON r.vehicle_year_id = vy.id
         WHERE vy.model_id = m.id
       )`,
    )
    .first<CountRow>();
}

function getYearUrlCount(db: D1Database): Promise<CountRow | null> {
  return db
    .prepare(
      `SELECT COUNT(*) as count
       FROM vehicle_years vy
       WHERE EXISTS (SELECT 1 FROM recalls r WHERE r.vehicle_year_id = vy.id)`,
    )
    .first<CountRow>();
}

function getYearRows(db: D1Database, limit?: number, offset?: number): Promise<D1Result<YearSitemapRow>> {
  const query = db.prepare(
    `SELECT mk.slug as make_slug, m.slug as model_slug, vy.year,
            COALESCE(date(vy.last_ingested_at), date(vy.updated_at)) as lastmod
     FROM vehicle_years vy
     JOIN models m ON m.id = vy.model_id
     JOIN makes mk ON mk.id = m.make_id
     WHERE EXISTS (SELECT 1 FROM recalls r WHERE r.vehicle_year_id = vy.id)
     ORDER BY mk.slug, m.slug, vy.year DESC
     ${typeof limit === "number" ? "LIMIT ? OFFSET ?" : ""}`,
  );

  return typeof limit === "number" ? query.bind(limit, offset ?? 0).all<YearSitemapRow>() : query.all<YearSitemapRow>();
}

function getComponentRows(db: D1Database, limit?: number, offset?: number): Promise<D1Result<ComponentSitemapRow>> {
  const query = db.prepare(
    `SELECT mk.slug as make_slug,
            m.slug as model_slug,
            vy.year,
            TRIM(
              CASE
                WHEN INSTR(r.component, ':') > 0 THEN SUBSTR(r.component, 1, INSTR(r.component, ':') - 1)
                ELSE r.component
              END
            ) as component_name,
            COALESCE(date(MAX(vy.last_ingested_at)), date(MAX(vy.updated_at))) as lastmod
     FROM recalls r
     JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
     JOIN models m ON m.id = vy.model_id
     JOIN makes mk ON mk.id = m.make_id
     GROUP BY mk.slug, m.slug, vy.year, component_name
     ORDER BY mk.slug, m.slug, vy.year DESC, component_name
     ${typeof limit === "number" ? "LIMIT ? OFFSET ?" : ""}`,
  );

  return typeof limit === "number"
    ? query.bind(limit, offset ?? 0).all<ComponentSitemapRow>()
    : query.all<ComponentSitemapRow>();
}

function getComponentUrlCount(db: D1Database): Promise<CountRow | null> {
  return db
    .prepare(
      `SELECT COUNT(*) as count
     FROM (
       SELECT vy.id,
              TRIM(
                CASE
                  WHEN INSTR(r.component, ':') > 0 THEN SUBSTR(r.component, 1, INSTR(r.component, ':') - 1)
                  ELSE r.component
                END
              ) as component_name
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       GROUP BY vy.id, component_name
     ) grouped_components`,
    )
    .first<CountRow>();
}

function getCampaignRows(db: D1Database, limit?: number, offset?: number): Promise<D1Result<CampaignSitemapRow>> {
  const query = db.prepare(
    `SELECT r.nhtsa_campaign_number as campaign_number,
            COALESCE(date(r.report_received_date), date(r.updated_at)) as lastmod
     FROM recalls r
     ORDER BY r.nhtsa_campaign_number
     ${typeof limit === "number" ? "LIMIT ? OFFSET ?" : ""}`,
  );

  return typeof limit === "number"
    ? query.bind(limit, offset ?? 0).all<CampaignSitemapRow>()
    : query.all<CampaignSitemapRow>();
}

function getCampaignUrlCount(db: D1Database): Promise<CountRow | null> {
  return db.prepare("SELECT COUNT(*) as count FROM recalls").first<CountRow>();
}

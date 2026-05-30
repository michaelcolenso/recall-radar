import { Hono } from "hono";

import { pageRoutes } from "./routes/pages";
import { apiRoutes } from "./routes/api";
import { adminRoutes } from "./routes/admin";
import { seoRoutes } from "./routes/seo";
import { PipelineAgent } from "./agents/pipeline-agent";
import { IngestionWorkflow } from "./workflows/ingestion-workflow";
import { EnrichmentWorkflow } from "./workflows/enrichment-workflow";
import { ASSET_VERSION, DEFAULT_YEAR_START } from "./lib/constants";

const app = new Hono<{ Bindings: Env }>();

// Global error handler — returns a friendly 500 page for uncaught exceptions
app.onError((err, c) => {
  console.error(JSON.stringify({ message: "unhandled error", path: c.req.path, error: err instanceof Error ? err.message : String(err) }));
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.html(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Something Went Wrong | Recalled Rides</title>
  <meta name="robots" content="noindex, nofollow"/>
  <link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION}"/>
</head>
<body class="rr-layout">
  <nav class="rr-nav"><div class="rr-nav__inner"><a href="/" class="rr-logo"><span class="rr-logo__mark" aria-hidden="true">!</span><span>Recalled Rides</span></a></div></nav>
  <main class="rr-main rr-animate-in" id="main">
    <div class="rr-empty">
      <h1 class="rr-empty__title">Something Went Wrong</h1>
      <p class="rr-empty__text">We couldn't load this page. Please try again in a moment.</p>
      <a href="/" class="rr-empty__action">Browse All Makes</a>
    </div>
  </main>
  <footer class="rr-footer"><div class="rr-footer__inner"><p>Recalled Rides is not affiliated with NHTSA or any vehicle manufacturer.</p></div></footer>
</body>
</html>`,
    500
  );
});

// Security: HSTS, redirect HTTP→HTTPS, www→non-www, trailing-slash canonicalization
app.use(async (c, next) => {
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  const url = new URL(c.req.url);
  if (url.protocol === "http:") {
    return c.redirect(url.href.replace("http:", "https:"), 301);
  }
  if (url.hostname === "www.recalledrides.com") {
    url.hostname = "recalledrides.com";
    return c.redirect(url.toString(), 301);
  }
  const pathname = url.pathname;
  if ((c.req.method === "GET" || c.req.method === "HEAD") && pathname.length > 1 && pathname.endsWith("/")) {
    return c.redirect(pathname.slice(0, -1) + url.search, 301);
  }
  await next();
});

app.route("/api", apiRoutes);
app.route("/", seoRoutes);
app.route("/", adminRoutes);
app.route("/", pageRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      if (event.cron === "0 2 * * 1") {
        // Monday 2 AM UTC — delta ingestion (skips rows checked within the last 6 days)
        await env.INGESTION_WORKFLOW.create({
          params: {
            mode: "delta",
            yearStart: DEFAULT_YEAR_START,
            yearEnd: new Date().getFullYear() + 1,
            deltaThresholdHours: 144,
          },
        });
      }
      if (event.cron === "0 4 * * 1") {
        // Monday 4 AM UTC — enrichment
        await env.ENRICHMENT_WORKFLOW.create({
          params: { batchSize: 100, concurrency: 3 },
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          message: "cron handler failed",
          cron: event.cron,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    }
  },
};

export { PipelineAgent, IngestionWorkflow, EnrichmentWorkflow };

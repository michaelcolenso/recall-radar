import { Hono } from "hono";
import type { Env } from "./env";
import { pageRoutes } from "./routes/pages";
import { apiRoutes } from "./routes/api";
import { seoRoutes } from "./routes/seo";
import { PipelineAgent } from "./agents/pipeline-agent";
import { IngestionWorkflow } from "./workflows/ingestion-workflow";
import { EnrichmentWorkflow } from "./workflows/enrichment-workflow";

const app = new Hono<{ Bindings: Env }>();

app.get("/styles.css", (c) =>
  c.text(
    "body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}.container{max-width:1080px;margin:0 auto;padding:24px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:12px 0}.badge{border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700}.badge-high{background:#fee2e2;color:#991b1b}.badge-medium{background:#ffedd5;color:#9a3412}.badge-low{background:#dcfce7;color:#166534}",
    200,
    { "content-type": "text/css; charset=utf-8" }
  )
);

app.route("/", pageRoutes);
app.route("/", seoRoutes);
app.route("/api", apiRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();
    if (hour === 2) await env.INGESTION_WORKFLOW.create();
    if (hour === 4) await env.ENRICHMENT_WORKFLOW.create();
  }
};

export { PipelineAgent, IngestionWorkflow, EnrichmentWorkflow };

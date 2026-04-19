import { Hono } from "hono";
import type { Env } from "./env";
import { pageRoutes } from "./routes/pages";
import { apiRoutes } from "./routes/api";
import { adminRoutes } from "./routes/admin";
import { seoRoutes } from "./routes/seo";
import { PipelineAgent } from "./agents/pipeline-agent";
import { IngestionWorkflow } from "./workflows/ingestion-workflow";
import { EnrichmentWorkflow } from "./workflows/enrichment-workflow";
import { DEFAULT_YEAR_START } from "./lib/constants";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", apiRoutes);
app.route("/", adminRoutes);
app.route("/", pageRoutes);
app.route("/", seoRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
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
  },
};

export { PipelineAgent, IngestionWorkflow, EnrichmentWorkflow };

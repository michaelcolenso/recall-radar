import { Hono } from "hono";
import type { Env } from "./env";
import { pageRoutes } from "./routes/pages";
import { apiRoutes } from "./routes/api";
import { adminRoutes } from "./routes/admin";
import { seoRoutes } from "./routes/seo";
import { PipelineAgent } from "./agents/pipeline-agent";
import { IngestionWorkflow } from "./workflows/ingestion-workflow";
import { EnrichmentWorkflow } from "./workflows/enrichment-workflow";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", apiRoutes);
app.route("/", adminRoutes);
app.route("/", pageRoutes);
app.route("/", seoRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 2 * * 1") {
      // Monday 2 AM UTC — ingestion
      await env.INGESTION_WORKFLOW.create({
        params: {
          mode: "full",
          yearStart: new Date().getFullYear() - 2,
          yearEnd: new Date().getFullYear() + 1,
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

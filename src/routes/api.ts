import { Hono } from "hono";
import type { Env } from "../env";
import { json } from "../lib/utils";

export const apiRoutes = new Hono<{ Bindings: Env }>();

apiRoutes.post("/admin/run-ingestion", async (c) => {
  if (c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("unauthorized", 401);
  const run = await c.env.INGESTION_WORKFLOW.create();
  return json({ ok: true, workflowId: run.id });
});

apiRoutes.post("/admin/run-enrichment", async (c) => {
  if (c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("unauthorized", 401);
  const run = await c.env.ENRICHMENT_WORKFLOW.create();
  return json({ ok: true, workflowId: run.id });
});

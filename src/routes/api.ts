import { Hono } from "hono";
import type { Env } from "../env";

export const apiRoutes = new Hono<{ Bindings: Env }>();

function requireAuth(c: { req: { header: (k: string) => string | undefined }; text: (t: string, s: number) => Response }, token: string): Response | null {
  const auth = c.req.header("Authorization");
  if (!auth || auth !== `Bearer ${token}`) {
    return c.text("Unauthorized", 401);
  }
  return null;
}

// POST /api/admin/ingest — trigger IngestionWorkflow
apiRoutes.post("/admin/ingest", async (c) => {
  const denied = requireAuth(c, c.env.ADMIN_TOKEN);
  if (denied) return denied;

  const body = await c.req.json<{
    mode?: "full" | "makes-only" | "single-make";
    targetMake?: string;
    yearStart?: number;
    yearEnd?: number;
  }>().catch(() => ({}));

  // Route through PipelineAgent
  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/trigger/ingestion", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }));
  return c.json(await resp.json());
});

// GET /api/admin/ingest/:id — workflow status
apiRoutes.get("/admin/ingest/:id", async (c) => {
  const denied = requireAuth(c, c.env.ADMIN_TOKEN);
  if (denied) return denied;

  const { id } = c.req.param();
  try {
    const instance = await c.env.INGESTION_WORKFLOW.get(id);
    const status = await instance.status();
    return c.json({ id, ...status });
  } catch {
    return c.json({ error: "Workflow not found" }, 404);
  }
});

// POST /api/admin/enrich — trigger EnrichmentWorkflow
apiRoutes.post("/admin/enrich", async (c) => {
  const denied = requireAuth(c, c.env.ADMIN_TOKEN);
  if (denied) return denied;

  const body = await c.req.json<{
    batchSize?: number;
    targetMake?: string;
    concurrency?: number;
  }>().catch(() => ({}));

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/trigger/enrichment", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }));
  return c.json(await resp.json());
});

// GET /api/admin/enrich/:id — workflow status
apiRoutes.get("/admin/enrich/:id", async (c) => {
  const denied = requireAuth(c, c.env.ADMIN_TOKEN);
  if (denied) return denied;

  const { id } = c.req.param();
  try {
    const instance = await c.env.ENRICHMENT_WORKFLOW.get(id);
    const status = await instance.status();
    return c.json({ id, ...status });
  } catch {
    return c.json({ error: "Workflow not found" }, 404);
  }
});

// GET /api/admin/status — agent status
apiRoutes.get("/admin/status", async (c) => {
  const denied = requireAuth(c, c.env.ADMIN_TOKEN);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/status"));
  return c.json(await resp.json());
});

// GET /api/admin/stats — DB stats
apiRoutes.get("/admin/stats", async (c) => {
  const denied = requireAuth(c, c.env.ADMIN_TOKEN);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/stats"));
  return c.json(await resp.json());
});

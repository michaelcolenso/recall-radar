import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

export const apiRoutes = new Hono<{ Bindings: Env }>();

const IngestRequestSchema = z.object({
  mode: z.enum(["full", "makes-only", "single-make", "delta", "backfill"]).default("full"),
  targetMake: z.string().optional(),
  yearStart: z.number().int().optional(),
  yearEnd: z.number().int().optional(),
  deltaThresholdHours: z.number().int().optional(),
});

function requireAuth(c: Context): Response | null {
  const auth = c.req.header("Authorization");
  const token = c.env.ADMIN_TOKEN;
  if (!auth || !token) {
    return c.text("Unauthorized", 401);
  }
  const expected = `Bearer ${token}`;
  if (auth.length !== expected.length) {
    return c.text("Unauthorized", 401);
  }
  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(auth);
  const b = encoder.encode(expected);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  if (mismatch !== 0) {
    return c.text("Unauthorized", 401);
  }
  return null;
}

// POST /api/admin/ingest — trigger IngestionWorkflow
apiRoutes.post("/admin/ingest", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = IngestRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return c.json({ error: parseResult.error.flatten() }, 400);
  }
  const body = parseResult.data;

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
  const denied = requireAuth(c);
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
  const denied = requireAuth(c);
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
  const denied = requireAuth(c);
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
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/status"));
  return c.json(await resp.json());
});

// GET /api/admin/backfill-status — progress of the historical backfill
apiRoutes.get("/admin/backfill-status", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/backfill-status"));
  return c.json(await resp.json());
});

// GET /api/admin/enrichment-stats — enrichment quality & coverage stats
apiRoutes.get("/admin/enrichment-stats", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/enrichment-stats"));
  return c.json(await resp.json());
});

// POST /api/admin/enrich/retry/:id — force re-enrich a specific recall
apiRoutes.post("/admin/enrich/retry/:id", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const recallId = Number(c.req.param("id"));
  if (!recallId || recallId < 1) {
    return c.json({ error: "Invalid recall ID" }, 400);
  }

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/retry-enrichment", {
    method: "POST",
    body: JSON.stringify({ recallId }),
    headers: { "content-type": "application/json" },
  }));
  return c.json(await resp.json());
});

// POST /api/admin/sync — sync workflow statuses
apiRoutes.post("/admin/sync", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/sync", { method: "POST" }));
  return c.json(await resp.json());
});

// POST /api/admin/prune — prune stale active workflows
apiRoutes.post("/admin/prune", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/prune", { method: "POST" }));
  return c.json(await resp.json());
});

// GET /api/admin/stats — DB stats
apiRoutes.get("/admin/stats", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/stats"));
  return c.json(await resp.json());
});

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { scoreAllVehicleYears, scoreAllVehicleYearsForMake } from "../lib/risk-score";

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

// GET /api/search?q=... — Public vehicle search (typeahead)
apiRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") || "").trim();
  if (!q || q.length < 2) {
    return c.json({ results: [] });
  }

  // Limit to 8 results total for fast typeahead
  const searchTerm = `%${q}%`;

  // Search makes directly
  const makesResult = await c.env.DB.prepare(
    `SELECT name, slug, 'make' as type, NULL as make_name, NULL as make_slug, NULL as year
     FROM makes WHERE name LIKE ? ORDER BY name LIMIT 3`,
  ).bind(searchTerm).all<{ name: string; slug: string; type: string; make_name: string | null; make_slug: string | null; year: number | null }>();

  // Search models by name, joined with make
  const modelsResult = await c.env.DB.prepare(
    `SELECT m.name, m.slug, 'model' as type, mk.name as make_name, mk.slug as make_slug, NULL as year
     FROM models m
     JOIN makes mk ON mk.id = m.make_id
     WHERE m.name LIKE ? AND EXISTS (
       SELECT 1 FROM vehicle_years vy
       JOIN recalls r ON r.vehicle_year_id = vy.id
       WHERE vy.model_id = m.id
     )
     ORDER BY m.name LIMIT 5`,
  ).bind(searchTerm).all<{ name: string; slug: string; type: string; make_name: string | null; make_slug: string | null; year: number | null }>();

  // Search years for specific make+model combos
  const yearsResult = await c.env.DB.prepare(
    `SELECT CAST(vy.year AS TEXT) as name, CAST(vy.year AS TEXT) as slug, 'year' as type,
            mk.name as make_name, mk.slug as make_slug, vy.year
     FROM vehicle_years vy
     JOIN models m ON m.id = vy.model_id
     JOIN makes mk ON mk.id = m.make_id
     WHERE EXISTS (SELECT 1 FROM recalls r WHERE r.vehicle_year_id = vy.id)
       AND (mk.name || ' ' || m.name || ' ' || CAST(vy.year AS TEXT)) LIKE ?
     ORDER BY mk.name, m.name, vy.year DESC LIMIT 5`,
  ).bind(searchTerm).all<{ name: string; slug: string; type: string; make_name: string | null; make_slug: string | null; year: number | null }>();

  const results = [...makesResult.results, ...modelsResult.results, ...yearsResult.results].slice(0, 8).map((r) => {
    if (r.type === "make") {
      return { label: r.name, sublabel: "Manufacturer", href: `/${r.slug}` };
    }
    if (r.type === "model") {
      return { label: `${r.make_name} ${r.name}`, sublabel: "Model", href: `/${r.make_slug}/${r.slug}` };
    }
    // year
    return { label: `${r.year} ${r.make_name} ${r.name}`, sublabel: "Vehicle Year", href: `/${r.make_slug}/${r.slug}/${r.year}` };
  });

  return c.json({ results });
});

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

// POST /api/admin/score — trigger risk score recalculation
apiRoutes.post("/admin/score", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const body = await c.req.json().catch(() => ({ makeSlug: undefined })) as { makeSlug?: string };
  const startedAt = Date.now();

  try {
    if (body.makeSlug) {
      const result = await scoreAllVehicleYearsForMake(c.env.DB, body.makeSlug);
      return c.json({
        success: true,
        scopedToMake: body.makeSlug,
        scored: result.scored,
        errors: result.errors.length,
        errorDetails: result.errors.slice(0, 10),
        durationMs: Date.now() - startedAt,
      });
    }

    const result = await scoreAllVehicleYears(c.env.DB);
    return c.json({
      success: true,
      scopedToMake: null,
      scored: result.scored,
      errors: result.errors.length,
      errorDetails: result.errors.slice(0, 10),
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    }, 500);
  }
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

// GET /api/admin/affiliate-stats — clicks by partner/placement, last 30 days
apiRoutes.get("/admin/affiliate-stats", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const since = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();
  const [byPartner, byPlacement, byDay, total] = await Promise.all([
    c.env.DB.prepare(
      "SELECT partner, COUNT(*) as clicks FROM affiliate_clicks WHERE created_at > ? GROUP BY partner ORDER BY clicks DESC",
    ).bind(since).all<{ partner: string; clicks: number }>(),
    c.env.DB.prepare(
      "SELECT partner, placement, COUNT(*) as clicks FROM affiliate_clicks WHERE created_at > ? GROUP BY partner, placement ORDER BY clicks DESC",
    ).bind(since).all<{ partner: string; placement: string; clicks: number }>(),
    c.env.DB.prepare(
      "SELECT date(created_at) as day, COUNT(*) as clicks FROM affiliate_clicks WHERE created_at > ? GROUP BY day ORDER BY day DESC",
    ).bind(since).all<{ day: string; clicks: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM affiliate_clicks").first<{ count: number }>(),
  ]);

  return c.json({
    windowDays: 30,
    totalAllTime: total?.count ?? 0,
    byPartner: byPartner.results,
    byPlacement: byPlacement.results,
    byDay: byDay.results,
  });
});

// GET /api/admin/alerts/stats — subscriber counts, signups, digest health
apiRoutes.get("/admin/alerts/stats", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 3_600_000).toISOString();
  const since30d = new Date(now - 30 * 24 * 3_600_000).toISOString();

  const [byStatus, signups7d, signups30d, topVehicles, lastRuns, sends30d] = await Promise.all([
    c.env.DB.prepare(
      "SELECT status, COUNT(*) as count FROM alert_subscriptions GROUP BY status",
    ).all<{ status: string; count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM alert_subscriptions WHERE created_at > ?",
    ).bind(since7d).first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM alert_subscriptions WHERE created_at > ?",
    ).bind(since30d).first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT mk.name as make, m.name as model, vy.year, COUNT(*) as subscribers
       FROM alert_subscriptions s
       JOIN vehicle_years vy ON vy.id = s.vehicle_year_id
       JOIN models m ON m.id = vy.model_id
       JOIN makes mk ON mk.id = m.make_id
       WHERE s.status = 'active'
       GROUP BY vy.id ORDER BY subscribers DESC LIMIT 10`,
    ).all<{ make: string; model: string; year: number; subscribers: number }>(),
    c.env.DB.prepare(
      "SELECT id, started_at, completed_at, recalls_matched, emails_sent, status, error FROM alert_digest_runs ORDER BY id DESC LIMIT 5",
    ).all(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM alert_sends WHERE sent_at > ?",
    ).bind(since30d).first<{ count: number }>(),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus.results) statusCounts[row.status] = row.count;
  const active = statusCounts["active"] ?? 0;
  const bounced = statusCounts["bounced"] ?? 0;
  const complained = statusCounts["complained"] ?? 0;
  const delivered = active + bounced + complained;

  return c.json({
    byStatus: statusCounts,
    signupsLast7d: signups7d?.count ?? 0,
    signupsLast30d: signups30d?.count ?? 0,
    emailsSentLast30d: sends30d?.count ?? 0,
    // rough proxy until Resend delivery totals are wired in
    bounceRate: delivered > 0 ? bounced / delivered : 0,
    complaintRate: delivered > 0 ? complained / delivered : 0,
    topSubscribedVehicles: topVehicles.results,
    recentDigestRuns: lastRuns.results,
  });
});

// POST /api/admin/alerts/digest — trigger the digest workflow manually
apiRoutes.post("/admin/alerts/digest", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const body = await c.req.json<{ dryRun?: boolean }>().catch(() => ({} as { dryRun?: boolean }));
  const instance = await c.env.ALERT_DIGEST_WORKFLOW.create({
    params: { dryRun: body.dryRun === true },
  });
  return c.json({ ok: true, workflowId: instance.id, dryRun: body.dryRun === true });
});

// GET /api/vin-lookup — Public VIN recall lookup (proxies NHTSA)
apiRoutes.get("/vin-lookup", async (c) => {
  const vin = (c.req.query("vin") || "").trim().toUpperCase();
  if (!vin || vin.length !== 17) {
    return c.json({ error: "Invalid VIN. Please provide a 17-character VIN." }, 400);
  }

  // Validate VIN characters (no I, O, Q)
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return c.json({ error: "Invalid VIN format. VINs do not contain the letters I, O, or Q." }, 400);
  }

  try {
    const res = await fetch(
      `https://api.nhtsa.gov/recalls/recallsByVin?vin=${encodeURIComponent(vin)}`,
      { cf: { cacheTtl: 3600 } },
    );
    if (!res.ok) {
      return c.json({ error: "NHTSA lookup failed. Please try again later." }, 502);
    }
    const data = await res.json() as {
      Count?: number;
      results?: Array<{
        NHTSACampaignNumber: string;
        Component: string;
        Summary: string;
        Consequence: string;
        Remedy: string;
        ReportReceivedDate: string;
      }>;
    };

    const recalls = (data.results || []).map((r) => ({
      campaign: r.NHTSACampaignNumber,
      component: r.Component,
      summary: r.Summary,
      consequence: r.Consequence,
      remedy: r.Remedy,
      date: r.ReportReceivedDate,
    }));

    return c.json({ vin, recalls, count: recalls.length });
  } catch {
    return c.json({ error: "Unable to reach NHTSA. Please try again later." }, 502);
  }
});

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

// POST /api/chat — AI symptom-to-recall matcher
apiRoutes.post("/chat", async (c) => {
  const body = await c.req.json<{ message?: string }>().catch(() => ({ message: "" }));
  const message = (body.message || "").trim();
  if (!message || message.length < 10) {
    return c.json({ reply: "Tell me what's going on with your car — include the make, model, and year plus what you're experiencing. For example: 'My 2018 Honda Civic makes a grinding noise when I turn the steering wheel.'" });
  }

  // ── Step 1: Extract vehicle from message ──────────────────────
  // Try to find a year pattern (2000-2030) and a known make in the message
  const yearMatch = message.match(/\b(20[0-2][0-9])\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  // Find makes that appear in the message
  const words = message.toUpperCase().split(/[^A-Z0-9]+/);
  const makePlaceholders = words.map(() => "?").join(",");
  let makeName: string | null = null;
  let makeSlug: string | null = null;
  let modelName: string | null = null;
  let modelSlug: string | null = null;

  if (words.length > 0) {
    const makeResult = await c.env.DB.prepare(
      `SELECT name, slug FROM makes WHERE UPPER(name) IN (${makePlaceholders}) ORDER BY LENGTH(name) DESC LIMIT 1`
    ).bind(...words).first<{ name: string; slug: string }>();
    if (makeResult) {
      makeName = makeResult.name;
      makeSlug = makeResult.slug;
    }
  }

  // ── Step 2: Fetch matching recalls if vehicle identified ─────
  let recallContext = "";
  let vehicleUrl = "";

  if (makeName && year) {
    // Find models for this make that have recalls for this year
    const modelResult = await c.env.DB.prepare(
      `SELECT m.name, m.slug
       FROM models m
       JOIN vehicle_years vy ON vy.model_id = m.id
       JOIN makes mk ON mk.id = m.make_id
       WHERE mk.slug = ? AND vy.year = ?
       AND EXISTS (SELECT 1 FROM recalls r WHERE r.vehicle_year_id = vy.id)
       ORDER BY m.name LIMIT 20`
    ).bind(makeSlug, year).all<{ name: string; slug: string }>();

    // Try to match a model name from the message
    if (modelResult.results.length > 0) {
      for (const m of modelResult.results) {
        if (message.toUpperCase().includes(m.name.toUpperCase())) {
          modelName = m.name;
          modelSlug = m.slug;
          break;
        }
      }
      // If no explicit model match but there are results, use the first one as context
      if (!modelName && modelResult.results.length === 1) {
        modelName = modelResult.results[0].name;
        modelSlug = modelResult.results[0].slug;
      }

      // Fetch the actual recalls
      if (modelName) {
        vehicleUrl = `/${makeSlug}/${modelSlug}/${year}`;
        const recallsResult = await c.env.DB.prepare(
          `SELECT r.nhtsa_campaign_number, r.component,
                  r.summary_enriched, r.consequence_enriched, r.remedy_enriched,
                  r.summary_raw, r.consequence_raw, r.remedy_raw,
                  r.severity_level, r.report_received_date
           FROM recalls r
           JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
           JOIN models m ON m.id = vy.model_id
           WHERE m.slug = ? AND vy.year = ?
           ORDER BY CASE r.severity_level
             WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5
           END ASC
           LIMIT 10`
        ).bind(modelSlug, year).all<{
          nhtsa_campaign_number: string;
          component: string;
          summary_enriched: string | null;
          consequence_enriched: string | null;
          remedy_enriched: string | null;
          summary_raw: string;
          consequence_raw: string;
          remedy_raw: string;
          severity_level: string;
          report_received_date: string | null;
        }>();

        if (recallsResult.results.length > 0) {
          recallContext = recallsResult.results.map((r, i) => {
            const s = r.summary_enriched ?? r.summary_raw;
            const c = r.consequence_enriched ?? r.consequence_raw;
            return `RECALL #${i + 1} — Campaign ${r.nhtsa_campaign_number}
Component: ${r.component}
Severity: ${r.severity_level}
What happens: ${s}
Risk if unfixed: ${c}
Filed: ${r.report_received_date || "unknown"}`;
          }).join("\n\n");
        }
      } else if (modelResult.results.length > 0) {
        // Multiple models — list them for the LLM to reference
        vehicleUrl = `/${makeSlug}`;
        const modelList = modelResult.results.slice(0, 10).map((m) => m.name).join(", ");
        recallContext = `Multiple ${makeName} models have recalls for ${year}: ${modelList}. The user hasn't specified which model. Ask them to clarify.`;
      }
    }
  } else if (makeName) {
    vehicleUrl = `/${makeSlug}`;
  }

  // ── Step 3: Run LLM matching ──────────────────────────────────
  const systemPrompt = `You are an expert automotive diagnostician helping a car owner. Your job: match the symptoms they describe to known NHTSA safety recalls.

─── RULES ───
1. If a known recall matches their symptoms, explain which campaign it is, what the issue is, what the risk is, and that repairs are FREE at any dealer.
2. If symptoms partially match, tell them it "may be related" and suggest they check with their dealer.
3. If no recall matches, be honest: tell them it doesn't match any known recall, but they should still get it checked by a mechanic. Suggest they check back later as new recalls are announced weekly.
4. NEVER diagnose a problem. You are matching symptoms to known recalls — not offering mechanical advice.
5. NEVER invent recall numbers, dates, or details. Only reference recalls listed in the provided data.
6. Be warm but direct. Use "your vehicle" and "you should."
7. End every response with a clear next step.
8. Keep responses under 250 words. Be concise.

${recallContext ? `─── KNOWN RECALLS FOR THIS VEHICLE ───\n${recallContext}\n─── END RECALL DATA ───` : "─── NOTE ───\nNo specific vehicle was identified. Ask the user for their vehicle's year, make, and model so you can look up relevant recalls."}`;

  try {
    const aiResult = await Promise.race([
      c.env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 400,
      } as unknown as Record<string, unknown>),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 35_000)),
    ]);

    const reply = (aiResult as { response?: string }).response ?? "I had trouble analyzing that. Try describing your vehicle and symptoms again — include the year, make, and model.";

    return c.json({
      reply,
      vehicle: makeName && modelName && year
        ? { make: makeName, model: modelName, year, url: vehicleUrl }
        : makeName ? { make: makeName, url: vehicleUrl } : null,
    });
  } catch {
    return c.json({
      reply: "I'm having trouble connecting right now. Please try again in a moment, or browse recalls directly for your vehicle.",
      vehicle: makeName && modelName && year
        ? { make: makeName, model: modelName, year, url: vehicleUrl }
        : null,
    });
  }
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

// GET /api/admin/stats — DB stats
apiRoutes.get("/admin/stats", async (c) => {
  const denied = requireAuth(c);
  if (denied) return denied;

  const agentId = c.env.PIPELINE_AGENT.idFromName("singleton");
  const agent = c.env.PIPELINE_AGENT.get(agentId);
  const resp = await agent.fetch(new Request("https://internal/stats"));
  return c.json(await resp.json());
});

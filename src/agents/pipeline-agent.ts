import { Agent } from "agents";
import type { Env } from "../env";

interface PipelineState {
  lastIngestionRun: string | null;
  lastEnrichmentRun: string | null;
  activeWorkflows: Array<{
    id: string;
    type: "ingestion" | "enrichment";
    startedAt: string;
    status: string;
  }>;
}

export class PipelineAgent extends Agent<Env, PipelineState> {
  initialState: PipelineState = {
    lastIngestionRun: null,
    lastEnrichmentRun: null,
    activeWorkflows: [],
  };

  async onStart() {
    // Initialize built-in SQLite for run history
    this.sql`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id TEXT NOT NULL,
        type TEXT NOT NULL,
        params TEXT,
        status TEXT NOT NULL DEFAULT 'started',
        result TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      )
    `;
  }

  async triggerIngestion(params: { mode?: string; targetMake?: string; yearStart?: number; yearEnd?: number } = {}) {
    const run = await this.env.INGESTION_WORKFLOW.create({ params });
    const now = new Date().toISOString();

    this.sql`
      INSERT INTO pipeline_runs (workflow_id, type, params, status, started_at)
      VALUES (${run.id}, 'ingestion', ${JSON.stringify(params)}, 'started', ${now})
    `;

    this.setState({
      ...this.state,
      lastIngestionRun: now,
      activeWorkflows: [
        ...this.state.activeWorkflows,
        { id: run.id, type: "ingestion", startedAt: now, status: "started" },
      ],
    });

    return { workflowId: run.id, startedAt: now };
  }

  async triggerEnrichment(params: { batchSize?: number; targetMake?: string; concurrency?: number } = {}) {
    const run = await this.env.ENRICHMENT_WORKFLOW.create({ params });
    const now = new Date().toISOString();

    this.sql`
      INSERT INTO pipeline_runs (workflow_id, type, params, status, started_at)
      VALUES (${run.id}, 'enrichment', ${JSON.stringify(params)}, 'started', ${now})
    `;

    this.setState({
      ...this.state,
      lastEnrichmentRun: now,
      activeWorkflows: [
        ...this.state.activeWorkflows,
        { id: run.id, type: "enrichment", startedAt: now, status: "started" },
      ],
    });

    return { workflowId: run.id, startedAt: now };
  }

  async getStatus() {
    const runs = this.sql`
      SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 10
    `;
    return {
      state: this.state,
      recentRuns: runs,
    };
  }

  async getStats() {
    const [makesRow, modelsRow, yearsRow, recallsRow, enrichedRow] = await Promise.all([
      this.env.DB.prepare("SELECT COUNT(*) as count FROM makes").first<{ count: number }>(),
      this.env.DB.prepare("SELECT COUNT(*) as count FROM models").first<{ count: number }>(),
      this.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years").first<{ count: number }>(),
      this.env.DB.prepare("SELECT COUNT(*) as count FROM recalls").first<{ count: number }>(),
      this.env.DB.prepare("SELECT COUNT(*) as count FROM recalls WHERE enriched_at IS NOT NULL").first<{ count: number }>(),
    ]);

    const totalRecalls = recallsRow?.count ?? 0;
    const enrichedRecalls = enrichedRow?.count ?? 0;

    return {
      makes: makesRow?.count ?? 0,
      models: modelsRow?.count ?? 0,
      vehicleYears: yearsRow?.count ?? 0,
      recalls: totalRecalls,
      enrichmentCoverage: totalRecalls > 0 ? Math.round((enrichedRecalls / totalRecalls) * 100) : 0,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, id: this.ctx.id.toString() });
    }

    if (url.pathname === "/status") {
      return Response.json(await this.getStatus());
    }

    if (url.pathname === "/stats") {
      return Response.json(await this.getStats());
    }

    if (url.pathname === "/trigger/ingestion" && request.method === "POST") {
      const params = await request.json<Parameters<typeof this.triggerIngestion>[0]>().catch(() => ({}));
      return Response.json(await this.triggerIngestion(params));
    }

    if (url.pathname === "/trigger/enrichment" && request.method === "POST") {
      const params = await request.json<Parameters<typeof this.triggerEnrichment>[0]>().catch(() => ({}));
      return Response.json(await this.triggerEnrichment(params));
    }

    return new Response("Not found", { status: 404 });
  }
}

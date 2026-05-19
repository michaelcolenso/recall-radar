import { Agent } from "agents";
import type { IngestionParams } from "../workflows/ingestion-workflow";
import type { EnrichmentParams } from "../workflows/enrichment-workflow";

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

  private async ensureTable() {
    // Use the Agent's storage SQL method
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

  async onStart() {
    await this.ensureTable();
  }

  async triggerIngestion(params: Partial<IngestionParams> = {}) {
    await this.ensureTable();

    const fullParams: IngestionParams = {
      mode: params.mode ?? "full",
      targetMake: params.targetMake,
      yearStart: params.yearStart,
      yearEnd: params.yearEnd,
      deltaThresholdHours: params.deltaThresholdHours,
    };
    const run = await this.env.INGESTION_WORKFLOW.create({ params: fullParams });
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

  async triggerEnrichment(params: Partial<EnrichmentParams> = {}) {
    await this.ensureTable();
    
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
    await this.ensureTable();
    const runs = this.sql`
      SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 10
    `;
    return {
      state: this.state,
      recentRuns: runs,
    };
  }

  /**
   * Poll every active workflow instance and update pipeline_runs with
   * current status + completed_at for terminal runs. Removes terminal
   * entries from activeWorkflows state.
   */
  async syncWorkflowStatuses() {
    await this.ensureTable();
    const active = this.state.activeWorkflows;
    if (active.length === 0) return { synced: 0, updated: 0 };

    const terminalStatuses = new Set(["complete", "errored", "terminated", "cancelled"]);
    const now = new Date().toISOString();
    let synced = 0;
    let updated = 0;

    const remaining: typeof active = [];

    for (const wf of active) {
      try {
        const binding = wf.type === "ingestion"
          ? this.env.INGESTION_WORKFLOW
          : this.env.ENRICHMENT_WORKFLOW;
        const instance = await binding.get(wf.id);
        const status = await instance.status();
        synced++;

        // Update the pipeline_runs row
        this.sql`
          UPDATE pipeline_runs
          SET status = ${status.status ?? "unknown"},
              completed_at = CASE
                WHEN ${terminalStatuses.has(status.status ?? "") ? 1 : 0} = 1
                  AND completed_at IS NULL
                THEN ${now}
                ELSE completed_at
              END
          WHERE workflow_id = ${wf.id}
        `;

        if (terminalStatuses.has(status.status ?? "")) {
          updated++;
        } else {
          remaining.push({ ...wf, status: status.status ?? wf.status });
        }
      } catch {
        // Workflow instance may have expired or been deleted
        remaining.push(wf);
      }
    }

    this.setState({
      ...this.state,
      activeWorkflows: remaining,
    });

    return { synced, updated };
  }

  /**
   * Remove activeWorkflow entries older than `maxAgeDays` (default 7).
   * Stale entries that were never cleaned up by sync won't clog the UI.
   */
  async pruneActiveWorkflows(maxAgeDays = 7) {
    const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
    const pruned = this.state.activeWorkflows.filter((wf) => wf.startedAt >= cutoff);
    const removed = this.state.activeWorkflows.length - pruned.length;

    if (removed > 0) {
      this.setState({
        ...this.state,
        activeWorkflows: pruned,
      });
    }

    return { pruned: removed, remaining: pruned.length };
  }

  async getBackfillStatus() {
    const [totalRow, ingestedRow, recallsRow] = await Promise.all([
      this.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years").first<{ count: number }>(),
      this.env.DB.prepare("SELECT COUNT(*) as count FROM vehicle_years WHERE last_ingested_at IS NOT NULL").first<{ count: number }>(),
      this.env.DB.prepare("SELECT COUNT(*) as count FROM recalls").first<{ count: number }>(),
    ]);
    const total = totalRow?.count ?? 0;
    const ingested = ingestedRow?.count ?? 0;
    const remaining = total - ingested;
    return {
      totalVehicleYears: total,
      ingestedVehicleYears: ingested,
      remainingVehicleYears: remaining,
      recalls: recallsRow?.count ?? 0,
      progressPct: total > 0 ? Math.round((ingested / total) * 100) : 0,
      complete: remaining === 0 && total > 0,
    };
  }

  /**
   * Force re-enrichment of a specific recall by resetting its enriched_at
   * and clearing any resolved failure records.
   */
  async retryEnrichment(recallId: number) {
    const recall = await this.env.DB.prepare(
      "SELECT id, nhtsa_campaign_number FROM recalls WHERE id = ?"
    ).bind(recallId).first<{ id: number; nhtsa_campaign_number: string }>();

    if (!recall) return { error: "Recall not found", id: recallId };

    const now = new Date().toISOString();

    // Clear enriched columns so it's picked up on next enrichment run
    await this.env.DB.prepare(
      `UPDATE recalls SET
         summary_enriched = NULL,
         consequence_enriched = NULL,
         remedy_enriched = NULL,
         enrichment_quality_score = NULL,
         enrichment_model = NULL,
         enriched_at = NULL,
         updated_at = ?
       WHERE id = ?`
    ).bind(now, recallId).run();

    // Reset any failure records so they don't block retry
    await this.env.DB.prepare(
      "UPDATE enrichment_failures SET resolved = 1 WHERE recall_id = ?"
    ).bind(recallId).run();

    return {
      ok: true,
      id: recallId,
      campaign: recall.nhtsa_campaign_number,
      message: "Recall queued for re-enrichment. Trigger enrichment to process.",
    };
  }

  /**
   * Get enrichment quality stats: success rate, quality score distribution,
   * and model usage breakdown.
   */
  async getEnrichmentStats() {
    const [summaryRow, modelRows, failureRow] = await Promise.all([
      this.env.DB.prepare(
        `SELECT
           COUNT(*) as total_recalls,
           COUNT(enriched_at) as enriched,
           COUNT(enriched_at) * 100.0 / MAX(COUNT(*), 1) as coverage_pct,
           AVG(enrichment_quality_score) as avg_quality,
           COUNT(CASE WHEN enrichment_quality_score >= 80 THEN 1 END) as high_quality,
           COUNT(CASE WHEN enrichment_quality_score < 50 THEN 1 END) as low_quality
         FROM recalls`
      ).first<{
        total_recalls: number;
        enriched: number;
        coverage_pct: number;
        avg_quality: number;
        high_quality: number;
        low_quality: number;
      }>(),
      this.env.DB.prepare(
        `SELECT enrichment_model, COUNT(*) as count
         FROM recalls
         WHERE enrichment_model IS NOT NULL
         GROUP BY enrichment_model
         ORDER BY count DESC`
      ).all<{ enrichment_model: string; count: number }>(),
      this.env.DB.prepare(
        `SELECT COUNT(*) as unresolved_failures,
                SUM(attempts) as total_attempts
         FROM enrichment_failures
         WHERE resolved = 0`
      ).first<{ unresolved_failures: number; total_attempts: number }>(),
    ]);

    return {
      coverage: {
        total: summaryRow?.total_recalls ?? 0,
        enriched: summaryRow?.enriched ?? 0,
        pct: Math.round((summaryRow?.coverage_pct ?? 0) * 10) / 10,
      },
      quality: {
        avg: summaryRow?.avg_quality != null ? Math.round(summaryRow.avg_quality) : null,
        highCount: summaryRow?.high_quality ?? 0,
        lowCount: summaryRow?.low_quality ?? 0,
      },
      models: (modelRows?.results ?? []).map((r) => ({
        model: r.enrichment_model,
        count: r.count,
      })),
      failures: {
        unresolved: failureRow?.unresolved_failures ?? 0,
        totalAttempts: failureRow?.total_attempts ?? 0,
      },
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

    if (url.pathname === "/backfill-status") {
      return Response.json(await this.getBackfillStatus());
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      return Response.json(await this.syncWorkflowStatuses());
    }

    if (url.pathname === "/prune" && request.method === "POST") {
      return Response.json(await this.pruneActiveWorkflows());
    }

    if (url.pathname === "/enrichment-stats") {
      return Response.json(await this.getEnrichmentStats());
    }

    if (url.pathname === "/retry-enrichment" && request.method === "POST") {
      const body = await request.json<{ recallId: number }>().catch(() => ({ recallId: 0 }));
      return Response.json(await this.retryEnrichment(body.recallId));
    }

    if (url.pathname === "/trigger/ingestion" && request.method === "POST") {
      await this.pruneActiveWorkflows();
      const params = await request.json<Parameters<typeof this.triggerIngestion>[0]>().catch(() => ({}));
      return Response.json(await this.triggerIngestion(params));
    }

    if (url.pathname === "/trigger/enrichment" && request.method === "POST") {
      await this.pruneActiveWorkflows();
      const params = await request.json<Parameters<typeof this.triggerEnrichment>[0]>().catch(() => ({}));
      return Response.json(await this.triggerEnrichment(params));
    }

    return new Response("Not found", { status: 404 });
  }
}

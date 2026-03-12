export interface Env {
  DB: D1Database;
  PAGE_CACHE: KVNamespace;
  AI: Ai;
  PIPELINE_AGENT: DurableObjectNamespace;
  INGESTION_WORKFLOW: Workflow;
  ENRICHMENT_WORKFLOW: Workflow;
  ADMIN_TOKEN: string;
  WORKERS_AI_MODEL_PRIMARY: string;
  WORKERS_AI_MODEL_FALLBACK: string;
}

type Workflow = {
  create: (options?: unknown) => Promise<{ id: string }>;
};

export type Severity = "high" | "medium" | "low";

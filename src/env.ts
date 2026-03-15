export interface Env {
  DB: D1Database;
  PAGE_CACHE: KVNamespace;
  AI: Ai;
  INGESTION_WORKFLOW: Workflow;
  ENRICHMENT_WORKFLOW: Workflow;
  PIPELINE_AGENT: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  ADMIN_TOKEN: string;
  SITE_URL: string;
  ENVIRONMENT: string;
}

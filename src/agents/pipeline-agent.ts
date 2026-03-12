import type { Env } from "../env";

export class PipelineAgent {
  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, id: this.ctx.id.toString() }), {
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(`PipelineAgent ${this.env.WORKERS_AI_MODEL_PRIMARY}`, { status: 200 });
  }
}

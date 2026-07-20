// Secret bindings (set via `wrangler secret put`, or .dev.vars locally).
// `wrangler types` only emits these when a .dev.vars file exists, so they are
// declared here explicitly; this global interface merges with the generated
// `Env` in worker-configuration.d.ts.
interface Env {
  /** Bearer token for /admin and /api/admin/* */
  ADMIN_TOKEN?: string;
  /** Resend API key for recall-alert emails */
  RESEND_API_KEY?: string;
  /** Svix signing secret (whsec_…) for the Resend bounce/complaint webhook */
  RESEND_WEBHOOK_SECRET?: string;
  /** Cloudflare Turnstile secret for the alert signup form */
  TURNSTILE_SECRET_KEY?: string;
}

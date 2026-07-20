import { Hono } from "hono";
import { z } from "zod";
import { verifyTurnstile } from "../lib/turnstile";
import { sendEmail, confirmEmailTemplate, unsubscribeHeaders } from "../lib/email";
import { alertConfirmedPage, alertUnsubscribedPage, alertErrorPage } from "../templates/alert-pages";

export const alertRoutes = new Hono<{ Bindings: Env }>();

const SIGNUPS_PER_IP_PER_HOUR = 5;
/** Svix timestamp tolerance (seconds) for the Resend webhook. */
const WEBHOOK_TOLERANCE_S = 300;

const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  makeSlug: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/),
  modelSlug: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/),
  year: z.number().int().min(1900).max(2100),
  source: z.string().trim().max(32).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /api/alerts/subscribe
alertRoutes.post("/api/alerts/subscribe", async (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";

  const raw = await c.req.json().catch(() => null);
  const parsed = SubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Please enter a valid email address and vehicle." }, 400);
  }
  const { email, makeSlug, modelSlug, year, source, turnstileToken } = parsed.data;

  if (!c.env.RESEND_API_KEY) {
    return c.json({ error: "Alerts are not available right now. Please try again later." }, 503);
  }

  const ip = c.req.header("CF-Connecting-IP") || "";

  // Bot gate — enforced whenever a Turnstile secret is configured.
  if (c.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken || !(await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, turnstileToken, ip || undefined))) {
      return c.json({ error: "Verification failed. Please refresh the page and try again." }, 400);
    }
  }

  const ipHash = ip ? (await sha256Hex(ip)).slice(0, 24) : null;

  // Fixed-window rate limit: 5 signups per IP per hour.
  if (ipHash) {
    const windowStart = new Date().toISOString().slice(0, 13); // hour bucket
    const row = await c.env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
    )
      .bind(`signup:${ipHash}`, windowStart)
      .first<{ count: number }>();
    if ((row?.count ?? 0) > SIGNUPS_PER_IP_PER_HOUR) {
      return c.json({ error: "Too many signups from your network right now. Please try again in an hour." }, 429);
    }
  }

  const vehicle = await c.env.DB.prepare(
    `SELECT vy.id, mk.name AS make_name, m.name AS model_name, vy.year
     FROM vehicle_years vy
     JOIN models m ON m.id = vy.model_id
     JOIN makes mk ON mk.id = m.make_id
     WHERE mk.slug = ? AND m.slug = ? AND vy.year = ?`,
  )
    .bind(makeSlug, modelSlug, year)
    .first<{ id: number; make_name: string; model_name: string; year: number }>();

  if (!vehicle) {
    return c.json({ error: "We don't track that vehicle yet." }, 404);
  }

  // Permanent suppressions: never send anything to bounced/complained addresses.
  // Respond neutrally so the endpoint can't be used to probe list membership.
  const existing = await c.env.DB.prepare(
    "SELECT id, status, unsub_token FROM alert_subscriptions WHERE email = ? AND vehicle_year_id = ?",
  )
    .bind(email, vehicle.id)
    .first<{ id: number; status: string; unsub_token: string }>();

  if (existing && (existing.status === "bounced" || existing.status === "complained")) {
    return c.json({ ok: true });
  }
  if (existing && existing.status === "active") {
    return c.json({ ok: true });
  }

  const confirmToken = randomToken();
  const unsubToken = existing?.unsub_token ?? randomToken();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO alert_subscriptions (email, vehicle_year_id, status, confirm_token, unsub_token, source, ip_hash, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)
     ON CONFLICT (email, vehicle_year_id) DO UPDATE SET
       status = 'pending',
       confirm_token = excluded.confirm_token,
       source = excluded.source,
       ip_hash = excluded.ip_hash`,
  )
    .bind(email, vehicle.id, confirmToken, unsubToken, source ?? null, ipHash, now)
    .run();

  const vehicleLabel = `${vehicle.year} ${vehicle.make_name} ${vehicle.model_name}`;
  const confirmUrl = `${siteUrl}/api/alerts/confirm?t=${confirmToken}`;
  const unsubUrl = `${siteUrl}/api/alerts/unsubscribe?t=${unsubToken}`;
  const tpl = confirmEmailTemplate({
    vehicleLabel,
    confirmUrl,
    unsubUrl,
    postalAddress: c.env.EMAIL_POSTAL_ADDRESS || "Address on file with our email provider",
    siteUrl,
  });

  const sent = await sendEmail(c.env.RESEND_API_KEY, {
    from: c.env.ALERT_FROM_ADDRESS || "Recalled Rides Alerts <alerts@alerts.recalledrides.com>",
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    headers: unsubscribeHeaders(unsubUrl),
  });

  if (!sent.ok) {
    console.error(JSON.stringify({ message: "confirm email send failed", error: sent.error }));
    return c.json({ error: "We couldn't send the confirmation email. Please try again later." }, 502);
  }

  return c.json({ ok: true });
});

// GET /api/alerts/confirm?t= — double opt-in confirmation
alertRoutes.get("/api/alerts/confirm", async (c) => {
  const pageEnv = { googleVerification: c.env.GOOGLE_SITE_VERIFICATION, analyticsToken: c.env.CF_ANALYTICS_TOKEN };
  const token = c.req.query("t") || "";
  if (!token || token.length > 128) {
    return c.html(alertErrorPage(pageEnv, "This confirmation link is missing its token. Try the link from your email again."), 400);
  }

  const sub = await c.env.DB.prepare(
    `SELECT s.id, s.status, mk.name AS make_name, m.name AS model_name, vy.year
     FROM alert_subscriptions s
     JOIN vehicle_years vy ON vy.id = s.vehicle_year_id
     JOIN models m ON m.id = vy.model_id
     JOIN makes mk ON mk.id = m.make_id
     WHERE s.confirm_token = ?`,
  )
    .bind(token)
    .first<{ id: number; status: string; make_name: string; model_name: string; year: number }>();

  if (!sub || (sub.status !== "pending" && sub.status !== "active")) {
    return c.html(alertErrorPage(pageEnv, "This confirmation link is invalid or has expired. Please sign up again from the vehicle's page."), 404);
  }

  if (sub.status === "pending") {
    await c.env.DB.prepare("UPDATE alert_subscriptions SET status = 'active', confirmed_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), sub.id)
      .run();
  }

  return c.html(alertConfirmedPage(pageEnv, `${sub.year} ${sub.make_name} ${sub.model_name}`));
});

// Unsubscribe — GET renders a page, POST is the RFC 8058 one-click endpoint.
// Both take effect immediately and are idempotent.
async function doUnsubscribe(db: D1Database, token: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE alert_subscriptions SET status = 'unsubscribed', unsubscribed_at = ?
       WHERE unsub_token = ? AND status IN ('pending', 'active')`,
    )
    .bind(new Date().toISOString(), token)
    .run();
  if (result.meta.changes > 0) return true;
  const row = await db.prepare("SELECT id FROM alert_subscriptions WHERE unsub_token = ?").bind(token).first();
  return row !== null;
}

alertRoutes.get("/api/alerts/unsubscribe", async (c) => {
  const pageEnv = { googleVerification: c.env.GOOGLE_SITE_VERIFICATION, analyticsToken: c.env.CF_ANALYTICS_TOKEN };
  const token = c.req.query("t") || "";
  if (!token || token.length > 128) {
    return c.html(alertErrorPage(pageEnv, "This unsubscribe link is missing its token."), 400);
  }
  const known = await doUnsubscribe(c.env.DB, token);
  if (!known) {
    return c.html(alertErrorPage(pageEnv, "This unsubscribe link is invalid. If you keep getting email from us, contact us via the About page."), 404);
  }
  return c.html(alertUnsubscribedPage(pageEnv));
});

alertRoutes.post("/api/alerts/unsubscribe", async (c) => {
  const token = c.req.query("t") || "";
  if (!token || token.length > 128) {
    return c.text("Bad Request", 400);
  }
  await doUnsubscribe(c.env.DB, token);
  // RFC 8058: mail providers POST here with no body semantics we depend on.
  return c.text("OK", 200);
});

// POST /api/webhooks/resend — bounce/complaint suppression (Svix-signed)
alertRoutes.post("/api/webhooks/resend", async (c) => {
  const secret = c.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: "webhook not configured" }, 503);
  }

  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");
  const body = await c.req.text();

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "missing signature headers" }, 401);
  }
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > WEBHOOK_TOLERANCE_S) {
    return c.json({ error: "timestamp outside tolerance" }, 401);
  }
  if (!(await verifySvixSignature(secret, svixId, svixTimestamp, body, svixSignature))) {
    return c.json({ error: "invalid signature" }, 401);
  }

  let event: { type?: string; data?: { to?: string[] | string } };
  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const statusMap: Record<string, string> = {
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  const newStatus = statusMap[event.type ?? ""];
  if (!newStatus) {
    return c.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const recipients = (Array.isArray(event.data?.to) ? event.data.to : [event.data?.to])
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .map((e) => e.toLowerCase());

  let suppressed = 0;
  for (const recipient of recipients) {
    const result = await c.env.DB.prepare(
      `UPDATE alert_subscriptions SET status = ? WHERE email = ? AND status IN ('pending', 'active')`,
    )
      .bind(newStatus, recipient)
      .run();
    suppressed += result.meta.changes;
  }

  return c.json({ ok: true, suppressed });
});

/**
 * Svix signature check: HMAC-SHA256 over `${id}.${timestamp}.${body}` keyed
 * with the base64 secret (after the `whsec_` prefix), base64-encoded, compared
 * against every `v1,<sig>` entry in the header.
 */
async function verifySvixSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  const secretB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(secretB64), (ch) => ch.charCodeAt(0));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  const expectedBytes = new TextEncoder().encode(expected);
  for (const part of signatureHeader.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const sigBytes = new TextEncoder().encode(sig);
    if (sigBytes.length !== expectedBytes.length) continue;
    let mismatch = 0;
    for (let i = 0; i < sigBytes.length; i++) mismatch |= sigBytes[i] ^ expectedBytes[i];
    if (mismatch === 0) return true;
  }
  return false;
}

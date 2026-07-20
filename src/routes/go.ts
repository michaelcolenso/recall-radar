import { Hono } from "hono";
import { getPartner, isPartnerEnabled } from "../lib/affiliates";

export const goRoutes = new Hono<{ Bindings: Env }>();

// GET /go/:partner — first-party affiliate redirect.
// Logs the click to D1 without blocking the redirect, then 302s to the
// partner URL. Disallowed in robots.txt and marked noindex.
goRoutes.get("/go/:partner", (c) => {
  const partnerId = c.req.param("partner").toLowerCase();
  const partner = getPartner(partnerId);

  if (!partner || !isPartnerEnabled(c.env.AFFILIATE_PARTNERS, partnerId)) {
    return c.notFound();
  }

  const vin = (c.req.query("vin") || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17) || undefined;
  const placement = (c.req.query("placement") || "unknown").slice(0, 32);
  const referer = c.req.header("Referer")?.slice(0, 255) ?? null;
  const pagePath = referer ? safePath(referer) : (c.req.query("from") || "").slice(0, 255);

  // No PII: only the first 8 VIN chars (world-manufacturer + descriptor, no serial).
  const vinPrefix = vin ? vin.slice(0, 8) : null;

  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      `INSERT INTO affiliate_clicks (partner, placement, page_path, vin_prefix, referer, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(partner.id, placement, pagePath || "", vinPrefix, referer, new Date().toISOString())
      .run()
      .catch((err) => {
        console.error(JSON.stringify({ message: "affiliate click log failed", error: err instanceof Error ? err.message : String(err) }));
      }),
  );

  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Cache-Control", "no-store");
  return c.redirect(partner.urlTemplate(vin), 302);
});

function safePath(referer: string): string {
  try {
    return new URL(referer).pathname.slice(0, 255);
  } catch {
    return "";
  }
}

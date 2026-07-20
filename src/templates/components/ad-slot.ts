import { escapeHtml } from "../../lib/utils";

interface AdSlotOptions {
  /** AdSense publisher id (ca-pub-…). No client → no markup at all. */
  client?: string;
  /** Optional ad unit slot id from the AdSense dashboard. */
  slot?: string;
}

/**
 * Manual AdSense unit inside a fixed-min-height container (CLS guard).
 * Only rendered on high-content pages (year pages with recalls, campaign
 * pages, stats pages) — never on trust surfaces like the homepage,
 * /vin-lookup, error pages, or alert confirmation pages.
 */
export function adSlot({ client, slot }: AdSlotOptions): string {
  if (!client) return "";
  return `
    <div class="rr-ad" style="min-height: 280px;">
      <ins class="adsbygoogle"
        style="display:block;min-height:280px"
        data-ad-client="${escapeHtml(client)}"
        ${slot ? `data-ad-slot="${escapeHtml(slot)}"` : ""}
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
      <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    </div>
  `;
}

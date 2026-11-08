import { escapeHtml } from "../../lib/utils";
import type { AffiliatePartner, AffiliatePlacement } from "../../lib/affiliates";
import { goPath } from "../../lib/affiliates";

interface VinReportCtaOptions {
  partner: AffiliatePartner;
  variant: AffiliatePlacement;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
}

const DISCLOSURE_MICROCOPY =
  'Partner link — we may earn a commission at no extra cost to you. <a href="/disclosure">Learn more</a>';

/**
 * Vehicle-history-report affiliate CTA. Every link routes through /go/:partner
 * (click logging + central partner swapping) and carries rel="sponsored".
 */
export function vinReportCta({ partner, variant, vin, make, model, year }: VinReportCtaOptions): string {
  const href = goPath(partner.id, variant, vin);
  const vehicle = [year, make, model].filter(Boolean).map((s) => escapeHtml(String(s))).join(" ");

  const headline = vin
    ? "Recalls Are Only Part of the Story"
    : vehicle
      ? `Buying or Selling a ${vehicle}?`
      : "Buying or Selling This Vehicle?";

  const text = vin
    ? `Check title records, accident history &amp; mileage for VIN <code class="rr-aff__vin">${escapeHtml(vin)}</code> with a full vehicle history report.`
    : "A full vehicle history report reveals title problems, past accidents, and odometer rollbacks that recall data alone can't show.";

  const ctaLabel = vin ? "Get the Full History for This VIN →" : "Check This Vehicle's Full History →";

  return `
    <aside class="rr-aff" data-aff-partner="${escapeHtml(partner.id)}">
      <div class="rr-aff__title">${headline}</div>
      <p class="rr-aff__text">${text}</p>
      <a href="${href}" class="rr-aff__cta" rel="sponsored nofollow noopener" target="_blank" data-aff-cta>
        ${ctaLabel}
      </a>
      <p class="rr-aff__disclosure">${DISCLOSURE_MICROCOPY}</p>
    </aside>
  `;
}

/** Compact HTML block for digest emails (inline styles — email clients ignore stylesheets). */
export function vinReportEmailCta(partner: AffiliatePartner, siteUrl: string): string {
  const href = `${siteUrl}${goPath(partner.id, "email")}`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;border-top:1px solid #e4e4e7;">
      <tr><td style="padding:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#52525b;">
        Thinking of selling or checking this vehicle before a purchase?
        <a href="${href}" style="color:#c2410c;font-weight:bold;">Run a full vehicle history report</a>
        (title, accidents &amp; mileage). Partner link — we may earn a commission at no extra cost to you.
      </td></tr>
    </table>
  `;
}

export function buyingUsedCard({ partner, make, model, year, recallCount, placement = "year" }: {partner?: AffiliatePartner;make:string;model:string;year?:string;recallCount:number;placement?:AffiliatePlacement}): string {
 const vehicle=[year,make,model].filter(Boolean).map(v=>escapeHtml(v!)).join(' ');
 return `<aside class="rr-aff rr-buying-used"><h2 class="rr-aff__title">Buying a Used ${vehicle}?</h2><p class="rr-aff__text">NHTSA recall lists don't show whether the previous owner completed these ${recallCount} recall repairs, or whether the car has hidden accident or title damage. Check open recalls by VIN and review its title, accident and odometer history before buying.</p><a href="/vin-lookup" class="rr-btn rr-btn--primary">Check Open Recalls by VIN (Free)</a>${partner ? `<a href="${escapeHtml(goPath(partner.id,placement))}" class="rr-aff__cta" rel="sponsored nofollow noopener" target="_blank">Get Full Vehicle History &amp; Title Report →</a><p class="rr-aff__disclosure">${DISCLOSURE_MICROCOPY}</p>` : ''}</aside>`;
}

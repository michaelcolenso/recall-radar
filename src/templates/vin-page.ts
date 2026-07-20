import { escapeHtml, slugify } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface VinPageOptions {
  vin: string;
  make: string;
  model: string;
  year: number;
  bodyClass: string;
  vehicleType: string;
  recallCount: number;
  topSeverity: SeverityLevel | null;
  cards: string;
  /** Vehicle-history-report affiliate CTA (Phase 1) — shown under the VIN summary. */
  affiliateCtaHtml?: string;
  /** Recall-alert signup card (Phase 2), prefilled from the decoded VIN. */
  alertSignupHtml?: string;
}

export function vinPageTemplate({
  vin,
  make,
  model,
  year,
  bodyClass,
  vehicleType,
  recallCount,
  topSeverity,
  cards,
  affiliateCtaHtml,
  alertSignupHtml,
}: VinPageOptions): string {
  const makeSlug = slugify(make);
  const modelSlug = slugify(model);
  const yearStr = String(year);
  const yearPagePath = `/${makeSlug}/${modelSlug}/${yearStr}`;

  const vehicleDetail =
    [bodyClass, vehicleType].filter(Boolean).join(" · ") || "Vehicle details from NHTSA VIN decoder";

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">
        VIN Lookup: ${yearStr} ${escapeHtml(make)} ${escapeHtml(model)}
      </h1>
      <div class="rr-meta-bar">
        <span class="rr-meta-bar__count">${recallCount} recall${recallCount !== 1 ? "s" : ""}</span>
        ${topSeverity ? `
          <span class="rr-meta-bar__notice">
            <span>Highest severity:</span>
            ${severityBadge(topSeverity)}
          </span>
        ` : ""}
      </div>
      <p class="rr-section-header__body">${escapeHtml(vehicleDetail)}</p>
    </section>

    <section class="rr-vin-summary" style="margin-top: var(--space-12); padding: var(--space-8); background: var(--surface-muted); border-radius: var(--radius-card); border: 1px solid var(--border-subtle);">
      <div class="rr-vin-summary__grid" style="display: flex; flex-wrap: wrap; gap: var(--space-8); align-items: flex-start;">
        <div>
          <div class="rr-label" style="margin-bottom: var(--space-2);">VIN</div>
          <code class="rr-vin-display" style="font-size: var(--text-lg); font-weight: 700; letter-spacing: 0.04em; color: var(--text-primary);">${escapeHtml(vin)}</code>
        </div>
        <div>
          <div class="rr-label" style="margin-bottom: var(--space-2);">Vehicle</div>
          <div style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);">${yearStr} ${escapeHtml(make)} ${escapeHtml(model)}</div>
        </div>
      </div>
    </section>

    ${affiliateCtaHtml ?? ""}

    ${recallCount === 0 ? `
    <section class="rr-good-news" aria-labelledby="good-news-title" style="margin-top: var(--space-16);">
      <svg class="rr-good-news__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
        <circle cx="32" cy="32" r="28" stroke-dasharray="176" stroke-dashoffset="176" style="animation:rr-draw-circle 0.8s var(--ease-mechanical) 0.2s forwards"/>
        <path d="M20 33l8 8 16-16" stroke-dasharray="40" stroke-dashoffset="40" style="animation:rr-draw-path 0.5s var(--ease-mechanical) 0.7s forwards"/>
      </svg>
      <h2 id="good-news-title" class="rr-good-news__title">All Clear</h2>
      <p class="rr-good-news__text">No safety recalls on record for the ${yearStr} ${escapeHtml(make)} ${escapeHtml(model)}.</p>
      <a href="${yearPagePath}" class="rr-empty__action" style="margin-top: var(--space-6); display: inline-block;">View ${yearStr} ${escapeHtml(make)} ${escapeHtml(model)} details →</a>
    </section>
    ` : `
    <section class="rr-readout-list" style="margin-top: var(--space-12);">
      <h2 class="sr-only">Recalls for ${yearStr} ${escapeHtml(make)} ${escapeHtml(model)}</h2>
      ${cards}
    </section>
    `}

    ${recallCount > 0 ? `
    <section class="rr-vin-disclaimer" style="margin-top: var(--space-16); padding: var(--space-6); background: var(--surface-warning); border-radius: var(--radius-card); border: 1px solid var(--border-warning);">
      <p class="rr-body" style="margin: 0; font-size: var(--text-sm);">
        <strong>Note:</strong> These results show <em>all</em> recalls for the ${yearStr} ${escapeHtml(make)} ${escapeHtml(model)}, not specifically for this VIN. Some may have already been repaired. To check which recalls are still open for <em>your</em> vehicle, contact a dealer or visit the <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer">NHTSA recall page</a> with your VIN.
      </p>
    </section>
    ` : ""}

    ${alertSignupHtml ?? ""}

    <section style="margin-top: var(--space-12); padding-top: var(--space-8); border-top: 1px solid var(--border-subtle);">
      <a href="${yearPagePath}" class="rr-empty__action" style="display: inline-flex; align-items: center; gap: var(--space-2);">
        View all ${yearStr} ${escapeHtml(make)} ${escapeHtml(model)} recalls →
      </a>
    </section>
  `;
}

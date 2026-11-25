import { escapeHtml, makeLogoImg, titleCase } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

export interface MakeComponentCampaign {
  nhtsa_campaign_number: string;
  severity_level: SeverityLevel;
  summary: string;
  report_received_date: string | null;
  vehicles: { model_name: string; model_slug: string; year: number }[];
}

const MAX_VEHICLE_LINKS = 12;

interface ComponentStat {
  name: string;
  slug: string;
  count: number;
}

interface MakeComponentPageOptions {
  make: string;
  makeSlug: string;
  component: string;
  componentSlug: string;
  campaigns: MakeComponentCampaign[];
  totalModelYears: number;
  yearRange: string;
  severityBreakdown: Record<SeverityLevel, number>;
  otherComponents: ComponentStat[];
}

export function makeComponentPageTemplate({
  make,
  makeSlug,
  component,
  campaigns,
  totalModelYears,
  yearRange,
  severityBreakdown,
  otherComponents,
}: MakeComponentPageOptions): string {
  const severityOrder: SeverityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
  const severityBars = severityOrder
    .filter((s) => severityBreakdown[s] > 0)
    .map((s) => {
      const count = severityBreakdown[s];
      const pct = Math.round((count / campaigns.length) * 100);
      return `
        <div class="rr-severity-bar" style="--severity-pct: ${pct}%">
          <span class="rr-severity-bar__label">${severityBadge(s)}</span>
          <span class="rr-severity-bar__count">${count}</span>
        </div>
      `;
    })
    .join("");

  const recallRows = campaigns
    .map((r) => {
      const summary = r.summary;
      const shown = r.vehicles.slice(0, MAX_VEHICLE_LINKS);
      const hidden = r.vehicles.length - shown.length;
      const vehicleLinks = shown
        .map((v) => `<a href="/${makeSlug}/${v.model_slug}/${v.year}">${v.year} ${escapeHtml(make)} ${escapeHtml(v.model_name)}</a>`)
        .join(", ");
      return `
        <article class="rr-readout">
          <div class="rr-readout__header">
            <div class="rr-readout__meta">
              <a href="/recall/${r.nhtsa_campaign_number}" class="rr-readout__title-link">Campaign ${r.nhtsa_campaign_number}</a>
              <span class="rr-readout__date">${r.report_received_date ?? "Date unknown"}</span>
            </div>
            ${severityBadge(r.severity_level)}
          </div>
          <div class="rr-readout__body">
            <p>${escapeHtml(summary.slice(0, 200))}${summary.length > 200 ? "…" : ""}</p>
            <p class="rr-body">Affects: ${vehicleLinks}${hidden > 0 ? ` and ${hidden} more model-year${hidden === 1 ? "" : "s"}` : ""}</p>
          </div>
        </article>
      `;
    })
    .join("");

  const otherComponentLinks = otherComponents
    .map(
      (c) => `
        <a href="/${makeSlug}/${c.slug}-recalls" class="rr-card rr-card--year">
          <div class="rr-card__title">${escapeHtml(titleCase(c.name))}</div>
          <div class="rr-card__meta">${c.count} recall${c.count !== 1 ? "s" : ""}</div>
        </a>
      `,
    )
    .join("");

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, make, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(make)} ${escapeHtml(titleCase(component))} Recalls</h1>
      <p class="rr-section-header__subtitle">Complete list of ${escapeHtml(make)} ${escapeHtml(component.toLowerCase())} recalls across all models and years.</p>
    </section>

    <section class="rr-stats-grid" style="margin-bottom: var(--space-16);">
      <div class="rr-stat-card">
        <div class="rr-stat-card__value">${campaigns.length}</div>
        <div class="rr-stat-card__label">Recall Campaigns</div>
      </div>
      <div class="rr-stat-card">
        <div class="rr-stat-card__value">${totalModelYears}</div>
        <div class="rr-stat-card__label">Model-Years Affected</div>
      </div>
      <div class="rr-stat-card">
        <div class="rr-stat-card__value">${escapeHtml(yearRange)}</div>
        <div class="rr-stat-card__label">Year Range</div>
      </div>
    </section>

    <section style="margin-bottom: var(--space-16);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Severity Breakdown</h2>
      <div class="rr-severity-bars">
        ${severityBars || "<p class=\"rr-body\">No severity data available.</p>"}
      </div>
    </section>

    <section class="rr-readout-list">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">All ${escapeHtml(titleCase(component))} Recalls</h2>
      ${recallRows || "<p class='rr-body'>No recalls found.</p>"}
    </section>

    ${otherComponents.length > 0 ? `
      <section style="margin-top: var(--space-20);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Other ${escapeHtml(make)} Recall Categories</h2>
        <div class="rr-grid rr-grid--years">
          ${otherComponentLinks}
        </div>
      </section>
    ` : ""}
  `;
}

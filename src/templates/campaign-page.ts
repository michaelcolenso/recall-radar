import { escapeHtml } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface AffectedVehicle {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: number;
}

interface CampaignPageOptions {
  campaign: string;
  component: string;
  manufacturer: string | null;
  summary: string;
  consequence: string;
  remedy: string;
  severity: SeverityLevel;
  reportReceivedDate: string | null;
  isEnriched: boolean;
  affectedVehicles: AffectedVehicle[];
}

export function campaignPageTemplate({
  campaign,
  component,
  manufacturer,
  summary,
  consequence,
  remedy,
  severity,
  reportReceivedDate,
  isEnriched,
  affectedVehicles,
}: CampaignPageOptions): string {
  const indicator = isEnriched
    ? `<span class="rr-readout__indicator rr-readout__indicator--enriched">Plain English</span>`
    : `<span class="rr-readout__indicator rr-readout__indicator--raw">NHTSA Official Language</span>`;

  const severityClass = severity ? `rr-readout--${severity.toLowerCase()}` : "";

  const vehiclesHtml = affectedVehicles.length > 0
    ? `
      <section style="margin-top: var(--space-20);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Affected Vehicles</h2>
        <div class="rr-grid rr-grid--models">
          ${affectedVehicles.map((v) => `
            <a href="/${v.makeSlug}/${v.modelSlug}/${v.year}" class="rr-card rr-card--model" aria-label="${escapeHtml(String(v.year))} ${escapeHtml(v.make)} ${escapeHtml(v.model)}">
              <div class="rr-card__content">
                <div class="rr-card__title">${escapeHtml(String(v.year))} ${escapeHtml(v.make)} ${escapeHtml(v.model)}</div>
              </div>
            </a>
          `).join("")}
        </div>
      </section>
    `
    : "";

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">Campaign ${escapeHtml(campaign)}</h1>
      <div class="rr-meta-bar">
        ${severityBadge(severity)}
        ${indicator}
        ${reportReceivedDate ? `<span class="rr-readout__date"><time datetime="${escapeHtml(reportReceivedDate)}">${escapeHtml(reportReceivedDate)}</time></span>` : ""}
      </div>
    </section>

    <article class="rr-readout ${severityClass}">
      <div class="rr-readout__header">
        <div class="rr-readout__header-left">
          <span class="rr-readout__campaign">ID: #${escapeHtml(campaign)}</span>
          ${manufacturer ? `<span class="rr-readout__campaign">MFR: ${escapeHtml(manufacturer)}</span>` : ""}
        </div>
      </div>
      <div class="rr-readout__body">
        <div class="rr-readout__field">
          <div class="rr-readout__field-label">Component</div>
          <h3 class="rr-readout__field-value">${escapeHtml(component)}</h3>
        </div>
        <div class="rr-readout__field">
          <div class="rr-readout__field-label">What Happened</div>
          <div class="rr-readout__field-value">${escapeHtml(summary)}</div>
        </div>
        <div class="rr-readout__field">
          <div class="rr-readout__field-label rr-readout__field-label--risk">Risk if Unfixed</div>
          <div class="rr-readout__field-value">${escapeHtml(consequence)}</div>
        </div>
      </div>
      <div class="rr-readout__fix">
        <div class="rr-readout__field-label">Free Fix</div>
        <div class="rr-readout__field-value">${escapeHtml(remedy)}</div>
      </div>
    </article>

    ${vehiclesHtml}
  `;
}

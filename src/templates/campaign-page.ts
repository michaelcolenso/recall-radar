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
  /** Optional H1 naming the affected vehicle/component (used for curated
   *  fresh-campaign pages). Defaults to `Campaign <number>`. */
  heading?: string;
}

// Model-level listings do NOT prove an individual vehicle is affected.
// Always point readers to an authoritative VIN check and say so plainly.
function vinCheckCta(campaign: string): string {
  return `
    <section class="rr-vin-cta">
      <h2 class="rr-vin-cta__title">Is YOUR vehicle affected?</h2>
      <p class="rr-vin-cta__text">
        This page lists the models and model years named in NHTSA campaign #<span class="rr-mono">${escapeHtml(campaign)}</span>.
        Matching a model and year on this list does <strong>not</strong> prove an individual vehicle is
        affected — some vehicles in an affected model year are never part of the recall population.
        The authoritative way to know is a VIN check against NHTSA's own records.
      </p>
      <div class="rr-vin-cta__actions">
        <a href="/vin-lookup" class="rr-hero__cta">Check My VIN — Free</a>
        <a href="https://www.nhtsa.gov/recalls#recall-locator" target="_blank" rel="noopener noreferrer" class="rr-vin-cta__alt">Official NHTSA recall lookup →</a>
      </div>
    </section>
  `;
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
  heading,
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
      <h1 class="rr-section-header__title">${escapeHtml(heading ?? `Campaign ${campaign}`)}</h1>
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
        <h2 class="rr-readout__field-label" style="font-size:var(--text-lg);margin-bottom:var(--space-4);">What This Recall Means</h2>
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
        <h2 class="rr-readout__field-label" style="font-size:var(--text-lg);margin-bottom:var(--space-4);">How to Get This Fixed</h2>
        <div class="rr-readout__field-label" style="margin-top:0;">Free Fix</div>
        <div class="rr-readout__field-value">${escapeHtml(remedy)}</div>
      </div>
    </article>

    ${vehiclesHtml}

    ${vinCheckCta(campaign)}
  `;
}

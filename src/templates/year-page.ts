import { escapeHtml, makeLogoImg } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface RelatedYear {
  year: number;
  recallCount: number;
  isCurrent: boolean;
}

interface ComponentLink {
  name: string;
  slug: string;
  count: number;
}

interface YearPageOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: string;
  recallCount: number;
  topSeverity: SeverityLevel;
  riskGrade: string | null;
  riskScore: number | null;
  cards: string;
  leadGen: string;
  relatedYears?: RelatedYear[];
  components?: ComponentLink[];
}

export function yearPageTemplate({ make, makeSlug, model, modelSlug, year, recallCount, topSeverity, riskGrade, riskScore, cards, leadGen, relatedYears, components }: YearPageOptions): string {
  const componentHtml = components && components.length > 0
    ? `
      <section style="margin-top: var(--space-20);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Browse by Component</h2>
        <div class="rr-grid rr-grid--years">
          ${components.map((comp) => `
            <a href="/${makeSlug}/${modelSlug}/${year}/${comp.slug}" class="rr-card rr-card--year" aria-label="${escapeHtml(comp.name)}: ${comp.count} recall${comp.count !== 1 ? 's' : ''}">
              <div class="rr-card__title">${escapeHtml(comp.name)}</div>
              <div class="rr-card__meta">${comp.count} recall${comp.count !== 1 ? "s" : ""}</div>
            </a>
          `).join("")}
        </div>
      </section>
    `
    : "";

  const relatedHtml = relatedYears && relatedYears.length > 0
    ? `
      <section style="margin-top: var(--space-20);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Other ${escapeHtml(make)} ${escapeHtml(model)} Years</h2>
        <div class="rr-grid rr-grid--years">
          ${relatedYears.map((y) => `
            <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year ${y.isCurrent ? 'rr-card--current' : ''}" aria-label="${y.year}: ${y.recallCount} recall${y.recallCount !== 1 ? 's' : ''}">
              <div class="rr-card__title">${y.year}</div>
              <div class="rr-card__meta">${y.recallCount} recall${y.recallCount !== 1 ? "s" : ""}</div>
            </a>
          `).join("")}
        </div>
      </section>
    `
    : "";

  const riskBadgeHtml = riskGrade
    ? `<span class="rr-risk-badge rr-risk-badge--${riskGrade.charAt(0).toLowerCase()}" title="Risk Score: ${riskScore ?? '—'}/100">Risk Grade: ${escapeHtml(riskGrade)}</span>`
    : "";

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, make, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)}</h1>
      <div class="rr-meta-bar">
        <span class="rr-meta-bar__count">${recallCount} recall${recallCount !== 1 ? "s" : ""}</span>
        ${riskBadgeHtml}
        ${recallCount > 0 ? `
          <span class="rr-meta-bar__notice">
            <span>Highest severity:</span>
            ${severityBadge(topSeverity)}
          </span>
        ` : ""}
      </div>
      ${recallCount > 0 ? `
        <p class="rr-section-header__body">All recalls are free to repair at your local dealership. Contact your dealer to schedule service.</p>
      ` : ""}
    </section>

    <section class="rr-readout-list">
      <h2 class="sr-only">Known Safety Recalls</h2>
      ${cards}
    </section>

    ${leadGen}
    ${componentHtml}
    ${relatedHtml}
  `;
}

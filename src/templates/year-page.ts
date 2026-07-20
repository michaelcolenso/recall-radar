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
  /** Recall-alert email signup card — rendered on every year page. */
  alertSignupHtml?: string;
  relatedYears?: RelatedYear[];
  components?: ComponentLink[];
}

export function yearPageTemplate({ make, makeSlug, model, modelSlug, year, recallCount, topSeverity, riskGrade, riskScore, cards, leadGen, alertSignupHtml, relatedYears, components }: YearPageOptions): string {
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
            <span>Most severe issue:</span>
            ${severityBadge(topSeverity)}
          </span>
        ` : ""}
      </div>
      ${recallCount > 0 ? `
        <p class="rr-section-header__body">All recalls are free to repair at your local dealership. Contact your dealer to schedule service.</p>
      ` : ""}
    </section>

    ${recallCount === 0 ? `
    <section class="rr-good-news" aria-labelledby="good-news-title">
      <svg class="rr-good-news__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
        <circle cx="32" cy="32" r="28" stroke-dasharray="176" stroke-dashoffset="176" style="animation:rr-draw-circle 0.8s var(--ease-mechanical) 0.2s forwards"/>
        <path d="M20 33l8 8 16-16" stroke-dasharray="40" stroke-dashoffset="40" style="animation:rr-draw-path 0.5s var(--ease-mechanical) 0.7s forwards"/>
      </svg>
      <h2 id="good-news-title" class="rr-good-news__title">All Clear</h2>
      <p class="rr-good-news__text">No safety recalls on record for the ${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)}. That's great news — your vehicle has a clean recall history in the NHTSA database.</p>
      ${relatedYears && relatedYears.length > 0 ? `<p class="rr-good-news__text" style="font-size:var(--text-sm);">Check other model years below, or <a href="/${makeSlug}/${modelSlug}">browse all ${escapeHtml(make)} ${escapeHtml(model)} years</a>.</p>` : ""}
    </section>
    ${alertSignupHtml ?? ""}
    ` : `
    <section class="rr-readout-list">
      <h2 class="sr-only">Known Safety Recalls</h2>
      ${cards}
    </section>

    ${alertSignupHtml ?? ""}
    ${leadGen}
    `}
    ${componentHtml}
    ${relatedHtml}
  `;
}

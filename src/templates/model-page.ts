import { escapeHtml, makeLogoImg } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface YearRow {
  year: number;
  recall_count: number;
  risk_grade: string | null;
  risk_score: number | null;
  highest_severity: SeverityLevel | null;
}

export function modelPageTemplate(makeName: string, makeSlug: string, modelName: string, modelSlug: string, years: YearRow[]): string {
  const recallYears = years.filter((y) => y.recall_count > 0);
  const cards = recallYears.map((y) => `
    <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year" aria-label="${y.year}: ${y.recall_count} recall${y.recall_count !== 1 ? 's' : ''}${y.highest_severity ? ', highest severity ' + y.highest_severity.toLowerCase() : ''}">
      <div class="rr-card__title">${y.year}</div>
      ${y.risk_grade ? `<div class="rr-card__risk-grade" style="margin-top: var(--space-4);"><span class="rr-risk-badge rr-risk-badge--${y.risk_grade.charAt(0).toLowerCase()}">${escapeHtml(y.risk_grade)}</span></div>` : ""}
      ${y.highest_severity ? `<div style="margin-top: var(--space-4);">${severityBadge(y.highest_severity)}</div>` : ""}
      <div class="rr-card__meta">${y.recall_count} RECALLS</div>
    </a>
  `).join("");

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, makeName, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(makeName)} ${escapeHtml(modelName)} Recalls by Year</h1>
      <p class="rr-section-header__subtitle">Select a model year to see all safety recalls and issues.</p>
    </section>
    <section>
      <h2 class="rr-label" style="margin-bottom: var(--space-4);">Recall History by Year</h2>
      <div class="rr-grid rr-grid--years">
        ${cards || "<p class='rr-body'>No recall data available for this model yet. <a href='/${makeSlug}'>Browse other ${escapeHtml(makeName)} models</a> or check back soon.</p>"}
      </div>
      <p style="margin-top: var(--space-8);">
        <a href="/stats/${makeSlug}/${modelSlug}" class="rr-back-link">
          View ${escapeHtml(makeName)} ${escapeHtml(modelName)} recall statistics and reliability scorecard →
        </a>
      </p>
    </section>
  `;
}

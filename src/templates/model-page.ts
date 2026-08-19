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

export interface RecentCampaignLink {
  campaign: string;
  component: string;
  severity: SeverityLevel;
  reportReceivedDate: string | null;
  /** Years of this make/model affected by this campaign. */
  years: number[];
}

export function modelPageTemplate(
  makeName: string,
  makeSlug: string,
  modelName: string,
  modelSlug: string,
  years: YearRow[],
  recentCampaigns: RecentCampaignLink[] = [],
): string {
  const recallYears = years.filter((y) => y.recall_count > 0);
  const cards = recallYears.map((y) => `
    <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year" aria-label="${y.year}: ${y.recall_count} recall${y.recall_count !== 1 ? 's' : ''}${y.highest_severity ? ', highest severity ' + y.highest_severity.toLowerCase() : ''}">
      <div class="rr-card__title">${y.year}</div>
      ${y.risk_grade ? `<div class="rr-card__risk-grade" style="margin-top: var(--space-4);"><span class="rr-risk-badge rr-risk-badge--${y.risk_grade.charAt(0).toLowerCase()}">${escapeHtml(y.risk_grade)}</span></div>` : ""}
      ${y.highest_severity ? `<div style="margin-top: var(--space-4);">${severityBadge(y.highest_severity)}</div>` : ""}
      <div class="rr-card__meta">${y.recall_count} RECALLS</div>
    </a>
  `).join("");

  // Newly announced NHTSA campaigns verified for this make/model. Model-level
  // listings never prove an individual VIN is affected — the campaign pages
  // carry the authoritative-VIN disclaimer.
  const recentHtml = recentCampaigns.length > 0
    ? `
    <section class="rr-recent-campaigns">
      <h2 class="rr-label" style="margin-bottom: var(--space-4);">Recent Recalls for ${escapeHtml(makeName)} ${escapeHtml(modelName)}</h2>
      <div class="rr-recent-campaigns__list">
        ${recentCampaigns.map((c) => `
          <article class="rr-recent-campaigns__item">
            ${severityBadge(c.severity)}
            <a href="/recall/${encodeURIComponent(c.campaign)}" class="rr-recent-campaigns__link">
              ${escapeHtml(componentShort(c.component))} (Campaign #${escapeHtml(c.campaign)})
            </a>
            <span class="rr-recent-campaigns__meta">
              Affects ${c.years.length > 0 ? c.years.sort((a, b) => b - a).map((y) => `<a href="/${makeSlug}/${modelSlug}/${y}">${y}</a>`).join(" · ") : "listed model years"}
              ${c.reportReceivedDate ? `· Reported ${escapeHtml(c.reportReceivedDate)}` : ""}
            </span>
          </article>
        `).join("")}
      </div>
    </section>
    `
    : "";

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, makeName, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(makeName)} ${escapeHtml(modelName)} Recalls by Year</h1>
      <p class="rr-section-header__subtitle">Select a model year to see all safety recalls and issues.</p>
    </section>
    ${recentHtml}
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

function componentShort(component: string): string {
  return component.split(":")[0].trim();
}

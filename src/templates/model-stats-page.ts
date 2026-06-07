import { escapeHtml, makeLogoImg } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import { gradeDescription } from "../lib/risk-score";
import type { SeverityLevel } from "../db/schema";

interface YearStat {
  year: number;
  recall_count: number;
  risk_grade: string | null;
  critical_count: number;
  high_count: number;
}

interface ComponentStat {
  name: string;
  count: number;
}

interface SevereRecall {
  year: number;
  nhtsa_campaign_number: string;
  component: string;
  severity_level: SeverityLevel;
  summary: string;
}

interface ModelStatsPageOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  yearStats: YearStat[];
  componentStats: ComponentStat[];
  mostSevereRecalls: SevereRecall[];
  bestYears: YearStat[];
  worstYears: YearStat[];
  brandAvgRecalls: number;
  totalRecalls: number;
}

export function modelStatsPageTemplate({
  make,
  makeSlug,
  model,
  modelSlug,
  yearStats,
  componentStats,
  mostSevereRecalls,
  bestYears,
  worstYears,
  brandAvgRecalls,
  totalRecalls,
}: ModelStatsPageOptions): string {
  const avgRecalls = yearStats.length > 0 ? (totalRecalls / yearStats.length).toFixed(1) : "0";
  const vsBrand = brandAvgRecalls > 0
    ? `${Number(avgRecalls) > brandAvgRecalls ? "Above" : "Below"} brand average (${brandAvgRecalls.toFixed(1)})`
    : "";

  const yearBars = yearStats
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((y) => {
      const maxCount = Math.max(...yearStats.map((s) => s.recall_count), 1);
      const pct = Math.round((y.recall_count / maxCount) * 100);
      return `
        <div class="rr-year-bar" style="--year-bar-pct: ${pct}%">
          <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-year-bar__label">${y.year}</a>
          <div class="rr-year-bar__track"><div class="rr-year-bar__fill"></div></div>
          <span class="rr-year-bar__count">${y.recall_count}</span>
          ${y.risk_grade ? `<span class="rr-year-bar__grade" title="${escapeHtml(gradeDescription(y.risk_grade))}">${y.risk_grade}</span>` : ""}
        </div>
      `;
    })
    .join("");

  const componentBars = componentStats
    .map((c) => {
      const maxCount = Math.max(...componentStats.map((s) => s.count), 1);
      const pct = Math.round((c.count / maxCount) * 100);
      return `
        <div class="rr-comp-bar" style="--comp-bar-pct: ${pct}%">
          <span class="rr-comp-bar__label">${escapeHtml(c.name)}</span>
          <div class="rr-comp-bar__track"><div class="rr-comp-bar__fill"></div></div>
          <span class="rr-comp-bar__count">${c.count}</span>
        </div>
      `;
    })
    .join("");

  const severeRows = mostSevereRecalls
    .map((r) => `
      <article class="rr-readout">
        <div class="rr-readout__header">
          <div class="rr-readout__meta">
            <a href="/${makeSlug}/${modelSlug}/${r.year}" class="rr-readout__title-link">${r.year} ${escapeHtml(make)} ${escapeHtml(model)}</a>
          </div>
          ${severityBadge(r.severity_level)}
        </div>
        <div class="rr-readout__body">
          <p><strong>${escapeHtml(r.component)}</strong> — ${escapeHtml(r.summary.slice(0, 180))}${r.summary.length > 180 ? "…" : ""}</p>
        </div>
        <div class="rr-readout__footer">
          <a href="/recall/${r.nhtsa_campaign_number}">Campaign ${r.nhtsa_campaign_number} →</a>
        </div>
      </article>
    `)
    .join("");

  const bestYearCards = bestYears
    .map((y) => `
      <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year">
        <div class="rr-card__title">${y.year}</div>
        <div class="rr-card__meta">${y.recall_count} recall${y.recall_count !== 1 ? "s" : ""}</div>
        ${y.risk_grade ? `<span class="rr-risk-badge rr-risk-badge--${y.risk_grade.charAt(0).toLowerCase()}">${y.risk_grade}</span>` : ""}
      </a>
    `)
    .join("");

  const worstYearCards = worstYears
    .map((y) => `
      <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year">
        <div class="rr-card__title">${y.year}</div>
        <div class="rr-card__meta">${y.recall_count} recall${y.recall_count !== 1 ? "s" : ""}</div>
        ${y.risk_grade ? `<span class="rr-risk-badge rr-risk-badge--${y.risk_grade.charAt(0).toLowerCase()}">${y.risk_grade}</span>` : ""}
      </a>
    `)
    .join("");

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, make, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(make)} ${escapeHtml(model)} Recall Statistics</h1>
      <p class="rr-section-header__subtitle">Original analysis of recall history, risk grades, and safety trends.</p>
    </section>

    <section class="rr-stats-grid" style="margin-bottom: var(--space-16);">
      <div class="rr-stat-card">
        <div class="rr-stat-card__value">${totalRecalls}</div>
        <div class="rr-stat-card__label">Total Recalls</div>
      </div>
      <div class="rr-stat-card">
        <div class="rr-stat-card__value">${avgRecalls}</div>
        <div class="rr-stat-card__label">Avg per Year ${vsBrand ? `<span class="rr-stat-card__sub">${escapeHtml(vsBrand)}</span>` : ""}</div>
      </div>
      <div class="rr-stat-card">
        <div class="rr-stat-card__value">${yearStats.length}</div>
        <div class="rr-stat-card__label">Years Tracked</div>
      </div>
    </section>

    <section style="margin-bottom: var(--space-16);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Recalls by Year</h2>
      <div class="rr-year-bars">
        ${yearBars || "<p class='rr-body'>No data available.</p>"}
      </div>
    </section>

    <section style="margin-bottom: var(--space-16);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Most Common Components</h2>
      <div class="rr-comp-bars">
        ${componentBars || "<p class='rr-body'>No data available.</p>"}
      </div>
    </section>

    ${severeRows ? `
      <section style="margin-bottom: var(--space-16);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Most Severe Recalls</h2>
        <div class="rr-readout-list">
          ${severeRows}
        </div>
      </section>
    ` : ""}

    ${bestYears.length > 0 ? `
      <section style="margin-bottom: var(--space-16);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Best Years (Fewest Recalls)</h2>
        <div class="rr-grid rr-grid--years">
          ${bestYearCards}
        </div>
      </section>
    ` : ""}

    ${worstYears.length > 0 ? `
      <section style="margin-bottom: var(--space-16);">
        <h2 class="rr-label" style="margin-bottom: var(--space-6);">Worst Years (Most Recalls)</h2>
        <div class="rr-grid rr-grid--years">
          ${worstYearCards}
        </div>
      </section>
    ` : ""}

    <section style="margin-top: var(--space-20);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Browse All ${escapeHtml(make)} ${escapeHtml(model)} Years</h2>
      <div class="rr-grid rr-grid--years">
        ${yearStats.map((y) => `
          <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year">
            <div class="rr-card__title">${y.year}</div>
            <div class="rr-card__meta">${y.recall_count} recall${y.recall_count !== 1 ? "s" : ""}</div>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

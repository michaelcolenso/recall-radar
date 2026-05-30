import { escapeHtml } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface RelatedComponent {
  name: string;
  slug: string;
  count: number;
  isCurrent: boolean;
}

interface RelatedYear {
  year: number;
  recallCount: number;
  isCurrent: boolean;
}

interface RelatedRecall {
  make_name: string;
  make_slug: string;
  model_name: string;
  model_slug: string;
  year: number;
  recall_count: number;
}

interface ComponentPageOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: string;
  component: string;
  recallCount: number;
  topSeverity: SeverityLevel;
  cards: string;
  leadGen: string;
  relatedComponents?: RelatedComponent[];
  relatedYears?: RelatedYear[];
  relatedRecalls?: RelatedRecall[];
}

export function componentPageTemplate({
  make,
  makeSlug,
  model,
  modelSlug,
  year,
  component,
  recallCount,
  topSeverity,
  cards,
  leadGen,
  relatedComponents,
  relatedYears,
  relatedRecalls,
}: ComponentPageOptions): string {
  const relatedCompHtml = relatedComponents && relatedComponents.length > 0
    ? `
      <section style="margin-top: var(--space-16);">
        <h2 class="rr-label" style="margin-bottom: var(--space-4);">Other ${escapeHtml(make)} ${escapeHtml(model)} ${escapeHtml(year)} Recalls</h2>
        <div class="rr-grid rr-grid--years">
          ${relatedComponents.map((c) => `
            <a href="/${makeSlug}/${modelSlug}/${year}/${c.slug}" class="rr-card rr-card--year ${c.isCurrent ? 'rr-card--current' : ''}" aria-label="${escapeHtml(c.name)}: ${c.count} recall${c.count !== 1 ? 's' : ''}">
              <div class="rr-card__title">${escapeHtml(c.name)}</div>
              <div class="rr-card__meta">${c.count} recall${c.count !== 1 ? "s" : ""}</div>
            </a>
          `).join("")}
        </div>
      </section>
    `
    : "";

  const relatedYearHtml = relatedYears && relatedYears.length > 0
    ? `
      <section style="margin-top: var(--space-16);">
        <h2 class="rr-label" style="margin-bottom: var(--space-4);">Other ${escapeHtml(make)} ${escapeHtml(model)} Years</h2>
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

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)} ${escapeHtml(component)} Recalls</h1>
      <div class="rr-meta-bar">
        <span class="rr-meta-bar__count">${recallCount} recall${recallCount !== 1 ? "s" : ""}</span>
        ${recallCount > 0 ? `
          <span class="rr-meta-bar__notice">
            <span>Highest severity:</span>
            ${severityBadge(topSeverity)}
          </span>
        ` : ""}
      </div>
      ${recallCount > 0 ? `
        <p class="rr-section-header__body">All recalls are free to repair at your local dealership. Contact your dealer to schedule service for ${escapeHtml(component)} issues.</p>
      ` : ""}
      <p style="margin-top: var(--space-4);">
        <a href="/${makeSlug}/${modelSlug}/${year}" class="rr-back-link">
          ← View all ${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)} recalls
        </a>
      </p>
    </section>

    <section class="rr-readout-list">
      <h2 class="sr-only">${escapeHtml(component)} Safety Recalls</h2>
      ${cards}
    </section>

    ${leadGen}
    ${relatedCompHtml}
    ${relatedYearHtml}
    ${relatedRecalls && relatedRecalls.length > 0 ? `
    <section style="margin-top: var(--space-20);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Similar ${escapeHtml(component)} Recalls in Other Vehicles</h2>
      <div class="rr-grid rr-grid--models">
        ${relatedRecalls.map((r) => `
          <a href="/${r.make_slug}/${r.model_slug}/${r.year}" class="rr-card rr-card--model" aria-label="${escapeHtml(r.make_name)} ${escapeHtml(r.model_name)} ${r.year}: ${r.recall_count} recall${r.recall_count !== 1 ? 's' : ''}">
            <div class="rr-card__content">
              <div class="rr-card__title">${escapeHtml(String(r.year))} ${escapeHtml(r.make_name)} ${escapeHtml(r.model_name)}</div>
              <div class="rr-card__meta">${r.recall_count} ${escapeHtml(component)} recall${r.recall_count !== 1 ? "s" : ""}</div>
            </div>
          </a>
        `).join("")}
      </div>
    </section>
    ` : ""}
  `;
}

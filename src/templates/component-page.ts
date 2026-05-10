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
}: ComponentPageOptions): string {
  const relatedCompHtml = relatedComponents && relatedComponents.length > 0
    ? `
      <section style="margin-top: var(--space-12);">
        <h2 class="rr-section-header__title">Other ${escapeHtml(make)} ${escapeHtml(model)} ${escapeHtml(year)} Recalls</h2>
        <div class="rr-grid rr-grid--years" style="margin-top: var(--space-6);">
          ${relatedComponents.map((c) => `
            <a href="/${makeSlug}/${modelSlug}/${year}/${c.slug}" class="rr-card rr-card--year ${c.isCurrent ? 'rr-card--current' : ''}">
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
      <section style="margin-top: var(--space-12);">
        <h2 class="rr-section-header__title">Other ${escapeHtml(make)} ${escapeHtml(model)} Years</h2>
        <div class="rr-grid rr-grid--years" style="margin-top: var(--space-6);">
          ${relatedYears.map((y) => `
            <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year ${y.isCurrent ? 'rr-card--current' : ''}">
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
        <a href="/${makeSlug}/${modelSlug}/${year}" class="rr-body" style="text-decoration: underline; text-underline-offset: 2px;">
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
  `;
}

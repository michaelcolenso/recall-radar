import { escapeHtml } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface YearRow {
  year: number;
  recall_count: number;
  highest_severity: SeverityLevel | null;
}

export function modelPageTemplate(makeName: string, makeSlug: string, modelName: string, modelSlug: string, years: YearRow[]): string {
  const cards = years.map((y) => `
    <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year">
      <div class="rr-card__title">${y.year}</div>
      ${y.highest_severity ? `<div class="mt-2">${severityBadge(y.highest_severity)}</div>` : ""}
      <div class="rr-card__meta">${y.recall_count} recall${y.recall_count !== 1 ? "s" : ""}</div>
    </a>
  `).join("");

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">${escapeHtml(makeName)} ${escapeHtml(modelName)} Recalls by Year</h1>
      <p class="rr-section-header__subtitle">Select a model year to see all safety recalls and issues.</p>
    </section>
    <section>
      <div class="rr-grid rr-grid--years">
        ${cards || "<p class='rr-body'>No vehicle years found.</p>"}
      </div>
    </section>
  `;
}

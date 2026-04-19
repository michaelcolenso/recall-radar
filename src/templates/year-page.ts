import { escapeHtml } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface YearPageOptions {
  make: string;
  model: string;
  year: string;
  recallCount: number;
  topSeverity: SeverityLevel;
  cards: string;
  leadGen: string;
}

export function yearPageTemplate({ make, model, year, recallCount, topSeverity, cards, leadGen }: YearPageOptions): string {
  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)} Recalls</h1>
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
        <p class="rr-section-header__body">All recalls are free to repair at your local dealership. Contact your dealer to schedule service.</p>
      ` : ""}
    </section>

    <section class="rr-readout-list">
      ${cards}
    </section>

    ${leadGen}
  `;
}

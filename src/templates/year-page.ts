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

export function yearPageTemplate({
  make,
  model,
  year,
  recallCount,
  topSeverity,
  cards,
  leadGen,
}: YearPageOptions): string {
  return `
    <section class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-4">${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)} Recalls</h1>
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
          ${recallCount} recall${recallCount !== 1 ? "s" : ""} found
        </span>
        ${recallCount > 0 ? `
          <span class="flex items-center gap-2">
            Highest severity: ${severityBadge(topSeverity)}
          </span>
        ` : ""}
      </div>
      ${recallCount > 0 ? `
        <p class="mt-4 text-slate-600">
          All recalls are free to repair at your local dealership. Contact your dealer to schedule service.
        </p>
      ` : ""}
    </section>

    <section class="space-y-4">
      ${cards}
    </section>

    ${leadGen}
  `;
}

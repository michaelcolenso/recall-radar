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
    <a href="/${makeSlug}/${modelSlug}/${y.year}" class="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition">
      <div class="text-2xl font-bold text-slate-800">${y.year}</div>
      ${y.highest_severity ? `<div class="mt-2">${severityBadge(y.highest_severity)}</div>` : ""}
      <div class="text-sm text-slate-500 mt-2">${y.recall_count} recall${y.recall_count !== 1 ? "s" : ""}</div>
    </a>
  `).join("");

  return `
    <section class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">${escapeHtml(makeName)} ${escapeHtml(modelName)} Recalls by Year</h1>
      <p class="text-slate-600">Select a model year to see all safety recalls and issues.</p>
    </section>
    <section>
      <h2 class="text-xl font-semibold text-slate-700 mb-4">Model Years</h2>
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        ${cards || "<p class='text-slate-500'>No vehicle years found.</p>"}
      </div>
    </section>
  `;
}

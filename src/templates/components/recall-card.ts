import { escapeHtml } from "../../lib/utils";
import { severityBadge } from "./severity-badge";
import type { SeverityLevel } from "../../db/schema";

interface RecallView {
  nhtsa_campaign_number: string;
  component: string;
  manufacturer: string | null;
  summary_raw: string;
  consequence_raw: string;
  remedy_raw: string;
  summary_enriched: string | null;
  consequence_enriched: string | null;
  remedy_enriched: string | null;
  severity_level: SeverityLevel;
  report_received_date: string | null;
  enriched_at: string | null;
}

export function recallCard(recall: RecallView): string {
  const isEnriched = !!recall.enriched_at;
  const summary = recall.summary_enriched ?? recall.summary_raw;
  const consequence = recall.consequence_enriched ?? recall.consequence_raw;
  const remedy = recall.remedy_enriched ?? recall.remedy_raw;
  const indicator = isEnriched
    ? `<span class="text-xs text-green-600 font-medium">(Simplified)</span>`
    : `<span class="text-xs text-slate-400">(Original NHTSA language)</span>`;

  return `
  <article class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        ${severityBadge(recall.severity_level)}
        <span class="ml-2 text-sm text-slate-500">Campaign #${escapeHtml(recall.nhtsa_campaign_number)}</span>
        ${indicator}
      </div>
      ${recall.report_received_date ? `<div class="text-xs text-slate-400">${escapeHtml(recall.report_received_date)}</div>` : ""}
    </div>
    <div class="mb-3">
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Component</span>
      <p class="mt-1 text-sm font-medium text-slate-700">${escapeHtml(recall.component)}</p>
    </div>
    ${recall.manufacturer ? `
    <div class="mb-3">
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Manufacturer</span>
      <p class="mt-1 text-sm text-slate-700">${escapeHtml(recall.manufacturer)}</p>
    </div>` : ""}
    <div class="mb-3">
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">What happened</span>
      <p class="mt-1 text-slate-800">${escapeHtml(summary)}</p>
    </div>
    <div class="mb-3">
      <span class="text-xs font-semibold text-red-500 uppercase tracking-wide">Risk if unfixed</span>
      <p class="mt-1 text-slate-800">${escapeHtml(consequence)}</p>
    </div>
    <div class="bg-green-50 border border-green-200 rounded-lg p-3">
      <span class="text-xs font-semibold text-green-700 uppercase tracking-wide">Free Fix</span>
      <p class="mt-1 text-slate-800 text-sm">${escapeHtml(remedy)}</p>
    </div>
  </article>`;
}

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
    ? `<span class="rr-readout__indicator rr-readout__indicator--enriched">Simplified</span>`
    : `<span class="rr-readout__indicator rr-readout__indicator--raw">Original NHTSA Language</span>`;

  return `
  <article class="rr-readout">
    <div class="rr-readout__header">
      <div class="rr-readout__header-left">
        ${severityBadge(recall.severity_level)}
        <span class="rr-readout__campaign">#${escapeHtml(recall.nhtsa_campaign_number)}</span>
        ${indicator}
      </div>
      ${recall.report_received_date ? `<div class="rr-readout__date">${escapeHtml(recall.report_received_date)}</div>` : ""}
    </div>
    <div class="rr-readout__body">
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">Component</div>
        <div class="rr-readout__field-value">${escapeHtml(recall.component)}</div>
      </div>
      ${recall.manufacturer ? `
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">Manufacturer</div>
        <div class="rr-readout__field-value">${escapeHtml(recall.manufacturer)}</div>
      </div>` : ""}
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">What Happened</div>
        <div class="rr-readout__field-value">${escapeHtml(summary)}</div>
      </div>
      <div class="rr-readout__field">
        <div class="rr-readout__field-label rr-readout__field-label--risk">Risk if Unfixed</div>
        <div class="rr-readout__field-value">${escapeHtml(consequence)}</div>
      </div>
    </div>
    <div class="rr-readout__fix">
      <div class="rr-readout__fix-label">Free Fix</div>
      <div class="rr-readout__fix-value">${escapeHtml(remedy)}</div>
    </div>
  </article>`;
}

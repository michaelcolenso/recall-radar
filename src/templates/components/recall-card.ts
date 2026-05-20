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

  const severityClass = recall.severity_level ? `rr-readout--${recall.severity_level.toLowerCase()}` : "";

  const originalToggle = isEnriched
    ? `
      <details class="rr-readout__original">
        <summary class="rr-readout__original-summary">Show original NHTSA language</summary>
        <div class="rr-readout__original-body">
          <div class="rr-readout__field">
            <div class="rr-readout__field-label">Original — What Happened</div>
            <div class="rr-readout__field-value">${escapeHtml(recall.summary_raw)}</div>
          </div>
          <div class="rr-readout__field">
            <div class="rr-readout__field-label">Original — Risk if Unfixed</div>
            <div class="rr-readout__field-value">${escapeHtml(recall.consequence_raw)}</div>
          </div>
          <div class="rr-readout__field">
            <div class="rr-readout__field-label">Original — Remedy</div>
            <div class="rr-readout__field-value">${escapeHtml(recall.remedy_raw)}</div>
          </div>
        </div>
      </details>
    `
    : "";

  const shareUrl = `/recall/${escapeHtml(recall.nhtsa_campaign_number)}`;
  return `
  <article class="rr-readout ${severityClass}">
    <div class="rr-readout__header">
      <div class="rr-readout__header-left">
        ${severityBadge(recall.severity_level)}
        <span class="rr-readout__campaign">#${escapeHtml(recall.nhtsa_campaign_number)}</span>
        ${indicator}
      </div>
      <div class="rr-readout__header-right">
        ${recall.report_received_date ? `<div class="rr-readout__date">${escapeHtml(recall.report_received_date)}</div>` : ""}
        <button class="rr-share-btn" data-share-url="${shareUrl}" title="Share this recall" aria-label="Share this recall">
          <svg class="rr-share-btn__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12 10.5c-.5 0-.9.2-1.2.5L5.5 8.3c0-.1.1-.2.1-.3 0-.1 0-.2-.1-.3l5.3-2.7c.3.3.7.5 1.2.5a1.5 1.5 0 1 0-1.5-1.5c0 .1 0 .2.1.3L5.4 7.3c-.3-.3-.7-.5-1.2-.5a1.5 1.5 0 0 0 0 3c.5 0 .9-.2 1.2-.5l5.3 2.7c0 .1-.1.2-.1.3a1.5 1.5 0 1 0 1.5-1.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="rr-readout__body">
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">Component</div>
        <h3 class="rr-readout__field-value">${escapeHtml(recall.component)}</h3>
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
    ${originalToggle}
  </article>`;
}

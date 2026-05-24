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
    ? `<span class="rr-readout__indicator rr-readout__indicator--enriched">Plain English</span>`
    : `<span class="rr-readout__indicator rr-readout__indicator--raw">NHTSA Official Language</span>`;

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

  const campaignPath = `/recall/${encodeURIComponent(recall.nhtsa_campaign_number)}`;
  const shareUrl = escapeHtml(campaignPath);
  return `
  <article class="rr-readout ${severityClass}">
    <div class="rr-readout__header">
      <div class="rr-readout__header-left">
        ${severityBadge(recall.severity_level)}
        <a class="rr-readout__campaign" href="${shareUrl}">#${escapeHtml(recall.nhtsa_campaign_number)}</a>
        ${indicator}
      </div>
      <div class="rr-readout__header-right">
        ${recall.report_received_date ? `<div class="rr-readout__date">FILED: ${escapeHtml(recall.report_received_date)}</div>` : ""}
        <button class="rr-share-btn" data-share-url="${shareUrl}" title="Share" aria-label="Share">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="rr-readout__body">
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">SYSTEM_COMPONENT</div>
        <h3 class="rr-readout__field-value">${escapeHtml(recall.component)}</h3>
      </div>
      ${recall.manufacturer ? `
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">MANUFACTURER</div>
        <div class="rr-readout__field-value">${escapeHtml(recall.manufacturer)}</div>
      </div>` : ""}
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">EVENT_SUMMARY</div>
        <div class="rr-readout__field-value">${escapeHtml(summary)}</div>
      </div>
      <div class="rr-readout__field">
        <div class="rr-readout__field-label">RISK_ASSESSMENT</div>
        <div class="rr-readout__field-value">${escapeHtml(consequence)}</div>
      </div>
    </div>
    <div class="rr-readout__fix">
      <div class="rr-readout__field-label">RESOLUTION_PROTOCOL</div>
      <div class="rr-readout__field-value">${escapeHtml(remedy)}</div>
    </div>
    ${originalToggle}
    <div class="rr-readout__actions">
      <a href="${shareUrl}" class="rr-readout__detail-link">View full recall details →</a>
      <span class="rr-lead__inline">Repairs are <strong>free</strong> at any authorized dealer. <a href="https://www.nhtsa.gov/recalls#recall-locator" target="_blank" rel="noopener noreferrer">Find a dealer →</a></span>
    </div>
  </article>`;
}

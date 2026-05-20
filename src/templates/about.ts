import { escapeHtml } from "../lib/utils";

export function aboutTemplate(siteUrl: string): string {
  return `
    <section class="rr-hero">
      <span class="rr-hero__marker" aria-hidden="true">DOCUMENT:SYSTEM_OVERVIEW_V1.0</span>
      <h1 class="rr-hero__title">System Overview</h1>
      <p class="rr-hero__subtitle">Plain-English vehicle recall intelligence database.</p>
    </section>

    <section class="rr-body rr-body--large" style="max-width: 680px; margin-top: var(--space-12);">
      <p>Recalled Rides is a high-precision diagnostic tool for vehicle safety. We aggregate complex regulatory data and manufacturer notices into a simplified, actionable interface. Every driver deserves immediate clarity on their vehicle's safety status.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16); text-transform: uppercase; letter-spacing: -0.04em;">01_DATA_ORIGIN</h2>
      <p>All safety records are sourced directly from the <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>. Our database represents an independent mirror of official government safety archives, refreshed on a continuous cycle.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16); text-transform: uppercase; letter-spacing: -0.04em;">02_PROCESSING_LOGIC</h2>
      <p>We apply advanced linguistic processing to translate technical manufacturer specifications into high-clarity summaries. Every simplified record maintains a link to the <span class="rr-mono">RAW_NHTSA_TEXT</span> for verification and audit purposes.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16); text-transform: uppercase; letter-spacing: -0.04em;">03_SYSTEM_METHODOLOGY</h2>
      <ul style="margin-top: var(--space-6); margin-bottom: var(--space-8); padding-left: 0; list-style-type: none;">
        <li style="margin-bottom: var(--space-4); border-left: 3px solid var(--accent); padding-left: var(--space-4);">
          <div class="rr-label">SOURCE_INTEGRITY</div>
          <strong>Verified Data:</strong> Every campaign ID is linked to official public safety records.
        </li>
        <li style="margin-bottom: var(--space-4); border-left: 3px solid var(--accent); padding-left: var(--space-4);">
          <div class="rr-label">TRANSPARENCY_PROTOCOL</div>
          <strong>AI Markers:</strong> Simplified text is explicitly flagged. Original data is never overwritten.
        </li>
        <li style="margin-bottom: var(--space-4); border-left: 3px solid var(--accent); padding-left: var(--space-4);">
          <div class="rr-label">UPDATE_CYCLE</div>
          <strong>Pipeline Frequency:</strong> Automated ingestion cycles execute weekly.
        </li>
      </ul>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16); text-transform: uppercase; letter-spacing: -0.04em;">04_LEGAL_NOTICE</h2>
      <p>Independent repository. Not affiliated with NHTSA or manufacturers. Safety recalls are legally required to be repaired free of charge by authorized dealerships, regardless of warranty status.</p>
    </section>
  `;
}

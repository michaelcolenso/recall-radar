import { escapeHtml } from "../lib/utils";

export function aboutTemplate(siteUrl: string): string {
  return `
    <section class="rr-hero">
      <span class="rr-hero__marker" aria-hidden="true">ABOUT RECALLED RIDES</span>
      <h1 class="rr-hero__title">How Recalled Rides Works</h1>
      <p class="rr-hero__subtitle">We translate complex government safety data into clear, actionable recall information every driver can understand.</p>
    </section>

    <section class="rr-body rr-body--large" style="max-width: 680px; margin-top: var(--space-12);">
      <p>Recalled Rides is a high-precision diagnostic tool for vehicle safety. We aggregate complex regulatory data and manufacturer notices into a simplified, actionable interface. Every driver deserves immediate clarity on their vehicle's safety status.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16);">Where Our Data Comes From</h2>
      <p>All safety records are sourced directly from the <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>, the U.S. government agency responsible for vehicle safety. We update our database weekly to ensure you have the latest recall information.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16);">How We Simplify Recalls</h2>
      <p>We use AI to translate technical manufacturer language into plain-English summaries that anyone can understand. Every simplified record still links back to the original NHTSA text so you can verify the information yourself.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16);">Our Methodology</h2>
      <ul style="margin-top: var(--space-6); margin-bottom: var(--space-8); padding-left: 0; list-style-type: none;">
        <li style="margin-bottom: var(--space-4); border-left: 3px solid var(--accent); padding-left: var(--space-4);">
          <div class="rr-label">Verified Data</div>
          <strong>Official Sources Only:</strong> Every recall links directly to NHTSA public safety records.
        </li>
        <li style="margin-bottom: var(--space-4); border-left: 3px solid var(--accent); padding-left: var(--space-4);">
          <div class="rr-label">Full Transparency</div>
          <strong>Clear Labels:</strong> Simplified text is always marked. Original NHTSA language is never deleted.
        </li>
        <li style="margin-bottom: var(--space-4); border-left: 3px solid var(--accent); padding-left: var(--space-4);">
          <div class="rr-label">Weekly Updates</div>
          <strong>Always Current:</strong> Our database refreshes every week with new recalls and corrections.
        </li>
      </ul>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-16);">Legal Notice</h2>
      <p>Recalled Rides is an independent site and is not affiliated with NHTSA or any vehicle manufacturer. Safety recalls are legally required to be repaired free of charge by authorized dealerships, regardless of warranty status.</p>
    </section>
  `;
}

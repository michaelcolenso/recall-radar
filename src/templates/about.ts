import { escapeHtml } from "../lib/utils";

export function aboutTemplate(siteUrl: string): string {
  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">About RecallRadar</h1>
      <p class="rr-section-header__subtitle">Plain-English vehicle recall information for every driver.</p>
    </section>

    <section class="rr-body rr-body--large" style="max-width: 720px;">
      <p>RecallRadar helps vehicle owners quickly find and understand safety recalls for their specific make, model, and year. We transform complex government recall notices into clear, actionable information so you know what&rsquo;s wrong, why it matters, and how to get it fixed &mdash; for free.</p>

      <h2 class="rr-heading rr-heading--3" style="margin-top: var(--space-10);">Where Our Data Comes From</h2>
      <p>All recall data is sourced directly from the <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>, the official U.S. government agency responsible for vehicle safety. We refresh our database regularly to ensure you&rsquo;re seeing the latest recalls.</p>

      <h2 class="rr-heading rr-heading--3" style="margin-top: var(--space-10);">How It Works</h2>
      <p>We combine official NHTSA data with large language models to simplify technical manufacturer language into plain English. Every recall page shows both the simplified explanation and the original NHTSA text, so you can verify details directly from the source.</p>

      <h2 class="rr-heading rr-heading--3" style="margin-top: var(--space-10);">Our Methodology</h2>
      <p>RecallRadar follows a strict protocol to ensure data integrity and transparency:</p>
      <ul style="margin-top: var(--space-4); margin-bottom: var(--space-6); padding-left: var(--space-6); list-style-type: disc;">
        <li><strong>Official Sourcing:</strong> Every recall ID and raw text string comes directly from NHTSA's public databases.</li>
        <li><strong>AI Transparency:</strong> When we use AI to simplify text, we mark it clearly with a &ldquo;Simplified&rdquo; badge. The original government language is always available on the same page for verification.</li>
        <li><strong>Data Freshness:</strong> Our automated pipeline checks for new NHTSA reports weekly, ensuring critical safety information reaches you quickly.</li>
        <li><strong>No Affiliation:</strong> We maintain complete independence from auto manufacturers to provide unbiased safety summaries.</li>
      </ul>

      <h2 class="rr-heading rr-heading--3" style="margin-top: var(--space-10);">Important Disclaimer</h2>
      <p>RecallRadar is an independent tool and is <strong>not affiliated with NHTSA or any vehicle manufacturer</strong>. Always confirm recall details and repair availability with your local authorized dealer or NHTSA directly.</p>

      <h2 class="rr-heading rr-heading--3" style="margin-top: var(--space-10);">Contact</h2>
      <p>Have feedback or found an issue? Reach out via the footer links or contact your dealer for urgent safety concerns.</p>
    </section>
  `;
}

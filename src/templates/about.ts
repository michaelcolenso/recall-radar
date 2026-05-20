import { escapeHtml } from "../lib/utils";

export function aboutTemplate(siteUrl: string): string {
  return `
    <section class="rr-hero" style="padding-bottom: var(--space-12);">
      <h1 class="rr-hero__title">About Recalled Rides</h1>
      <p class="rr-hero__subtitle">Plain-English vehicle recall information for every driver.</p>
    </section>

    <section class="rr-body rr-body--large" style="max-width: 680px;">
      <p>Recalled Rides helps vehicle owners quickly find and understand safety recalls for their specific make, model, and year. We transform complex government recall notices into clear, actionable information so you know what&rsquo;s wrong, why it matters, and how to get it fixed &mdash; for free.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-12);">Where Our Data Comes From</h2>
      <p>All recall data is sourced directly from the <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>, the official U.S. government agency responsible for vehicle safety. We refresh our database regularly to ensure you&rsquo;re seeing the latest recalls.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-12);">How It Works</h2>
      <p>We combine official NHTSA data with large language models to simplify technical manufacturer language into plain English. Every recall page shows both the simplified explanation and the original NHTSA text, so you can verify details directly from the source.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-12);">Our Methodology</h2>
      <p>Recalled Rides follows a strict protocol to ensure data integrity and transparency:</p>
      <ul style="margin-top: var(--space-4); margin-bottom: var(--space-6); padding-left: var(--space-6); list-style-type: disc;">
        <li><strong>Official Sourcing:</strong> Every recall ID and raw text string comes directly from NHTSA's public databases.</li>
        <li><strong>AI Transparency:</strong> When we use AI to simplify text, we mark it clearly with a &ldquo;Simplified&rdquo; badge. The original government language is always available on the same page for verification.</li>
        <li><strong>Data Freshness:</strong> Our automated pipeline checks for new NHTSA reports weekly, ensuring critical safety information reaches you quickly.</li>
        <li><strong>No Affiliation:</strong> We maintain complete independence from auto manufacturers to provide unbiased safety summaries.</li>
      </ul>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-12);">Important Disclaimer</h2>
      <p>Recalled Rides is an independent tool and is <strong>not affiliated with NHTSA or any vehicle manufacturer</strong>. Always confirm recall details and repair availability with your local authorized dealer or NHTSA directly.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-12);">Contact</h2>
      <p>Have feedback or found an issue? Reach out via the footer links or contact your dealer for urgent safety concerns.</p>

      <h2 class="rr-heading rr-heading--2" style="margin-top: var(--space-12);">Browse Popular Recalls</h2>
      <p>Search recalls by manufacturer:</p>
      <p style="margin-top: var(--space-4); line-height: 2;">
        <a href="/toyota">Toyota</a> &middot;
        <a href="/ford">Ford</a> &middot;
        <a href="/honda">Honda</a> &middot;
        <a href="/chevrolet">Chevrolet</a> &middot;
        <a href="/nissan">Nissan</a> &middot;
        <a href="/jeep">Jeep</a> &middot;
        <a href="/bmw">BMW</a> &middot;
        <a href="/dodge">Dodge</a> &middot;
        <a href="/hyundai">Hyundai</a> &middot;
        <a href="/kia">Kia</a> &middot;
        <a href="/subaru">Subaru</a> &middot;
        <a href="/volkswagen">Volkswagen</a> &middot;
        <a href="/tesla">Tesla</a> &middot;
        <a href="/mercedes-benz">Mercedes-Benz</a> &middot;
        <a href="/audi">Audi</a>
      </p>
      <p style="margin-top: var(--space-6);"><a href="/">View all makes &rarr;</a></p>
    </section>
  `;
}

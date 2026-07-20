import { escapeHtml } from "../lib/utils";
import { AFFILIATE_PARTNERS, getEnabledPartners } from "../lib/affiliates";

export function privacyPageTemplate(siteUrl: string): string {
  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">Privacy Policy</h1>
      <p class="rr-section-header__subtitle">What Recalled Rides collects, what it doesn't, and how the little we do collect is used.</p>
    </section>

    <section class="rr-prose" style="max-width: 720px; margin-bottom: var(--space-16);">
      <h2>The short version</h2>
      <p>Recalled Rides is a free vehicle-recall lookup site. You can use every page without creating an account or giving us any personal information. We collect data in exactly three situations, all described below.</p>

      <h2>1. VIN lookups — not stored</h2>
      <p>When you check a VIN, the number is passed directly to the U.S. National Highway Traffic Safety Administration (NHTSA) API to fetch recall results. We do not log, store, or share your VIN, and VIN lookups are not tied to you in any way.</p>

      <h2>2. Recall alert subscriptions</h2>
      <p>If you sign up for recall alerts, we store your email address, the vehicle you subscribed to, and a hashed (irreversible) fingerprint of your IP address used only to prevent abuse of the signup form. We use your email address exclusively to:</p>
      <ul>
        <li>send a one-time confirmation message (we never email anyone who hasn't confirmed), and</li>
        <li>notify you when a new safety recall is issued for the vehicle you chose.</li>
      </ul>
      <p>We never sell, rent, or share subscriber emails. Every email includes a one-click unsubscribe link, honored immediately. Unconfirmed signups are deleted after 7 days. Emails are delivered through <a href="https://resend.com" rel="noopener" target="_blank">Resend</a>, our email service provider, which processes the address solely to deliver our messages. The signup form is protected by Cloudflare Turnstile, which may process technical browser signals to distinguish humans from bots.</p>

      <h2>3. Partner link clicks</h2>
      <p>Some pages contain clearly labeled partner links to vehicle-history-report providers (see our <a href="/disclosure">affiliate disclosure</a>). When you click one, we record which partner was clicked, the page it was clicked on, and — for VIN pages — the first 8 characters of the VIN (which identify the vehicle line, not your specific vehicle). No name, email, IP address, or full VIN is stored with click records.</p>

      <h2>Analytics &amp; cookies</h2>
      <p>We use Cloudflare Web Analytics, a privacy-first tool that does not use cookies, does not fingerprint devices, and does not track you across sites. Recalled Rides sets no advertising or tracking cookies of its own. If we display ads in the future, the ad network's own policies will apply and this page will be updated first.</p>

      <h2>Data requests &amp; deletion</h2>
      <p>To unsubscribe, use the link in any alert email — it works instantly. To have your email address removed entirely from our records, or for any other privacy question, contact us via the address on our <a href="/about">About page</a>.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the new version will be posted at <a href="${siteUrl}/privacy">${siteUrl}/privacy</a> with an updated date.</p>
      <p><em>Last updated: July 2026</em></p>
    </section>
  `;
}

export function disclosurePageTemplate(affiliatePartnersEnv: string | undefined): string {
  const enabled = getEnabledPartners(affiliatePartnersEnv);
  const partnerList = (enabled.length > 0 ? enabled : AFFILIATE_PARTNERS)
    .map((p) => `<li>${escapeHtml(p.name)}</li>`)
    .join("");

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">Affiliate Disclosure</h1>
      <p class="rr-section-header__subtitle">How Recalled Rides makes money, in plain English.</p>
    </section>

    <section class="rr-prose" style="max-width: 720px; margin-bottom: var(--space-16);">
      <p>Recalled Rides is free to use. All recall data comes from the U.S. National Highway Traffic Safety Administration (NHTSA) and always will be free — recall repairs themselves are free at franchised dealers by federal law, and we will never charge you or take a cut for telling you that.</p>

      <p>To keep the site running, some pages include <strong>partner links</strong> to third-party vehicle-history-report services. If you click one of these links and make a purchase, we may earn a commission <strong>at no additional cost to you</strong>. This is the disclosure required by the U.S. Federal Trade Commission's Endorsement Guides (16&nbsp;CFR&nbsp;Part&nbsp;255).</p>

      <h2>What to expect</h2>
      <ul>
        <li>Partner links are always labeled ("Partner link — we may earn a commission").</li>
        <li>Partner links never influence the recall data we show. Recall listings, severity ratings, and risk grades are generated from NHTSA data alone.</li>
        <li>Vehicle history reports are a paid product sold by the partner, not by us. Recall information is free here and at <a href="https://www.nhtsa.gov/recalls" rel="noopener" target="_blank">nhtsa.gov/recalls</a>.</li>
      </ul>

      <h2>Current partners</h2>
      <ul>${partnerList}</ul>

      <p>Questions? Reach us via the <a href="/about">About page</a>.</p>
      <p><em>Last updated: July 2026</em></p>
    </section>
  `;
}

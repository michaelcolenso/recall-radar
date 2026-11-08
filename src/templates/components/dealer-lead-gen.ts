export function dealerLeadGen(makeSlug?: string): string {
  return `
    <aside class="rr-lead">
      <div class="rr-lead__title">Recall Repairs Are Always Free</div>
      <p class="rr-lead__text">Federal law requires dealers to fix safety recalls at no cost to you — even if your warranty has expired.</p>
      <a href="${makeSlug ? `/dealers/${encodeURIComponent(makeSlug)}` : "/vin-lookup"}" target="_blank" rel="noopener noreferrer" class="rr-lead__cta">Find an Authorized Dealer Near You →</a>
    </aside>
  `;
}

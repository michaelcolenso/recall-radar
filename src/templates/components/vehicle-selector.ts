import { escapeHtml } from '../../lib/utils';
export function vehicleSelector(makes: {name:string;slug:string}[]): string {
 return `<div class="rr-vehicle-selector">
 <div role="tablist" aria-label="Recall lookup method"><button type="button" role="tab" id="vehicle-tab" aria-controls="vehicle-panel" aria-selected="true">By Vehicle</button><button type="button" role="tab" id="keyword-tab" aria-controls="keyword-panel" aria-selected="false" tabindex="-1">By VIN or Keyword</button></div>
 <form id="vehicle-panel" role="tabpanel" aria-labelledby="vehicle-tab" action="/search" method="get">
 <label>Make <select id="vehicle-make" required><option value="">Select make</option>${makes.map(m=>`<option value="${escapeHtml(m.slug)}">${escapeHtml(m.name)}</option>`).join('')}</select></label>
 <label>Model <select id="vehicle-model" required disabled><option value="">Select model</option></select></label>
 <label>Year <select id="vehicle-year" required disabled><option value="">Select year</option></select></label>
 <button type="submit" class="rr-btn rr-btn--primary" disabled>Check Recalls →</button><p id="vehicle-status" role="status"></p></form>
 <form id="keyword-panel" role="tabpanel" aria-labelledby="keyword-tab" action="/search" method="get" hidden>
 <label for="rr-global-search">VIN or make, model and year</label><div class="rr-hero__search-wrap"><input id="rr-global-search" name="q" class="rr-hero__search" placeholder="17-character VIN or 2023 Honda Accord" autocomplete="off" required><div id="rr-global-search-results" class="rr-hero__search-results" hidden></div></div><button class="rr-btn rr-btn--primary">Search →</button></form>
 <noscript><p><a href="/vin-lookup">Check by VIN</a> or browse makes below.</p><form action="/search"><label>Vehicle <input name="q" required></label><button>Search</button></form></noscript></div><script src="/vehicle-selector.js" defer></script>`;
}

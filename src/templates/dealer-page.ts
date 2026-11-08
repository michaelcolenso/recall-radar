import { escapeHtml } from '../lib/utils';
import { officialRecallUrl, recallServiceDetails } from '../lib/dealers';
export function dealerPageTemplate(make:string,makeSlug:string,campaign?:string,remedy=''): string {
 const {phone,code}=recallServiceDetails(remedy),official=officialRecallUrl(makeSlug);
 return `<section class="rr-section-header"><h1>Arrange a ${escapeHtml(make)} Recall Repair</h1><p>Have your VIN ready. Ask an authorized dealer to confirm your vehicle is affected and whether the free repair is available.</p></section>
 ${campaign ? `<p>NHTSA campaign: <strong>${escapeHtml(campaign)}</strong>${code ? ` · OEM recall: <strong>${escapeHtml(code)}</strong>` : ''}</p>` : ''}
 ${phone ? `<p>Customer service number in this filing: <a href="tel:${phone.replace(/\D/g,'')}">${escapeHtml(phone)}</a></p>` : ''}
 ${official ? `<p><a class="rr-btn rr-btn--primary" href="${escapeHtml(official)}" rel="noopener noreferrer" target="_blank">Official ${escapeHtml(make)} Recall &amp; Service Page →</a></p>` : ''}
 <p><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(make+' authorized dealer near me')}" rel="noopener noreferrer" target="_blank">Find a local authorized ${escapeHtml(make)} dealer →</a></p>
 <p>Bring your VIN and recall campaign number. Ask for a repair order confirming completed work. Check any do-not-drive or park-outside instructions in the original filing.</p>${remedy ? `<details><summary>Original NHTSA repair instructions</summary><p>${escapeHtml(remedy)}</p></details>` : ''}`;
}

import { segmentCompetitors, type Competitor } from "../../lib/vehicle-segments";
import { escapeHtml, slugify } from "../../lib/utils";

interface RelatedLinksOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: string;
  competitors?: Competitor[];
}

export function relatedLinks({ make, makeSlug, model, modelSlug, year, competitors: verifiedCompetitors }: RelatedLinksOptions): string {
  const links: string[] = [];

  // Compare to competitors
  const competitors = (verifiedCompetitors ?? segmentCompetitors(makeSlug, modelSlug)).slice(0,3);
  if (competitors) {
    for (const comp of competitors) {
      links.push(`<a href="/${comp.makeSlug}/${comp.modelSlug}/${year}" class="rr-related-link">${escapeHtml(year)} ${escapeHtml(comp.name)} Recalls</a>`);
    }
  }

  // Previous / next year comparison
  const yearNum = Number(year);
  if (!isNaN(yearNum)) {
    links.push(`<a href="/${makeSlug}/${modelSlug}/${yearNum - 1}" class="rr-related-link">${yearNum - 1} ${escapeHtml(make)} ${escapeHtml(model)} Recalls</a>`);
    links.push(`<a href="/${makeSlug}/${modelSlug}/${yearNum + 1}" class="rr-related-link">${yearNum + 1} ${escapeHtml(make)} ${escapeHtml(model)} Recalls</a>`);
  }

  // Make/model hubs (future pages, but links are valid now as make/model pages)
  links.push(`<a href="/${makeSlug}" class="rr-related-link">All ${escapeHtml(make)} Recalls</a>`);
  links.push(`<a href="/${makeSlug}/${modelSlug}" class="rr-related-link">${escapeHtml(make)} ${escapeHtml(model)} Recall History</a>`);

  if (links.length === 0) return "";

  return `
    <section style="margin-top: var(--space-20);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Related Pages</h2>
      <div class="rr-related-links">
        ${links.join("\n        ")}
      </div>
    </section>
  `;
}

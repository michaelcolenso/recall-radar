import { escapeHtml, slugify } from "../../lib/utils";

interface RelatedLinksOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: string;
}

// Hardcoded top competitors by class (make/model slug pairs)
// This is a lightweight seed list; can be expanded or made data-driven in future phases.
const COMPETITOR_MAP: Record<string, Array<{ makeSlug: string; modelSlug: string; name: string }>> = {
  "toyota": [
    { makeSlug: "honda", modelSlug: "accord", name: "Honda Accord" },
    { makeSlug: "nissan", modelSlug: "altima", name: "Nissan Altima" },
  ],
  "honda": [
    { makeSlug: "toyota", modelSlug: "camry", name: "Toyota Camry" },
    { makeSlug: "nissan", modelSlug: "altima", name: "Nissan Altima" },
  ],
  "ford": [
    { makeSlug: "chevrolet", modelSlug: "silverado", name: "Chevrolet Silverado" },
    { makeSlug: "ram", modelSlug: "1500", name: "Ram 1500" },
  ],
  "chevrolet": [
    { makeSlug: "ford", modelSlug: "f-150", name: "Ford F-150" },
    { makeSlug: "ram", modelSlug: "1500", name: "Ram 1500" },
  ],
  "nissan": [
    { makeSlug: "toyota", modelSlug: "camry", name: "Toyota Camry" },
    { makeSlug: "honda", modelSlug: "accord", name: "Honda Accord" },
  ],
  "hyundai": [
    { makeSlug: "kia", modelSlug: "optima", name: "Kia Optima" },
    { makeSlug: "toyota", modelSlug: "camry", name: "Toyota Camry" },
  ],
  "kia": [
    { makeSlug: "hyundai", modelSlug: "sonata", name: "Hyundai Sonata" },
    { makeSlug: "toyota", modelSlug: "camry", name: "Toyota Camry" },
  ],
  "subaru": [
    { makeSlug: "toyota", modelSlug: "rav4", name: "Toyota RAV4" },
    { makeSlug: "honda", modelSlug: "cr-v", name: "Honda CR-V" },
  ],
  "mazda": [
    { makeSlug: "toyota", modelSlug: "camry", name: "Toyota Camry" },
    { makeSlug: "honda", modelSlug: "accord", name: "Honda Accord" },
  ],
  "bmw": [
    { makeSlug: "mercedes-benz", modelSlug: "c-class", name: "Mercedes-Benz C-Class" },
    { makeSlug: "audi", modelSlug: "a4", name: "Audi A4" },
  ],
  "mercedes-benz": [
    { makeSlug: "bmw", modelSlug: "3-series", name: "BMW 3 Series" },
    { makeSlug: "audi", modelSlug: "a4", name: "Audi A4" },
  ],
  "audi": [
    { makeSlug: "bmw", modelSlug: "3-series", name: "BMW 3 Series" },
    { makeSlug: "mercedes-benz", modelSlug: "c-class", name: "Mercedes-Benz C-Class" },
  ],
  "jeep": [
    { makeSlug: "ford", modelSlug: "explorer", name: "Ford Explorer" },
    { makeSlug: "toyota", modelSlug: "4runner", name: "Toyota 4Runner" },
  ],
  "tesla": [
    { makeSlug: "bmw", modelSlug: "i4", name: "BMW i4" },
    { makeSlug: "ford", modelSlug: "mustang-mach-e", name: "Ford Mustang Mach-E" },
  ],
};

export function relatedLinks({ make, makeSlug, model, modelSlug, year }: RelatedLinksOptions): string {
  const links: string[] = [];

  // Compare to competitors
  const competitors = COMPETITOR_MAP[makeSlug];
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

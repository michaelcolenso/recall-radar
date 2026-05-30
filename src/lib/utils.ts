export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseNhtsaDate(dateStr: string): string | null {
  // NHTSA uses "DD/MM/YYYY" format
  const parts = dateStr?.split("/");
  if (!parts || parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)\S/g, (c) => c.toUpperCase());
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const MAKE_LOGO_SLUGS = new Set([
  "acura", "audi", "bmw", "buick", "cadillac", "chevrolet", "chrysler",
  "dodge", "ford", "gmc", "honda", "hyundai", "infiniti", "jeep", "kia",
  "land-rover", "lexus", "lincoln", "mazda", "mercedes-benz", "mini",
  "mitsubishi", "nissan", "porsche", "ram", "subaru", "tesla", "toyota",
  "volkswagen", "volvo",
]);

/** Returns the logo SVG path for a make slug, or null if not available. */
export function getMakeLogoUrl(makeSlug: string): string | null {
  return MAKE_LOGO_SLUGS.has(makeSlug) ? `/logos/${makeSlug}.svg` : null;
}

/** Returns an <img> tag for a make logo, or empty string if unavailable. */
export function makeLogoImg(makeSlug: string, alt: string, className = "rr-make-logo"): string {
  const url = getMakeLogoUrl(makeSlug);
  if (!url) return "";
  return `<img src="${url}" alt="${escapeHtml(alt)} logo" class="${className}" width="48" height="48" loading="lazy" />`;
}

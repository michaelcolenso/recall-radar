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

/** Simple HTML-to-Markdown converter for agent content negotiation. */
export function htmlToMarkdown(html: string): string {
  let md = html;

  // Block elements
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gi, "$1\n");
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gi, "$1\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Inline elements
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#039;/g, "'");
  md = md.replace(/&nbsp;/g, " ");

  // Collapse excessive whitespace
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

/** Check if the request accepts text/markdown. */
export function acceptsMarkdown(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const accept = c.req.header("accept") || "";
  return accept.includes("text/markdown") || accept.includes("text/md");
}

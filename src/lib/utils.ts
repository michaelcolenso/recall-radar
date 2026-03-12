export const slugify = (value: string): string =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8" } });

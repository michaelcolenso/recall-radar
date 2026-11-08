import { escapeHtml } from "../lib/utils";

export const OG_IMAGE_PATH = /^\/og\/([a-z0-9-]+)\/([a-z0-9-]+)\/([0-9]+)\.svg$/;

export async function renderOgImage(env: Env, pathname: string): Promise<Response | null> {
  const match = OG_IMAGE_PATH.exec(pathname);
  if (!match) return null;
  const makeSlug = match[1];
  const modelSlug = match[2];
  const yearNum = Number(match[3]);
  if (!yearNum || yearNum < 1900 || yearNum > 2100) {
    return new Response("Not found", { status: 404 });
  }

  const make = await env.DB.prepare("SELECT name FROM makes WHERE slug = ?")
    .bind(makeSlug)
    .first<{ name: string }>();
  const model = await env.DB.prepare("SELECT name FROM models WHERE slug = ?")
    .bind(modelSlug)
    .first<{ name: string }>();
  if (!make || !model) {
    return new Response("Not found", { status: 404 });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0c"/>
  <rect x="60" y="60" width="1080" height="510" fill="none" stroke="#27272a" stroke-width="2"/>
  <rect x="100" y="100" width="60" height="60" fill="#f97316"/>
  <text x="130" y="145" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle">!</text>
  <text x="180" y="148" font-family="system-ui, sans-serif" font-size="48" font-weight="700" fill="#fafafa">Recalled Rides</text>
  <text x="100" y="280" font-family="system-ui, sans-serif" font-size="64" font-weight="700" fill="#fafafa">${yearNum} ${escapeHtml(make.name)} ${escapeHtml(model.name)}</text>
  <text x="100" y="360" font-family="system-ui, sans-serif" font-size="32" fill="#a1a1aa">Check safety recalls and get free repairs.</text>
  <rect x="100" y="420" width="200" height="4" fill="#f97316"/>
  <text x="100" y="500" font-family="system-ui, sans-serif" font-size="22" fill="#71717a">Data sourced from NHTSA · RecalledRides.com</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400, s-maxage=43200, stale-while-revalidate=86400",
    },
  });
}

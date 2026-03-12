import type { Env } from "../env";

export async function readThroughPageCache(env: Env, key: string, ttl: number, render: () => Promise<string>): Promise<string> {
  const hit = await env.PAGE_CACHE.get(key);
  if (hit) return hit;
  const html = await render();
  await env.PAGE_CACHE.put(key, html, { expirationTtl: ttl });
  return html;
}

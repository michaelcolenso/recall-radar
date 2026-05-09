export async function getCachedOrRender(
  kv: KVNamespace,
  cacheKey: string,
  ttlSeconds: number,
  renderFn: () => Promise<string>
): Promise<{ html: string; hit: boolean }> {
  const cached = await kv.get(cacheKey);
  if (cached) return { html: cached, hit: true };

  const html = await renderFn();
  await kv.put(cacheKey, html, { expirationTtl: ttlSeconds });
  return { html, hit: false };
}

export async function getCachedOrRender(
  kv: KVNamespace,
  cacheKey: string,
  ttlSeconds: number,
  renderFn: () => Promise<string>
): Promise<string> {
  const cached = await kv.get(cacheKey);
  if (cached) return cached;

  const html = await renderFn();
  await kv.put(cacheKey, html, { expirationTtl: ttlSeconds });
  return html;
}

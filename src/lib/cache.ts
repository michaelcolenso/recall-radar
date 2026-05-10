interface CacheEnvelope<T> {
  value: T;
}

export async function getCachedOrRender<T>(
  kv: KVNamespace,
  cacheKey: string,
  ttlSeconds: number,
  renderFn: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const cached = await kv.get(cacheKey, "text");
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as CacheEnvelope<T>;
      return { value: parsed.value, hit: true };
    } catch {
      await kv.delete(cacheKey);
    }
  }

  const value = await renderFn();
  await kv.put(cacheKey, JSON.stringify({ value }), { expirationTtl: ttlSeconds });
  return { value, hit: false };
}

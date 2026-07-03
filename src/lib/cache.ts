interface CacheEnvelope<T> {
  value: T;
}

export async function getCachedOrRender<T>(
  _kv: KVNamespace,
  cacheKey: string,
  ttlSeconds: number,
  renderFn: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cacheRequest = new Request(`https://recalledrides.com/__page-cache/${encodeURIComponent(cacheKey)}`);

  const cached = await cache.match(cacheRequest);
  if (cached) {
    try {
      const parsed = JSON.parse(await cached.text()) as CacheEnvelope<T>;
      return { value: parsed.value, hit: true };
    } catch {
      await cache.delete(cacheRequest);
    }
  }

  const value = await renderFn();
  await cache.put(
    cacheRequest,
    new Response(JSON.stringify({ value }), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "cache-control": `public, max-age=${ttlSeconds}`,
      },
    }),
  );
  return { value, hit: false };
}

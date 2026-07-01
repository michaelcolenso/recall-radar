interface CacheEnvelope<T> {
  value: T;
}

// Cache API keys must be full URLs; the host is arbitrary for caches.default,
// so use the canonical domain with a reserved path that no real route serves.
const CACHE_KEY_ORIGIN = "https://recalledrides.com";

function cacheRequest(cacheKey: string): Request {
  return new Request(`${CACHE_KEY_ORIGIN}/__cache/${encodeURIComponent(cacheKey)}`);
}

function edgeCache(): Cache | null {
  // `caches` is unavailable outside the Workers runtime (Node scripts, tests).
  return typeof caches === "undefined" ? null : caches.default;
}

export async function getCachedOrRender<T>(
  cacheKey: string,
  ttlSeconds: number,
  renderFn: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const cache = edgeCache();
  const request = cacheRequest(cacheKey);

  if (cache) {
    try {
      const cached = await cache.match(request);
      if (cached) {
        const parsed = (await cached.json()) as CacheEnvelope<T>;
        return { value: parsed.value, hit: true };
      }
    } catch {
      // Corrupt or unreadable entry: fall through and re-render (the put below overwrites it).
    }
  }

  const value = await renderFn();

  if (cache) {
    try {
      await cache.put(
        request,
        new Response(JSON.stringify({ value }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${ttlSeconds}`,
          },
        })
      );
    } catch {
      // Best effort: a failed cache write must not fail the response.
    }
  }

  return { value, hit: false };
}

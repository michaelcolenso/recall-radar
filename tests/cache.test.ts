import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getCachedOrRender } from "../src/lib/cache.ts";

const originalCaches = globalThis.caches;

afterEach(() => {
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: originalCaches,
  });
});

function installCacheMock() {
  const entries = new Map<string, Response>();
  let puts = 0;

  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        async match(request: Request) {
          return entries.get(request.url);
        },
        async put(request: Request, response: Response) {
          puts += 1;
          entries.set(request.url, response.clone());
        },
        async delete(request: Request) {
          return entries.delete(request.url);
        },
      },
    },
  });

  return { get puts() { return puts; } };
}

test("getCachedOrRender stores page responses in Cache API without KV writes", async () => {
  const cache = installCacheMock();
  const kvWrites: string[] = [];
  const kv = {
    async get() {
      return null;
    },
    async put(key: string) {
      kvWrites.push(key);
    },
    async delete() {
      return;
    },
  } as unknown as KVNamespace;

  const first = await getCachedOrRender(kv, "page:vin:1FAFP404X1F100001", 3600, async () => ({ html: "fresh" }));
  const second = await getCachedOrRender(kv, "page:vin:1FAFP404X1F100001", 3600, async () => ({ html: "stale" }));

  assert.deepEqual(first, { value: { html: "fresh" }, hit: false });
  assert.deepEqual(second, { value: { html: "fresh" }, hit: true });
  assert.equal(cache.puts, 1);
  assert.deepEqual(kvWrites, []);
});

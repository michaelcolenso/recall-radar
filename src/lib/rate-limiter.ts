import { z } from "zod";

let lastRequestTime = 0;
let totalRequests = 0;

const MIN_DELAY_MS = 500;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2_000;

export function getRequestStats() {
  return { totalRequests };
}

export async function throttledFetch<T>(
  url: string,
  schema?: z.ZodType<T>,
  label?: string,
): Promise<T> {
  // Enforce minimum delay between requests
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      lastRequestTime = Date.now();
      totalRequests++;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      // Hard fail on 4xx (except 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(
          `HTTP ${res.status} for ${label ?? url} — not retrying`,
        );
      }

      // Retry on 429 and 5xx
      if (res.status === 429 || res.status >= 500) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.log(
          `  Retry ${attempt + 1}/${MAX_RETRIES} (HTTP ${res.status}) for ${label ?? url} in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      const json = await res.json();
      if (schema) return schema.parse(json);
      return json as T;
    } catch (err) {
      clearTimeout(timeoutId);

      // Don't retry hard 4xx failures
      if (
        err instanceof Error &&
        err.message.includes("not retrying")
      ) {
        throw err;
      }

      if (attempt >= MAX_RETRIES) throw err;

      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.log(
        `  Retry ${attempt + 1}/${MAX_RETRIES} for ${label ?? url} in ${delay}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }

  throw new Error(`Max retries exceeded for ${label ?? url}`);
}

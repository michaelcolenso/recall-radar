import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractCriticalCss } from "../scripts/build-critical-css.mjs";
import { CRITICAL_CSS } from "../src/templates/critical-css.ts";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");

test("CRITICAL_CSS matches the @critical regions in public/styles.css", () => {
  const css = readFileSync(path.join(root, "public/styles.css"), "utf-8");
  assert.equal(
    extractCriticalCss(css),
    CRITICAL_CSS,
    "src/templates/critical-css.ts is stale — run `npm run build:critical`",
  );
});

test("CRITICAL_CSS is substantial", () => {
  assert.ok(CRITICAL_CSS.length > 5000, `expected CRITICAL_CSS.length > 5000, got ${CRITICAL_CSS.length}`);
});

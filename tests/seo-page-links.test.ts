import assert from "node:assert/strict";
import { test } from "node:test";
import { makePageTemplate } from "../src/templates/make-page.ts";
import { modelPageTemplate } from "../src/templates/model-page.ts";

test("make pages link only models with recall detail", () => {
  const html = makePageTemplate("Honda", "honda", [
    { name: "Pilot", slug: "pilot", min_year: 2003, max_year: 2026, recall_count: 8 },
    { name: "Grom", slug: "grom", min_year: 2024, max_year: 2024, recall_count: 0 },
  ]);

  assert.match(html, /href="\/honda\/pilot"/);
  assert.doesNotMatch(html, /href="\/honda\/grom"/);
});

test("model pages link only years with recall detail", () => {
  const html = modelPageTemplate("Subaru", "subaru", "Forester", "forester", [
    { year: 2025, recall_count: 2, highest_severity: "HIGH" },
    { year: 2022, recall_count: 0, highest_severity: null },
  ]);

  assert.match(html, /href="\/subaru\/forester\/2025"/);
  assert.doesNotMatch(html, /href="\/subaru\/forester\/2022"/);
});

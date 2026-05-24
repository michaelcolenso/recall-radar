import assert from "node:assert/strict";
import { test } from "node:test";
import { makePageTemplate } from "../src/templates/make-page.ts";
import { modelPageTemplate } from "../src/templates/model-page.ts";
import { homeTemplate } from "../src/templates/home.ts";
import { recallCard } from "../src/templates/components/recall-card.ts";

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

test("home page links high-value model pages directly", () => {
  const html = homeTemplate(
    [{ name: "Subaru", slug: "subaru", model_count: 10, recall_count: 42 }],
    { recalls: 42, vehicles: 10, makes: 1 },
    [],
    [
      {
        make_name: "Subaru",
        make_slug: "subaru",
        model_name: "Forester",
        model_slug: "forester",
        year_count: 8,
        recall_count: 21,
      },
    ],
  );

  assert.match(html, /Popular Recall Pages/);
  assert.match(html, /href="\/subaru\/forester"/);
});

test("recall cards expose campaign detail pages as crawlable links", () => {
  const html = recallCard({
    nhtsa_campaign_number: "17V541000",
    component: "STEERING",
    manufacturer: "Example",
    summary_raw: "Summary",
    consequence_raw: "Consequence",
    remedy_raw: "Remedy",
    summary_enriched: null,
    consequence_enriched: null,
    remedy_enriched: null,
    severity_level: "HIGH",
    report_received_date: "2017-09-01",
    enriched_at: null,
  });

  assert.match(html, /href="\/recall\/17V541000"/);
  assert.match(html, /data-share-url="\/recall\/17V541000"/);
});

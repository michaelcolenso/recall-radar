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

import { makeComponentPageTemplate } from "../src/templates/make-component-page.ts";
import { modelStatsPageTemplate } from "../src/templates/model-stats-page.ts";
import { vinLookupPageTemplate } from "../src/templates/vin-lookup-page.ts";

test("make component page links to model year pages and campaign pages", () => {
  const html = makeComponentPageTemplate({
    make: "Toyota",
    makeSlug: "toyota",
    component: "AIR BAG",
    componentSlug: "air-bag",
    recalls: [
      {
        model_name: "Camry",
        model_slug: "camry",
        year: 2020,
        nhtsa_campaign_number: "20V682000",
        component: "AIR BAGS",
        severity_level: "HIGH",
        summary: "The air bag may not deploy properly.",
        report_received_date: "2020-10-01",
      },
    ],
    totalModelYears: 5,
    yearRange: "2018–2022",
    severityBreakdown: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    otherComponents: [
      { name: "BRAKE", slug: "brake", count: 3 },
    ],
  });

  assert.match(html, /href="\/toyota\/camry\/2020"/);
  assert.match(html, /href="\/recall\/20V682000"/);
  assert.match(html, /href="\/toyota\/brake-recalls"/);
  assert.match(html, /Model-Years Affected/);
});

test("model stats page links to year pages and shows analysis", () => {
  const html = modelStatsPageTemplate({
    make: "Honda",
    makeSlug: "honda",
    model: "Civic",
    modelSlug: "civic",
    yearStats: [
      { year: 2022, recall_count: 1, risk_grade: "A", critical_count: 0, high_count: 0 },
      { year: 2020, recall_count: 3, risk_grade: "C", critical_count: 1, high_count: 1 },
    ],
    componentStats: [
      { name: "AIR BAG", count: 2 },
      { name: "FUEL SYSTEM", count: 1 },
    ],
    mostSevereRecalls: [
      {
        year: 2020,
        nhtsa_campaign_number: "20V001000",
        component: "AIR BAGS",
        severity_level: "HIGH",
        summary: "Air bag may fail to deploy.",
      },
    ],
    bestYears: [{ year: 2022, recall_count: 1, risk_grade: "A", critical_count: 0, high_count: 0 }],
    worstYears: [{ year: 2020, recall_count: 3, risk_grade: "C", critical_count: 1, high_count: 1 }],
    brandAvgRecalls: 2.5,
    totalRecalls: 4,
  });

  assert.match(html, /href="\/honda\/civic\/2022"/);
  assert.match(html, /href="\/honda\/civic\/2020"/);
  assert.match(html, /Total Recalls/);
  assert.match(html, /Best Years/);
  assert.match(html, /Worst Years/);
});

test("VIN lookup page includes form and sample VINs", () => {
  const html = vinLookupPageTemplate("https://recalledrides.com");

  assert.match(html, /id="vin-form"/);
  assert.match(html, /id="vin-input"/);
  assert.match(html, /5TDZK3EH5CS044883/);
  assert.match(html, /17-character VIN/);
  assert.match(html, /Privacy Notice/);
});

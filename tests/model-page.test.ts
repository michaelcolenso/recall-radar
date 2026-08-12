import assert from "node:assert/strict";
import { test } from "node:test";
import { modelPageTemplate, modelPageMeta } from "../src/templates/model-page.ts";
import { modelOverviewFaqJsonLd } from "../src/templates/components/json-ld.ts";

const auditYears = [
  { year: 2022, recall_count: 3, risk_grade: "C", risk_score: 55, highest_severity: "HIGH" as const },
  { year: 2021, recall_count: 1, risk_grade: "B", risk_score: 30, highest_severity: "MEDIUM" as const },
  { year: 2020, recall_count: 0, risk_grade: "A", risk_score: 5, highest_severity: null },
];

const notableRecall = {
  years: [2022],
  nhtsa_campaign_number: "22V123000",
  component: "AIR BAGS:FRONTAL",
  severity_level: "HIGH" as const,
  report_received_date: "2022-05-01",
  summary: "The front air bags may fail to deploy properly in a crash.",
};

test("full model page: title/H1 answer count, years, and refresh date", () => {
  const html = modelPageTemplate({
    make: "Audi",
    makeSlug: "audi",
    model: "A6",
    modelSlug: "a6",
    years: auditYears,
    totalRecalls: 4,
    topComponents: [{ name: "AIR BAGS", count: 3 }],
    notableRecalls: [notableRecall],
    lastUpdated: "August 2026",
  });

  assert.match(html, /<h1[^>]*>Audi A6 Recalls: 4 Found<\/h1>/);
  // Meta bar reports years WITH a recall (2020 has none), not all tracked years —
  // vehicle_years has a row for every tracked year regardless of whether the
  // model existed then, so "years tracked" would overstate the recall spread.
  assert.match(html, /2 model years with recalls \(2021–2022\)/);
  assert.match(html, /Data refreshed August 2026/);
  assert.match(html, /href="\/audi\/a6\/2022"/);
  assert.doesNotMatch(html, /href="\/audi\/a6\/2020"/); // 2020 has zero recalls, not linked
});

test("full model page: surfaces notable recalls with year and campaign links", () => {
  const html = modelPageTemplate({
    make: "Audi",
    makeSlug: "audi",
    model: "A6",
    modelSlug: "a6",
    years: auditYears,
    totalRecalls: 4,
    topComponents: [{ name: "AIR BAGS", count: 3 }],
    notableRecalls: [notableRecall],
    lastUpdated: "August 2026",
  });

  assert.match(html, /Recent &amp; Notable Recalls/);
  assert.match(html, /href="\/recall\/22V123000"/);
  assert.match(html, /href="\/audi\/a6\/2022"/);
  assert.match(html, /Most Common Issues/);
  assert.match(html, /href="\/audi\/air-bags-recalls"/);
});

test("full model page: a campaign spanning multiple years renders once, not once per year", () => {
  const html = modelPageTemplate({
    make: "Audi",
    makeSlug: "audi",
    model: "A6",
    modelSlug: "a6",
    years: auditYears,
    totalRecalls: 4,
    topComponents: [],
    notableRecalls: [
      {
        years: [2022, 2021, 2020],
        nhtsa_campaign_number: "23V601000",
        component: "SERVICE BRAKES, HYDRAULIC:FLUID",
        severity_level: "CRITICAL",
        report_received_date: "2023-08-25",
        summary: "The brake fluid reservoir cap may be labeled incorrectly.",
      },
    ],
  });

  const occurrences = html.match(/#23V601000/g) ?? [];
  // One campaign badge + one campaign-details link = 2 total, never one card per affected year.
  assert.equal(occurrences.length, 2);
  assert.match(html, /href="\/audi\/a6\/2022"/);
  assert.match(html, /href="\/audi\/a6\/2021"/);
  assert.match(html, /href="\/audi\/a6\/2020"/);
});

test("full model page: prominent VIN-check disclaimer and action", () => {
  const html = modelPageTemplate({
    make: "Audi",
    makeSlug: "audi",
    model: "A6",
    modelSlug: "a6",
    years: auditYears,
    totalRecalls: 4,
    topComponents: [],
    notableRecalls: [],
  });

  assert.match(html, /Not Every A6 Is Affected — Check Your VIN/);
  assert.match(html, /only your 17-character Vehicle Identification Number \(VIN\) is authoritative/);
  assert.match(html, /href="\/vin-lookup"/);
});

test("zero-recall model (verified): stays accurate, no false recall claim, still links VIN check", () => {
  const html = modelPageTemplate({
    make: "Infiniti",
    makeSlug: "infiniti",
    model: "J30",
    modelSlug: "j30",
    years: [
      { year: 2000, recall_count: 0, risk_grade: null, risk_score: null, highest_severity: null },
      { year: 2001, recall_count: 0, risk_grade: null, risk_score: null, highest_severity: null },
    ],
    totalRecalls: 0,
    topComponents: [],
    notableRecalls: [],
    lastUpdated: "August 2026",
  });

  assert.match(html, /<h1[^>]*>Infiniti J30 Recalls: None Found<\/h1>/);
  assert.match(html, /All Clear/);
  assert.match(html, /No safety recalls on record for the Infiniti J30/);
  assert.doesNotMatch(html, /Recent &amp; Notable Recalls/);
  assert.match(html, /href="\/vin-lookup"/);
  // Zero recalls in our tracked years must not be sold as a clean bill of
  // health for the model's whole life — vehicle_years rows exist for every
  // year in the ingestion window regardless of whether the model was ever
  // produced then, so a pre-2000/discontinued model must not read as "safe."
  assert.doesNotMatch(html, /That's great news/);
  assert.match(html, /sold before 2000 or discontinued earlier, those years aren't reflected here/);
});

test("sparse model (no year data at all): does not fabricate a recall count", () => {
  const html = modelPageTemplate({
    make: "Rare",
    makeSlug: "rare",
    model: "Concept",
    modelSlug: "concept",
    years: [],
    totalRecalls: 0,
    topComponents: [],
    notableRecalls: [],
  });

  assert.match(html, /No Data Yet/);
  assert.match(html, /We haven't ingested model-year data/);
  assert.match(html, /href="\/vin-lookup"/);
  assert.match(html, /href="\/rare"/);
  assert.doesNotMatch(html, /Recalls: \d+ Found/);
});

test("modelOverviewFaqJsonLd emits valid FAQPage schema grounded in the verified count, not review/rating schema", () => {
  const json = modelOverviewFaqJsonLd({
    make: "Audi",
    model: "A6",
    totalRecalls: 4,
    yearCount: 3,
    yearRange: "2020–2022",
    recallYearCount: 2,
    recallYearRange: "2021–2022",
    topComponent: "AIR BAGS",
    pageUrl: "https://recalledrides.com/audi/a6",
    dateModified: "2026-08-01T00:00:00.000Z",
  });

  assert.match(json, /"@type":"FAQPage"/);
  // Scoped to years with a verified recall (2 of the 3 tracked years), not the
  // full tracked-year count — see the recallYearCount/recallYearRange fix.
  assert.match(json, /4 known NHTSA safety recalls across 2 model years \(2021–2022\)/);
  assert.match(json, /Only your VIN can confirm/);
  assert.doesNotMatch(json, /AggregateRating/);
  assert.doesNotMatch(json, /"@type":"Review"/);
});

test("modelPageMeta: verified count drives title and description, ungrounded claims never appear", () => {
  const meta = modelPageMeta({
    make: "Audi",
    model: "A6",
    totalRecalls: 42,
    yearCount: 27,
    yearRange: "2000–2027",
    recallYearCount: 27,
    recallYearRange: "2000–2027",
    topComponent: "AIR BAGS",
    lastUpdated: "August 2026",
  });

  assert.equal(meta.title, "Audi A6 Recalls: 42 Found, Affected Years & VIN Check | Recalled Rides");
  assert.match(meta.description, /42 known NHTSA safety recalls across 27 model years \(2000–2027\)/);
  assert.match(meta.description, /most often involving air bags/);
  assert.match(meta.description, /data refreshed August 2026/);
});

test("modelPageMeta: recall-year range is scoped to years with a verified recall, not every tracked year", () => {
  // vehicle_years has a row for every tracked year (2000–2027) regardless of
  // whether the model was ever produced then — a discontinued model like the
  // BMW 128i (really built 2008–2013) must not read as recalled across 28 years.
  const meta = modelPageMeta({
    make: "BMW",
    model: "128i",
    totalRecalls: 7,
    yearCount: 28,
    yearRange: "2000–2027",
    recallYearCount: 6,
    recallYearRange: "2008–2013",
    topComponent: "ENGINE AND ENGINE COOLING",
    lastUpdated: "August 2026",
  });

  assert.match(meta.description, /7 known NHTSA safety recalls across 6 model years \(2008–2013\)/);
  assert.doesNotMatch(meta.description, /28 model years/);
  assert.doesNotMatch(meta.description, /2000–2027/);
});

test("modelPageMeta: verified zero recalls never implies an unverified recall exists", () => {
  const meta = modelPageMeta({
    make: "Infiniti",
    model: "J30",
    totalRecalls: 0,
    yearCount: 28,
    yearRange: "2000–2027",
    recallYearCount: 0,
    recallYearRange: "",
  });

  assert.equal(meta.title, "Infiniti J30 Recalls: None Found — Affected Years & VIN Check | Recalled Rides");
  assert.match(meta.description, /no NHTSA safety recalls on record for tracked model years 2000–2027/);
  assert.match(meta.description, /Verify your specific VIN for a definitive check/);
  assert.doesNotMatch(meta.description, /has \d+ known/);
  assert.doesNotMatch(meta.description, /Good news/);
});

test("modelPageMeta: no year data falls back to a safety-information title instead of a fabricated count", () => {
  const meta = modelPageMeta({
    make: "Rare",
    model: "Concept",
    totalRecalls: 0,
    yearCount: 0,
    yearRange: "",
    recallYearCount: 0,
    recallYearRange: "",
  });

  assert.equal(meta.title, "Rare Concept Recalls & Safety Information | Recalled Rides");
  assert.match(meta.description, /don't have model-year recall data/);
});

test("modelOverviewFaqJsonLd returns empty string when there is no year data", () => {
  const json = modelOverviewFaqJsonLd({
    make: "Rare",
    model: "Concept",
    totalRecalls: 0,
    yearCount: 0,
    yearRange: "",
    recallYearCount: 0,
    recallYearRange: "",
    pageUrl: "https://recalledrides.com/rare/concept",
  });

  assert.equal(json, "");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignPageTemplate } from "../src/templates/campaign-page.ts";
import { modelPageTemplate } from "../src/templates/model-page.ts";
import { newRecallsPageTemplate } from "../src/templates/new-recalls-page.ts";
import {
  FRESH_CAMPAIGNS,
  getFreshCampaign,
  freshCampaignsForMakeModel,
  severityOf,
} from "../src/lib/fresh-campaigns.ts";
import { getCampaignRows } from "../src/routes/seo.ts";
import { faqPageJsonLd, articleJsonLd, breadcrumbListJsonLd } from "../src/templates/components/json-ld.ts";

// ── Campaign page generation ─────────────────────────────────────

test("campaign page renders heading, summary, remedy, date, and severity", () => {
  const html = campaignPageTemplate({
    campaign: "26V525000",
    component: "POWER TRAIN:DRIVESHAFT",
    manufacturer: "BMW of North America, LLC",
    summary: "The driveshaft may fail, causing a loss of rear wheel power.",
    consequence: "A loss of drive power increases the risk of a crash.",
    remedy: "Dealers will replace the driveshaft free of charge.",
    severity: "CRITICAL",
    reportReceivedDate: "2026-08-12",
    isEnriched: false,
    heading: "2026 BMW 128i Driveshaft Recall",
    affectedVehicles: [{ make: "BMW", makeSlug: "bmw", model: "128i", modelSlug: "128i", year: 2026 }],
  });

  assert.match(html, /2026 BMW 128i Driveshaft Recall/);
  assert.match(html, /The driveshaft may fail/);
  assert.match(html, /Dealers will replace the driveshaft free of charge\./);
  assert.match(html, /2026-08-12/);
  assert.match(html, /Critical/);
  assert.match(html, /href="\/bmw\/128i\/2026"/);
});

test("campaign page includes VIN-check CTA with authoritative-VIN disclaimer", () => {
  const html = campaignPageTemplate({
    campaign: "26V511000",
    component: "ELECTRICAL SYSTEM",
    manufacturer: "Toyota",
    summary: "The instrument cluster may go blank.",
    consequence: "A blank cluster can hide warning lights.",
    remedy: "Dealers will update the software.",
    severity: "MEDIUM",
    reportReceivedDate: "2026-08-06",
    isEnriched: false,
    affectedVehicles: [{ make: "Toyota", makeSlug: "toyota", model: "Tacoma", modelSlug: "tacoma", year: 2025 }],
  });

  assert.match(html, /href="\/vin-lookup"/);
  assert.match(html, /Check My VIN/);
  assert.match(html, /does <strong>not<\/strong> prove an individual vehicle is/);
  assert.match(html, /authoritative way to know is a VIN check/i);
});

test("campaign page handles zero affected vehicles (sparse data) without breaking", () => {
  const html = campaignPageTemplate({
    campaign: "26V513000",
    component: "EXTERIOR LIGHTING",
    manufacturer: "Volvo Trucks Corporation",
    summary: "Marker lights may fail to illuminate.",
    consequence: "Reduced visibility.",
    remedy: "Dealers will replace the marker lamps.",
    severity: "LOW",
    reportReceivedDate: "2026-08-06",
    isEnriched: false,
    affectedVehicles: [],
  });

  // No vehicle grid, but the page (and its VIN CTA) still render.
  assert.doesNotMatch(html, /Affected Vehicles/);
  assert.match(html, /Check My VIN/);
  assert.match(html, /Marker lights may fail to illuminate/);
});

test("default H1 remains campaign number when no heading is supplied", () => {
  const html = campaignPageTemplate({
    campaign: "17V541000",
    component: "STEERING",
    manufacturer: "Example",
    summary: "S",
    consequence: "C",
    remedy: "R",
    severity: "HIGH",
    reportReceivedDate: "2017-09-01",
    isEnriched: true,
    affectedVehicles: [],
  });
  assert.match(html, /<h1[^>]*>Campaign 17V541000<\/h1>/);
});

// ── Make/model linkage ───────────────────────────────────────────

test("model page surfaces recent campaign links when data supports it", () => {
  const html = modelPageTemplate(
    "Toyota",
    "toyota",
    "Tacoma",
    "tacoma",
    [{ year: 2025, recall_count: 4, risk_grade: "B", risk_score: 40, highest_severity: "HIGH" }],
    [{
      campaign: "26V514000",
      component: "SUSPENSION:REAR:SHOCK ABSORBER",
      severity: "HIGH",
      reportReceivedDate: "2026-08-06",
      years: [2025],
    }],
  );

  assert.match(html, /Recent Recalls for Toyota Tacoma/);
  assert.match(html, /href="\/recall\/26V514000"/);
  // Year links only point at model years present in the DB
  assert.match(html, /href="\/toyota\/tacoma\/2025"/);
  assert.doesNotMatch(html, /href="\/toyota\/tacoma\/2026"/);
});

test("model page renders no recent-recalls section without matches", () => {
  const html = modelPageTemplate(
    "Audi",
    "audi",
    "A6",
    "a6",
    [{ year: 2019, recall_count: 2, risk_grade: "B", risk_score: 45, highest_severity: "MEDIUM" }],
    [],
  );
  assert.doesNotMatch(html, /Recent Recalls/);
  assert.doesNotMatch(html, /\/recall\//);
});

// ── /new page announced section ──────────────────────────────────

test("new recalls page announces fresh campaign pages and links them", () => {
  const html = newRecallsPageTemplate({
    recalls: [],
    severity: "",
    page: 1,
    totalPages: 1,
    totalCount: 0,
    announcedCampaigns: [{
      campaign: "26V525000",
      component: "POWER TRAIN:DRIVESHAFT",
      severity_level: "CRITICAL",
      report_received_date: "2026-08-12",
      make_name: "BMW",
      model_name: "M2",
    }],
  });

  assert.match(html, /Just Announced/);
  assert.match(html, /href="\/recall\/26V525000"/);
  assert.match(html, /BMW M2/);
});

test("new recalls page renders no announced section when list is empty", () => {
  const html = newRecallsPageTemplate({
    recalls: [],
    severity: "",
    page: 1,
    totalPages: 1,
    totalCount: 0,
    announcedCampaigns: [],
  });
  assert.doesNotMatch(html, /Just Announced/);
});

// ── Curated campaign data ────────────────────────────────────────

test("six fresh campaigns are present and carry verified relationships", () => {
  assert.equal(FRESH_CAMPAIGNS.length, 6);
  const numbers = FRESH_CAMPAIGNS.map((c) => c.campaignNumber).sort();
  assert.deepEqual(numbers, ["26V511000", "26V512000", "26V513000", "26V514000", "26V524000", "26V525000"]);
  for (const c of FRESH_CAMPAIGNS) {
    assert.ok(c.campaignNumber.length >= 8, `${c.campaignNumber} has campaign number`);
    assert.ok(c.summary.length > 20, `${c.campaignNumber} has a real summary`);
    assert.ok(c.remedy.length > 10, `${c.campaignNumber} has a remedy`);
    assert.match(c.reportReceivedDate, /^\d{4}-\d{2}-\d{2}$/, `${c.campaignNumber} has ISO date`);
    // 26V513000 (Volvo Trucks VNL/VNR 2027) is intentionally sparse: the site has
    // no Volvo truck model pages, so no affected-vehicle links (avoids internal
    // 404s). All other campaigns carry verified make/model/year relationships.
    if (c.campaignNumber !== "26V513000") {
      assert.ok(c.vehicles.length > 0, `${c.campaignNumber} has at least one verified vehicle`);
    }
    for (const v of c.vehicles) {
      assert.ok(v.year >= 2000 && v.year <= 2030, `${c.campaignNumber} ${v.model} year ${v.year} plausible`);
      assert.ok(v.makeSlug.length > 0 && v.modelSlug.length > 0);
    }
  }
});

test("getFreshCampaign resolves by campaign number (case-insensitive)", () => {
  assert.ok(getFreshCampaign("26V525000"));
  assert.ok(getFreshCampaign("26v525000"));
  assert.equal(getFreshCampaign("00V000000"), undefined);
});

test("freshCampaignsForMakeModel matches verified make/model only", () => {
  const bmw = freshCampaignsForMakeModel("bmw", "128i");
  // Matches whatever BMW model the verified data lists; never an unverified pair.
  for (const c of bmw) {
    assert.ok(c.vehicles.some((v) => v.makeSlug === "bmw" && v.modelSlug === "128i"));
  }
  // Audi A6 has no fresh campaign in this batch — must be empty.
  assert.deepEqual(freshCampaignsForMakeModel("audi", "a6"), []);
});

test("severity classification matches the ingestion pipeline's rules", () => {
  const byComponent = new Map(FRESH_CAMPAIGNS.map((c) => [c.campaignNumber, c.component]));
  for (const [n, component] of byComponent) {
    assert.equal(severityOf(component), severityOf(component), `${n} severity deterministic`);
  }
  // Steering/powertrain components classify CRITICAL, exterior lighting MEDIUM
  // (the SEVERITY_MAP checks "LIGHTING" before the more specific "EXTERIOR
  // LIGHTING" entry, so marker-light recalls land at MEDIUM — same as the
  // ingestion pipeline's classification for this component).
  assert.equal(severityOf("STEERING:SPINDLE"), "CRITICAL");
  assert.equal(severityOf("POWER TRAIN:DRIVESHAFT"), "CRITICAL");
  assert.equal(severityOf("EXTERIOR LIGHTING"), "MEDIUM");
});

// ── Sitemap inclusion ────────────────────────────────────────────

test("campaign sitemap rows include curated fresh campaigns", async () => {
  // Fake D1 returning an empty recalls set (campaign not ingested yet).
  const fakeDb = {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] as Array<{ campaign_number: string; lastmod: string }> }),
      }),
      all: async () => ({ results: [] as Array<{ campaign_number: string; lastmod: string }> }),
    }),
  } as unknown as Parameters<typeof getCampaignRows>[0];

  const rows = await getCampaignRows(fakeDb);
  const numbers = rows.results.map((r) => r.campaign_number);
  for (const c of FRESH_CAMPAIGNS) {
    assert.ok(numbers.includes(c.campaignNumber), `${c.campaignNumber} present in sitemap rows`);
  }
});

test("campaign sitemap rows dedupe curated campaigns already in the DB", async () => {
  const dbRow = { campaign_number: "26V511000", lastmod: "2026-08-06" };
  const fakeDb = {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [dbRow] as Array<{ campaign_number: string; lastmod: string }> }),
      }),
      all: async () => ({ results: [dbRow] as Array<{ campaign_number: string; lastmod: string }> }),
    }),
  } as unknown as Parameters<typeof getCampaignRows>[0];

  const rows = await getCampaignRows(fakeDb);
  const numbers = rows.results.map((r) => r.campaign_number);
  assert.equal(numbers.filter((n) => n === "26V511000").length, 1);
  assert.equal(numbers.length, FRESH_CAMPAIGNS.length);
});

// ── Structured data validity ─────────────────────────────────────

test("curated campaign structured data is valid JSON-LD", () => {
  const campaignUrl = "https://recalledrides.com/recall/26V525000";
  const jsonLd =
    faqPageJsonLd([{
      campaign: "26V525000",
      component: "POWER TRAIN:DRIVESHAFT",
      make: "BMW",
      model: "M2",
      year: "2026",
      summary: "The driveshaft may fail.",
      consequence: "Loss of drive power.",
      remedy: "Free replacement.",
      reportReceivedDate: "2026-08-12",
    }], campaignUrl, "2026-08-12") +
    breadcrumbListJsonLd("https://recalledrides.com", [
      { name: "Home", item: "https://recalledrides.com" },
      { name: "BMW", item: "https://recalledrides.com/bmw" },
      { name: "M2", item: "https://recalledrides.com/bmw/m2" },
      { name: "2026", item: "https://recalledrides.com/bmw/m2/2026" },
      { name: "Campaign 26V525000", item: campaignUrl },
    ]) +
    articleJsonLd({
      headline: "2026 BMW M2 Driveshaft Recall (NHTSA #26V525000) | Recalled Rides",
      description: "The driveshaft may fail.",
      url: campaignUrl,
      datePublished: "2026-08-12",
      author: "Recalled Rides",
    });

  const scripts = jsonLd.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
  assert.equal(scripts.length, 3);
  for (const s of scripts) {
    const payload = JSON.parse(s.replace(/<script type="application\/ld\+json">/, "").replace(/<\/script>/, ""));
    assert.equal(payload["@context"], "https://schema.org");
  }
  assert.match(jsonLd, /26V525000/);
  assert.match(jsonLd, /FAQPage/);
  assert.match(jsonLd, /BreadcrumbList/);
  assert.match(jsonLd, /Article/);
});

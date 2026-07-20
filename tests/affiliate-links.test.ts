import assert from "node:assert/strict";
import { test } from "node:test";
import { vinReportCta, vinReportEmailCta } from "../src/templates/components/affiliate-box.ts";
import { getPartner, getEnabledPartners, primaryPartner, goPath } from "../src/lib/affiliates.ts";
import { yearPageTemplate } from "../src/templates/year-page.ts";

const partner = getPartner("dvh")!;

test("registry parses the env var and preserves order", () => {
  assert.equal(getEnabledPartners(undefined).length, 0);
  assert.equal(getEnabledPartners("").length, 0);
  assert.deepEqual(
    getEnabledPartners("epicvin, dvh,unknown").map((p) => p.id),
    ["epicvin", "dvh"],
  );
  assert.equal(primaryPartner("epicvin,dvh")!.id, "epicvin");
});

test("affiliate CTA routes through /go, carries sponsored rel, and discloses", () => {
  const html = vinReportCta({ partner, variant: "vin", vin: "1FA6P8TH4F5410015" });

  assert.match(html, /href="\/go\/dvh\?placement=vin&(amp;)?vin=1FA6P8TH4F5410015"/);
  assert.match(html, /rel="sponsored nofollow noopener"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /we may earn a commission/i);
  assert.match(html, /href="\/disclosure"/);
  // never links the partner domain directly from page HTML
  assert.doesNotMatch(html, /detailedvehiclehistory\.com/);
});

test("year-variant CTA has no VIN param and names the vehicle", () => {
  const html = vinReportCta({ partner, variant: "year", make: "Ford", model: "F-150", year: "2019" });
  assert.match(html, /href="\/go\/dvh\?placement=year"/);
  assert.match(html, /2019 Ford F-150/);
  assert.doesNotMatch(html, /vin=/);
});

test("email CTA uses absolute /go URL with sponsored disclosure text", () => {
  const html = vinReportEmailCta(partner, "https://recalledrides.com");
  assert.match(html, /https:\/\/recalledrides\.com\/go\/dvh\?placement=email/);
  assert.match(html, /we may earn a commission/i);
});

test("goPath encodes the placement and vin", () => {
  assert.equal(goPath("epicvin", "vin", "1FA6P8TH4F5410015"), "/go/epicvin?placement=vin&vin=1FA6P8TH4F5410015");
  assert.equal(goPath("epicvin", "year"), "/go/epicvin?placement=year");
});

test("year page renders the affiliate CTA passed via the leadGen slot", () => {
  const html = yearPageTemplate({
    make: "Ford",
    makeSlug: "ford",
    model: "F-150",
    modelSlug: "f-150",
    year: "2019",
    recallCount: 2,
    topSeverity: "HIGH",
    riskGrade: "C",
    riskScore: 55,
    cards: "<article>card</article>",
    leadGen: vinReportCta({ partner, variant: "year", make: "Ford", model: "F-150", year: "2019" }),
  });
  assert.match(html, /rr-aff/);
  assert.match(html, /\/go\/dvh\?placement=year/);
});

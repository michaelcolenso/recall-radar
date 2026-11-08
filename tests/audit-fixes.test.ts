import assert from "node:assert/strict";
import test from "node:test";
import { parseRecallResults } from "../src/lib/nhtsa-client.ts";
import { extractJsonObject } from "../src/lib/enrichment.ts";
import { OG_IMAGE_PATH } from "../src/routes/og-image.ts";

test("null NHTSA Component does not fail the vehicle-year parse", () => {
  const parsed = parseRecallResults({
    Count: 2,
    results: [
      {
        NHTSACampaignNumber: "19V001000",
        ReportReceivedDate: "2019-01-01",
        Component: "STEERING",
        Manufacturer: "GM",
        Summary: "a",
        Consequence: "b",
        Remedy: "c",
      },
      {
        NHTSACampaignNumber: "19V002000",
        ReportReceivedDate: null,
        Component: null,
        Manufacturer: null,
        Summary: null,
        Consequence: null,
        Remedy: null,
      },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].Component, "");
  assert.equal(parsed[1].Summary, "");
});

test("enrichment JSON can be fenced or wrapped in prose", () => {
  const fenced = extractJsonObject('```json\n{"summary":"a","consequence":"b","remedy":"c"}\n```');
  assert.equal(JSON.parse(fenced || "{}").summary, "a");
  const wrapped = extractJsonObject('Sure. {"summary":"a","consequence":"b","remedy":"free"} Thanks.');
  assert.equal(JSON.parse(wrapped || "{}").remedy, "free");
  assert.equal(extractJsonObject("no object here"), null);
});

test("og image path matches the live preview URL", () => {
  const match = OG_IMAGE_PATH.exec("/og/toyota/camry/2023.svg");
  assert.ok(match);
  assert.deepEqual(match?.slice(1), ["toyota", "camry", "2023"]);
  assert.equal(OG_IMAGE_PATH.exec("/og/toyota/camry/2023"), null);
});

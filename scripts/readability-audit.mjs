#!/usr/bin/env node
// Readability audit: raw NHTSA recall text vs. LLM-enriched plain-English text.
//
// Computes Flesch Reading Ease and Flesch-Kincaid Grade Level for every recall
// that has enriched text, for each of summary/consequence/remedy, and writes
// scripts/out/readability.json plus a markdown table with before/after
// exemplars. Publish the /why-plain-english page ONLY if these numbers are
// favorable (or honestly reframed) — measure first, claim second.
//
// Usage:
//   1. Export the enriched recalls from D1 (remote = production numbers):
//      npx wrangler d1 execute recall-radar-db --remote --json --command \
//        "SELECT nhtsa_campaign_number, summary_raw, consequence_raw, remedy_raw, \
//                summary_enriched, consequence_enriched, remedy_enriched \
//         FROM recalls WHERE summary_enriched IS NOT NULL" > recalls-export.json
//   2. node scripts/readability-audit.mjs recalls-export.json
//
// No dependencies — the syllable estimator is self-contained (heuristic, the
// same one applied to both raw and enriched text, so comparisons are fair).

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("usage: node scripts/readability-audit.mjs <recalls-export.json>");
  process.exit(1);
}

const FIELDS = ["summary", "consequence", "remedy"];

// ─── Text metrics ───────────────────────────────────────────────

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // strip silent trailing e (but keep -le endings: "vehicle", "able")
  let stripped = w.replace(/(?:[^l]e|ed|es)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function sentenceCount(text) {
  const matches = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  return Math.max(1, matches.length);
}

function words(text) {
  return text.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
}

function metrics(text) {
  const ws = words(text);
  if (ws.length === 0) return null;
  const sentences = sentenceCount(text);
  const syllables = ws.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordsPerSentence = ws.length / sentences;
  const syllablesPerWord = syllables / ws.length;
  return {
    words: ws.length,
    sentences,
    fleschReadingEase: round(206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord),
    fkGrade: round(0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59),
  };
}

const round = (n) => Math.round(n * 100) / 100;
const mean = (xs) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};

// ─── Load rows (accepts wrangler --json output or a plain array) ─

function extractRows(parsed) {
  if (Array.isArray(parsed)) {
    // wrangler d1 execute --json → [{ results: [...], success, meta }]
    if (parsed.length && parsed[0] && Array.isArray(parsed[0].results)) {
      return parsed.flatMap((r) => r.results);
    }
    return parsed;
  }
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  throw new Error("Unrecognized input shape — expected wrangler --json output or an array of rows");
}

const rows = extractRows(JSON.parse(readFileSync(inputPath, "utf8")));
console.log(`loaded ${rows.length} enriched recalls from ${inputPath}`);

// ─── Compute ────────────────────────────────────────────────────

const perField = {};
const exemplarCandidates = [];

for (const field of FIELDS) {
  const pairs = [];
  for (const row of rows) {
    const raw = row[`${field}_raw`];
    const enriched = row[`${field}_enriched`];
    if (!raw || !enriched) continue;
    const rawM = metrics(raw);
    const enrM = metrics(enriched);
    if (!rawM || !enrM) continue;
    pairs.push({ campaign: row.nhtsa_campaign_number, raw: rawM, enriched: enrM });
    if (field === "summary") {
      exemplarCandidates.push({
        campaign: row.nhtsa_campaign_number,
        rawText: raw,
        enrichedText: enriched,
        gradeDrop: rawM.fkGrade - enrM.fkGrade,
      });
    }
  }

  perField[field] = {
    n: pairs.length,
    raw: {
      meanFleschReadingEase: mean(pairs.map((p) => p.raw.fleschReadingEase)),
      medianFleschReadingEase: median(pairs.map((p) => p.raw.fleschReadingEase)),
      meanFkGrade: mean(pairs.map((p) => p.raw.fkGrade)),
      medianFkGrade: median(pairs.map((p) => p.raw.fkGrade)),
      meanWords: mean(pairs.map((p) => p.raw.words)),
    },
    enriched: {
      meanFleschReadingEase: mean(pairs.map((p) => p.enriched.fleschReadingEase)),
      medianFleschReadingEase: median(pairs.map((p) => p.enriched.fleschReadingEase)),
      meanFkGrade: mean(pairs.map((p) => p.enriched.fkGrade)),
      medianFkGrade: median(pairs.map((p) => p.enriched.fkGrade)),
      meanWords: mean(pairs.map((p) => p.enriched.words)),
    },
    pctImprovedReadingEase: pairs.length
      ? round((100 * pairs.filter((p) => p.enriched.fleschReadingEase > p.raw.fleschReadingEase).length) / pairs.length)
      : null,
    pctLowerFkGrade: pairs.length
      ? round((100 * pairs.filter((p) => p.enriched.fkGrade < p.raw.fkGrade).length) / pairs.length)
      : null,
  };
}

// 3 exemplars: biggest grade-level drops with reasonable lengths
const exemplars = exemplarCandidates
  .filter((e) => e.rawText.length > 120 && e.enrichedText.length > 60)
  .sort((a, b) => b.gradeDrop - a.gradeDrop)
  .slice(0, 3)
  .map(({ campaign, rawText, enrichedText, gradeDrop }) => ({ campaign, gradeDrop: round(gradeDrop), rawText, enrichedText }));

const output = {
  computedAt: new Date().toISOString(),
  method:
    "Flesch Reading Ease = 206.835 − 1.015(words/sentence) − 84.6(syllables/word); " +
    "FK Grade = 0.39(words/sentence) + 11.8(syllables/word) − 15.59. " +
    "Heuristic syllable estimator applied identically to raw and enriched text.",
  totalEnrichedRecalls: rows.length,
  fields: perField,
  exemplars,
};

const outDir = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "readability.json"), JSON.stringify(output, null, 2));

// ─── Markdown summary ───────────────────────────────────────────

let md = `# Readability: NHTSA raw vs. plain-English enriched\n\nComputed ${output.computedAt} over ${rows.length} enriched recalls.\n\n`;
md += `| Field | n | Raw FRE (mean) | Enriched FRE (mean) | Raw FK grade | Enriched FK grade | % easier (FRE) | % lower grade |\n`;
md += `|---|---|---|---|---|---|---|---|\n`;
for (const field of FIELDS) {
  const f = perField[field];
  md += `| ${field} | ${f.n} | ${f.raw.meanFleschReadingEase} | ${f.enriched.meanFleschReadingEase} | ${f.raw.meanFkGrade} | ${f.enriched.meanFkGrade} | ${f.pctImprovedReadingEase}% | ${f.pctLowerFkGrade}% |\n`;
}
md += `\n## Exemplars (largest FK-grade drops, summary field)\n\n`;
for (const e of exemplars) {
  md += `### Campaign ${e.campaign} (−${e.gradeDrop} grade levels)\n\n**Raw (NHTSA):** ${e.rawText}\n\n**Plain English:** ${e.enrichedText}\n\n`;
}
writeFileSync(join(outDir, "readability.md"), md);

console.log(`wrote ${join(outDir, "readability.json")} and readability.md`);
for (const field of FIELDS) {
  const f = perField[field];
  console.log(
    `${field}: n=${f.n} FK ${f.raw.meanFkGrade} → ${f.enriched.meanFkGrade}, FRE ${f.raw.meanFleschReadingEase} → ${f.enriched.meanFleschReadingEase}`,
  );
}

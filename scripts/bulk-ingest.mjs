#!/usr/bin/env node
// Fires one single-make ingestion workflow per make in parallel.
// Usage: node scripts/bulk-ingest.mjs [yearStart=2000]

const WORKER_URL = "https://recall-radar.aged-morning-c8e4.workers.dev";
const ADMIN_TOKEN = "gobi-boots-newman";
const YEAR_START = parseInt(process.argv[2] ?? "2000", 10);

const MAKES = [
  "ACURA", "AUDI", "BMW", "BUICK", "CADILLAC", "CHEVROLET", "CHRYSLER",
  "DODGE", "FORD", "GMC", "HONDA", "HYUNDAI", "INFINITI", "JEEP",
  "KIA", "LAND ROVER", "LEXUS", "LINCOLN", "MAZDA", "MERCEDES-BENZ",
  "MINI", "MITSUBISHI", "NISSAN", "PORSCHE", "RAM", "SUBARU",
  "TESLA", "TOYOTA", "VOLKSWAGEN", "VOLVO",
];

const results = await Promise.all(
  MAKES.map(async (make) => {
    const res = await fetch(`${WORKER_URL}/api/admin/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "single-make", targetMake: make, yearStart: YEAR_START }),
    });
    const data = await res.json();
    return { make, ...data };
  })
);

console.log(`\nTriggered ${results.length} parallel workflows (yearStart=${YEAR_START}):\n`);
for (const r of results) {
  const status = r.workflowId ? `✓ ${r.workflowId}` : `✗ ${JSON.stringify(r)}`;
  console.log(`  ${r.make.padEnd(16)} ${status}`);
}

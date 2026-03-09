import "dotenv/config";
import { prisma } from "../lib/db";
import { enrichRecall } from "../lib/enrichment";

// ─── CLI Flags ───────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const batchSize = parseInt(getFlag("--batch-size") ?? "50", 10);
const targetMakeName = getFlag("--make");
const concurrency = parseInt(getFlag("--concurrency") ?? "3", 10);
const dryRun = hasFlag("--dry-run");

// ─── Concurrency Pool ────────────────────────────────────────────

async function processInConcurrentBatches<T>(
  items: T[],
  maxConcurrency: number,
  processor: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    await Promise.allSettled(batch.map(processor));
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  // Build query for unenriched recalls
  const whereClause = targetMakeName
    ? {
        enrichedAt: null,
        vehicleYear: {
          model: {
            make: {
              name: targetMakeName.toUpperCase(),
            },
          },
        },
      }
    : { enrichedAt: null };

  const total = await prisma.recall.count({ where: whereClause });
  console.log(`Found ${total} unenriched recalls to process.`);

  if (dryRun) {
    console.log("Dry run mode — no LLM calls will be made.");
    await prisma.$disconnect();
    return;
  }

  if (total === 0) {
    console.log("Nothing to enrich.");
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Process in batches
  for (let offset = 0; offset < total; offset += batchSize) {
    const recalls = await prisma.recall.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      take: batchSize,
      skip: offset,
    });

    await processInConcurrentBatches(
      recalls,
      concurrency,
      async (recall) => {
        try {
          const result = await enrichRecall({
            component: recall.component,
            summaryRaw: recall.summaryRaw,
            consequenceRaw: recall.consequenceRaw,
            remedyRaw: recall.remedyRaw,
          });

          if (result) {
            await prisma.recall.update({
              where: { id: recall.id },
              data: {
                summaryEnriched: result.summary,
                consequenceEnriched: result.consequence,
                remedyEnriched: result.remedy,
                enrichedAt: new Date(),
              },
            });
            succeeded++;
          } else {
            failed++;
          }
        } catch (err) {
          console.warn(
            `  Warning: failed to enrich recall ${recall.nhtsaCampaignNumber}: ${err instanceof Error ? err.message : String(err)}`,
          );
          failed++;
        }
        processed++;
      },
    );

    const percent = ((processed / total) * 100).toFixed(1);
    console.log(
      `Enriched ${processed}/${total} recalls (${percent}%)...`,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`
═══════════════════════════════════
  ENRICHMENT COMPLETE
═══════════════════════════════════
  Total processed:  ${processed}
  Succeeded:        ${succeeded}
  Failed:           ${failed}
  Total time:       ${elapsed}s
═══════════════════════════════════`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

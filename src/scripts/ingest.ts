import "dotenv/config";
import { prisma } from "../lib/db";
import { getAllMakes, getModelsForMake, getRecallsByVehicle } from "../lib/nhtsa-client";
import { slugify, classifySeverity, parseNhtsaDate } from "../lib/utils";
import { DEFAULT_YEAR_START, DEFAULT_YEAR_END } from "../lib/constants";
import { getRequestStats } from "../lib/rate-limiter";

// ─── CLI Flag Parsing ────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const makesOnly = hasFlag("--makes-only");
const recallsOnly = hasFlag("--recalls");
const allMakes = hasFlag("--all-makes");
const dryRun = hasFlag("--dry-run");
const targetMakeName = getFlag("--make");
const yearStart = parseInt(getFlag("--year-start") ?? String(DEFAULT_YEAR_START), 10);
const yearEnd = parseInt(getFlag("--year-end") ?? String(DEFAULT_YEAR_END), 10);
const limit = getFlag("--limit") ? parseInt(getFlag("--limit")!, 10) : undefined;

// ─── Pipeline ────────────────────────────────────────────────────

const startTime = Date.now();
let makesProcessed = 0;
let modelsUpserted = 0;
let recallsUpserted = 0;

async function syncMakes(): Promise<void> {
  console.log("── Syncing makes from NHTSA vPIC API...");
  const popularOnly = !allMakes;
  const nhtsaMakes = await getAllMakes(popularOnly);

  console.log(`   Found ${nhtsaMakes.length} makes to sync`);

  const logEntry = await prisma.ingestionLog.create({
    data: { runType: "sync-makes", status: "started" },
  });

  let saved = 0;
  for (const make of nhtsaMakes) {
    await prisma.make.upsert({
      where: { nhtsaId: make.Make_ID },
      create: {
        name: make.Make_Name,
        slug: slugify(make.Make_Name),
        nhtsaId: make.Make_ID,
      },
      update: { name: make.Make_Name },
    });
    saved++;
  }

  await prisma.ingestionLog.update({
    where: { id: logEntry.id },
    data: {
      status: "completed",
      recordsFound: nhtsaMakes.length,
      recordsSaved: saved,
      completedAt: new Date(),
    },
  });

  makesProcessed = saved;
  console.log(`   ✓ Synced ${saved} makes`);
}

async function syncModelsForMake(
  makeId: number,
  makeName: string,
  dbMakeId: number,
): Promise<void> {
  const nhtsaModels = await getModelsForMake(makeId);

  for (const model of nhtsaModels) {
    await prisma.model.upsert({
      where: {
        makeId_slug: {
          makeId: dbMakeId,
          slug: slugify(model.Model_Name),
        },
      },
      create: {
        makeId: dbMakeId,
        name: model.Model_Name,
        slug: slugify(model.Model_Name),
      },
      update: { name: model.Model_Name },
    });
    modelsUpserted++;
  }

  console.log(
    `   ✓ ${makeName}: ${nhtsaModels.length} models synced`,
  );
}

async function fetchRecallsForModel(
  makeId: number,
  makeName: string,
  modelId: number,
  modelName: string,
  modelSlug: string,
): Promise<void> {
  for (let year = yearStart; year <= yearEnd; year++) {
    try {
      if (dryRun) continue;

      const recalls = await getRecallsByVehicle(makeName, modelName, year);
      if (recalls.length === 0) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      // Upsert VehicleYear
      const vehicleYear = await prisma.vehicleYear.upsert({
        where: { modelId_year: { modelId, year } },
        create: { modelId, year },
        update: {},
      });

      // Upsert each recall
      for (const recall of recalls) {
        await prisma.recall.upsert({
          where: { nhtsaCampaignNumber: recall.NHTSACampaignNumber },
          create: {
            vehicleYearId: vehicleYear.id,
            nhtsaCampaignNumber: recall.NHTSACampaignNumber,
            component: recall.Component,
            summaryRaw: recall.Summary,
            consequenceRaw: recall.Consequence,
            remedyRaw: recall.Remedy,
            reportReceivedDate: parseNhtsaDate(recall.ReportReceivedDate),
            manufacturer: recall.Manufacturer ?? null,
            severityLevel: classifySeverity(recall.Component),
          },
          update: {
            component: recall.Component,
            summaryRaw: recall.Summary,
            consequenceRaw: recall.Consequence,
            remedyRaw: recall.Remedy,
          },
        });
        recallsUpserted++;
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(
        `   ✗ Error for ${makeName} ${modelName} ${year}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

async function main(): Promise<void> {
  try {
    // Step 1: Sync makes (unless --recalls flag skips this)
    if (!recallsOnly) {
      await syncMakes();
    }

    if (makesOnly) {
      console.log("   --makes-only flag set, stopping after make sync.");
      return;
    }

    // Step 2: Load makes from DB (filtered if --make provided)
    const dbMakesQuery = targetMakeName
      ? {
          where: {
            name: {
              equals: targetMakeName.toUpperCase(),
            },
          },
          include: { models: true },
        }
      : { include: { models: true } };

    let dbMakes = await prisma.make.findMany(dbMakesQuery as Parameters<typeof prisma.make.findMany>[0]);

    // Filter case-insensitively if --make provided
    if (targetMakeName) {
      dbMakes = dbMakes.filter(
        (m) => m.name.toUpperCase() === targetMakeName.toUpperCase(),
      );
      if (dbMakes.length === 0) {
        console.error(`   ✗ No make found matching "${targetMakeName}" in database. Run ingest first.`);
        return;
      }
    }

    if (limit) {
      dbMakes = dbMakes.slice(0, limit);
    }

    console.log(`\n── Syncing models for ${dbMakes.length} makes...`);

    // Step 3: Sync models
    for (const dbMake of dbMakes) {
      if (!dbMake.nhtsaId) continue;
      try {
        await syncModelsForMake(dbMake.nhtsaId, dbMake.name, dbMake.id);
      } catch (err) {
        console.error(
          `   ✗ Error syncing models for ${dbMake.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (dryRun) {
      console.log("\n── Dry run mode — skipping recall fetching.");
      return;
    }

    // Step 4: Fetch recalls for each model
    console.log(
      `\n── Fetching recalls (years ${yearStart}–${yearEnd})...`,
    );

    const logEntry = await prisma.ingestionLog.create({
      data: {
        runType: "fetch-recalls",
        targetMake: targetMakeName ?? null,
        status: "started",
      },
    });

    try {
      for (const dbMake of dbMakes) {
        const dbModels = await prisma.model.findMany({
          where: { makeId: dbMake.id },
        });

        console.log(`   Processing ${dbMake.name} (${dbModels.length} models)...`);

        for (const dbModel of dbModels) {
          if (!dbMake.nhtsaId) continue;
          await fetchRecallsForModel(
            dbMake.nhtsaId,
            dbMake.name,
            dbModel.id,
            dbModel.name,
            dbModel.slug,
          );
        }
      }

      await prisma.ingestionLog.update({
        where: { id: logEntry.id },
        data: {
          status: "completed",
          recordsSaved: recallsUpserted,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      await prisma.ingestionLog.update({
        where: { id: logEntry.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
      throw err;
    }
  } finally {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const { totalRequests } = getRequestStats();

    console.log(`
═══════════════════════════════════
  PIPELINE COMPLETE
═══════════════════════════════════
  Makes processed:   ${makesProcessed}
  Models upserted:   ${modelsUpserted}
  Recalls upserted:  ${recallsUpserted}
  API requests:      ${totalRequests}
  Total time:        ${elapsed}s
═══════════════════════════════════`);

    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import "dotenv/config";
import { prisma } from "../lib/db";
import { slugify } from "../lib/utils";
import { SeverityLevel } from "@prisma/client";

async function main(): Promise<void> {
  console.log("Seeding test data...");

  const toyota = await prisma.make.upsert({
    where: { slug: "toyota" },
    create: { name: "TOYOTA", slug: "toyota", nhtsaId: 99999 },
    update: {},
  });

  const camry = await prisma.model.upsert({
    where: { makeId_slug: { makeId: toyota.id, slug: "camry" } },
    create: { makeId: toyota.id, name: "CAMRY", slug: "camry" },
    update: {},
  });

  const vehicleYear = await prisma.vehicleYear.upsert({
    where: { modelId_year: { modelId: camry.id, year: 2020 } },
    create: { modelId: camry.id, year: 2020 },
    update: {},
  });

  await prisma.recall.upsert({
    where: { nhtsaCampaignNumber: "TEST-001" },
    create: {
      vehicleYearId: vehicleYear.id,
      nhtsaCampaignNumber: "TEST-001",
      component: "FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP",
      summaryRaw:
        "Toyota is recalling certain 2019-2020 Camry vehicles. The fuel pump may fail.",
      consequenceRaw:
        "If the fuel pump fails, the engine may stall, increasing the risk of a crash.",
      remedyRaw:
        "Toyota will notify owners, and dealers will replace the fuel pump free of charge.",
      reportReceivedDate: new Date("2020-04-11"),
      manufacturer: "Toyota Motor Engineering & Manufacturing",
      severityLevel: SeverityLevel.CRITICAL,
    },
    update: {},
  });

  console.log("✓ Test data seeded: Toyota Camry 2020 with 1 recall");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

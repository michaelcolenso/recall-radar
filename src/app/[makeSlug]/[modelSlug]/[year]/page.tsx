import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SeverityLevel } from "@prisma/client";
import { VehicleBreadcrumbs } from "@/components/vehicle-breadcrumbs";
import { RecallCard } from "@/components/recall-card";
import { LocalDealerLeadGen } from "@/components/local-dealer-lead-gen";
import { SeverityBadge } from "@/components/severity-badge";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 43200;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ makeSlug: string; modelSlug: string; year: string }>;
}

const SEVERITY_ORDER: SeverityLevel[] = [
  SeverityLevel.CRITICAL,
  SeverityLevel.HIGH,
  SeverityLevel.MEDIUM,
  SeverityLevel.LOW,
  SeverityLevel.UNKNOWN,
];

function getHighestSeverity(
  recalls: { severityLevel: SeverityLevel }[],
): SeverityLevel {
  for (const level of SEVERITY_ORDER) {
    if (recalls.some((r) => r.severityLevel === level)) return level;
  }
  return SeverityLevel.UNKNOWN;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export async function generateStaticParams() {
  try {
    const vehicleYears = await prisma.vehicleYear.findMany({
      select: {
        year: true,
        model: { select: { slug: true, make: { select: { slug: true } } } },
      },
    });
    return vehicleYears.map((vy) => ({
      makeSlug: vy.model.make.slug,
      modelSlug: vy.model.slug,
      year: String(vy.year),
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { makeSlug, modelSlug, year } = await params;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://recallradar.com";

  const vehicleYear = await prisma.vehicleYear.findFirst({
    where: {
      year: parseInt(year),
      model: { slug: modelSlug, make: { slug: makeSlug } },
    },
    include: {
      model: { include: { make: true } },
      recalls: { orderBy: { severityLevel: "asc" }, take: 1 },
    },
  });

  if (!vehicleYear) return {};

  const makeName = toTitleCase(vehicleYear.model.make.name);
  const modelName = toTitleCase(vehicleYear.model.name);
  const topComponent = vehicleYear.recalls[0]?.component ?? null;
  const canonicalUrl = `${siteUrl}/${makeSlug}/${modelSlug}/${year}`;

  const recallCount = await prisma.recall.count({
    where: { vehicleYearId: vehicleYear.id },
  });

  const title = topComponent
    ? `${year} ${makeName} ${modelName} Recalls: ${topComponent} Issues Explained | RecallRadar`
    : `${year} ${makeName} ${modelName} Recall & Safety Information | RecallRadar`;

  const description = `Check ${recallCount} known recall${recallCount !== 1 ? "s" : ""} for the ${year} ${makeName} ${modelName}. Get plain-English explanations${topComponent ? ` of ${topComponent.toLowerCase()} issues` : ""} and find out how to get free repairs at your local dealer.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
    },
  };
}

export default async function VehicleYearPage({ params }: PageProps) {
  const { makeSlug, modelSlug, year } = await params;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://recallradar.com";

  const vehicleYear = await prisma.vehicleYear.findFirst({
    where: {
      year: parseInt(year),
      model: { slug: modelSlug, make: { slug: makeSlug } },
    },
    include: {
      model: { include: { make: true } },
      recalls: { orderBy: { reportReceivedDate: "desc" } },
    },
  });

  if (!vehicleYear) notFound();

  const makeName = toTitleCase(vehicleYear.model.make.name);
  const modelName = toTitleCase(vehicleYear.model.name);
  const recalls = vehicleYear.recalls;
  const highestSeverity = getHighestSeverity(recalls);

  const dateRange =
    recalls.length > 0
      ? (() => {
          const dates = recalls
            .filter((r) => r.reportReceivedDate)
            .map((r) => r.reportReceivedDate!.getTime());
          if (dates.length === 0) return null;
          const min = new Date(Math.min(...dates));
          const max = new Date(Math.max(...dates));
          return min.getFullYear() === max.getFullYear()
            ? String(min.getFullYear())
            : `${min.getFullYear()}–${max.getFullYear()}`;
        })()
      : null;

  // JSON-LD: FAQPage
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: recalls.map((recall) => ({
      "@type": "Question",
      name: `What is the ${recall.component} recall for the ${year} ${makeName} ${modelName}? (Campaign #${recall.nhtsaCampaignNumber})`,
      acceptedAnswer: {
        "@type": "Answer",
        text: [
          recall.summaryEnriched ?? recall.summaryRaw,
          recall.consequenceEnriched ?? recall.consequenceRaw,
          recall.remedyEnriched ?? recall.remedyRaw,
        ].join(" "),
      },
    })),
  };

  // JSON-LD: BreadcrumbList
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: makeName,
        item: `${siteUrl}/${makeSlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: modelName,
        item: `${siteUrl}/${makeSlug}/${modelSlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: year,
        item: `${siteUrl}/${makeSlug}/${modelSlug}/${year}`,
      },
    ],
  };

  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <VehicleBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: makeName, href: `/${makeSlug}` },
            { label: modelName, href: `/${makeSlug}/${modelSlug}` },
            { label: year, href: `/${makeSlug}/${modelSlug}/${year}` },
          ]}
        />

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-4">
          {year} {makeName} {modelName} Recalls
        </h1>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg text-sm">
          <div>
            <span className="font-semibold text-gray-900">
              {recalls.length}
            </span>{" "}
            <span className="text-gray-500">
              recall{recalls.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Highest severity:</span>
            <SeverityBadge severity={highestSeverity} />
          </div>
          {dateRange && (
            <div>
              <span className="text-gray-500">Reported: </span>
              <span className="font-medium text-gray-900">{dateRange}</span>
            </div>
          )}
        </div>

        {/* Dealer lead gen */}
        <LocalDealerLeadGen makeName={makeName} />

        {/* Recall cards */}
        <div>
          {recalls.map((recall) => (
            <RecallCard
              key={recall.id}
              nhtsaCampaignNumber={recall.nhtsaCampaignNumber}
              component={recall.component}
              reportReceivedDate={recall.reportReceivedDate}
              severityLevel={recall.severityLevel}
              summaryEnriched={recall.summaryEnriched}
              consequenceEnriched={recall.consequenceEnriched}
              remedyEnriched={recall.remedyEnriched}
              summaryRaw={recall.summaryRaw}
              consequenceRaw={recall.consequenceRaw}
              remedyRaw={recall.remedyRaw}
            />
          ))}
        </div>
      </div>
    </>
  );
}

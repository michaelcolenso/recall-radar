import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { VehicleBreadcrumbs } from "@/components/vehicle-breadcrumbs";
import { SeverityBadge } from "@/components/severity-badge";
import { SeverityLevel } from "@prisma/client";

export const revalidate = 86400;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ makeSlug: string; modelSlug: string }>;
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

export async function generateStaticParams() {
  try {
    const models = await prisma.model.findMany({
      select: { slug: true, make: { select: { slug: true } } },
    });
    return models.map((m) => ({
      makeSlug: m.make.slug,
      modelSlug: m.slug,
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { makeSlug, modelSlug } = await params;

  const model = await prisma.model.findFirst({
    where: { slug: modelSlug, make: { slug: makeSlug } },
    include: { make: true },
  });
  if (!model) return {};

  const makeName =
    model.make.name.charAt(0) + model.make.name.slice(1).toLowerCase();
  const modelName =
    model.name.charAt(0) + model.name.slice(1).toLowerCase();

  return {
    title: `${makeName} ${modelName} Recalls — Safety Issues by Year | RecallRadar`,
    description: `Browse ${makeName} ${modelName} recalls by year. Find safety issues and free dealer repairs.`,
    alternates: { canonical: `/${makeSlug}/${modelSlug}` },
    openGraph: {
      title: `${makeName} ${modelName} Recalls — Safety Issues by Year | RecallRadar`,
      description: `Browse ${makeName} ${modelName} recalls by year.`,
      url: `/${makeSlug}/${modelSlug}`,
      type: "website",
    },
  };
}

export default async function ModelPage({ params }: PageProps) {
  const { makeSlug, modelSlug } = await params;

  const model = await prisma.model.findFirst({
    where: { slug: modelSlug, make: { slug: makeSlug } },
    include: {
      make: true,
      vehicleYears: {
        include: {
          recalls: { select: { severityLevel: true } },
        },
        orderBy: { year: "desc" },
      },
    },
  });

  if (!model) notFound();

  const makeName =
    model.make.name.charAt(0) + model.make.name.slice(1).toLowerCase();
  const modelName =
    model.name.charAt(0) + model.name.slice(1).toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <VehicleBreadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: makeName, href: `/${makeSlug}` },
          { label: modelName, href: `/${makeSlug}/${modelSlug}` },
        ]}
      />

      <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
        {makeName} {modelName} Recalls by Year
      </h1>
      <p className="text-gray-600 mb-8">
        {model.vehicleYears.length} model years with recall data
      </p>

      <div className="grid gap-3">
        {model.vehicleYears.map((vy) => {
          const highestSeverity = getHighestSeverity(vy.recalls);
          return (
            <Link
              key={vy.id}
              href={`/${makeSlug}/${modelSlug}/${vy.year}`}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{vy.year}</p>
                <p className="text-sm text-gray-500">
                  {vy.recalls.length} recall
                  {vy.recalls.length !== 1 ? "s" : ""}
                </p>
              </div>
              <SeverityBadge severity={highestSeverity} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

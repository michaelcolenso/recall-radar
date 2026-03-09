import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { VehicleBreadcrumbs } from "@/components/vehicle-breadcrumbs";

export const revalidate = 86400;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ makeSlug: string }>;
}

export async function generateStaticParams() {
  try {
    const makes = await prisma.make.findMany({ select: { slug: true } });
    return makes.map((m) => ({ makeSlug: m.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { makeSlug } = await params;
  const make = await prisma.make.findUnique({ where: { slug: makeSlug } });
  if (!make) return {};

  const displayName = make.name.charAt(0) + make.name.slice(1).toLowerCase();
  return {
    title: `${displayName} Recalls — Complete Safety Database | RecallRadar`,
    description: `Browse all ${displayName} vehicle recalls organized by model and year. Find safety issues and free dealer repairs.`,
    alternates: {
      canonical: `/${makeSlug}`,
    },
    openGraph: {
      title: `${displayName} Recalls — Complete Safety Database | RecallRadar`,
      description: `Browse all ${displayName} vehicle recalls organized by model and year.`,
      url: `/${makeSlug}`,
      type: "website",
    },
  };
}

export default async function MakePage({ params }: PageProps) {
  const { makeSlug } = await params;

  const make = await prisma.make.findUnique({
    where: { slug: makeSlug },
    include: {
      models: {
        include: {
          vehicleYears: {
            include: { _count: { select: { recalls: true } } },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!make) notFound();

  const displayName =
    make.name.charAt(0) + make.name.slice(1).toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <VehicleBreadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: displayName, href: `/${makeSlug}` },
        ]}
      />

      <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
        {displayName} Vehicle Recalls &amp; Safety Issues
      </h1>
      <p className="text-gray-600 mb-8">
        {make.models.length} models with recall information
      </p>

      <div className="grid gap-3">
        {make.models.map((model) => {
          const totalRecalls = model.vehicleYears.reduce(
            (sum, vy) => sum + vy._count.recalls,
            0,
          );
          const years = model.vehicleYears.map((vy) => vy.year).sort((a, b) => a - b);
          const yearRange =
            years.length > 0
              ? years.length === 1
                ? `${years[0]}`
                : `${years[0]}–${years[years.length - 1]}`
              : null;

          return (
            <Link
              key={model.id}
              href={`/${makeSlug}/${model.slug}`}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{model.name}</p>
                {yearRange && (
                  <p className="text-sm text-gray-500">{yearRange}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {totalRecalls.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">recalls</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

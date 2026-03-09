import Link from "next/link";
import { prisma } from "@/lib/db";
import { ShieldAlert } from "lucide-react";

export const revalidate = 86400;

const POPULAR_MAKES_DISPLAY = [
  { name: "TOYOTA", slug: "toyota" },
  { name: "FORD", slug: "ford" },
  { name: "CHEVROLET", slug: "chevrolet" },
  { name: "HONDA", slug: "honda" },
  { name: "NISSAN", slug: "nissan" },
  { name: "BMW", slug: "bmw" },
  { name: "MERCEDES-BENZ", slug: "mercedes-benz" },
  { name: "VOLKSWAGEN", slug: "volkswagen" },
  { name: "HYUNDAI", slug: "hyundai" },
  { name: "KIA", slug: "kia" },
  { name: "SUBARU", slug: "subaru" },
  { name: "AUDI", slug: "audi" },
  { name: "JEEP", slug: "jeep" },
  { name: "DODGE", slug: "dodge" },
  { name: "GMC", slug: "gmc" },
  { name: "RAM", slug: "ram" },
  { name: "LEXUS", slug: "lexus" },
  { name: "MAZDA", slug: "mazda" },
  { name: "TESLA", slug: "tesla" },
  { name: "VOLVO", slug: "volvo" },
];

async function getStats() {
  try {
    const [recallCount, makeCount, vehicleCount] = await Promise.all([
      prisma.recall.count(),
      prisma.make.count(),
      prisma.vehicleYear.count(),
    ]);
    return { recallCount, makeCount, vehicleCount };
  } catch {
    return { recallCount: 0, makeCount: 0, vehicleCount: 0 };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero */}
      <section className="text-center mb-16">
        <div className="flex justify-center mb-4">
          <ShieldAlert className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Is Your Car Safe?
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Search thousands of vehicle recalls from the NHTSA database. Get
          plain-English explanations and find free dealer repairs.
        </p>
      </section>

      {/* Stats */}
      {stats.recallCount > 0 && (
        <section className="grid grid-cols-3 gap-4 mb-12 max-w-2xl mx-auto text-center">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-gray-900">
              {stats.recallCount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Recalls Tracked</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-gray-900">
              {stats.vehicleCount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Vehicles Covered</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-2xl font-bold text-gray-900">
              {stats.makeCount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Manufacturers</p>
          </div>
        </section>
      )}

      {/* Make Grid */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Browse by Manufacturer
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {POPULAR_MAKES_DISPLAY.map((make) => (
            <Link
              key={make.slug}
              href={`/${make.slug}`}
              className="flex items-center justify-center p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-sm font-medium text-gray-700 hover:text-blue-700 transition-colors"
            >
              {make.name.charAt(0) + make.name.slice(1).toLowerCase().replace(/-([a-z])/g, (_, c) => "-" + c.toUpperCase())}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

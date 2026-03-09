import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://recallradar.com";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  try {
    const [makes, models, vehicleYears] = await Promise.all([
      prisma.make.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.model.findMany({
        select: { slug: true, updatedAt: true, make: { select: { slug: true } } },
      }),
      prisma.vehicleYear.findMany({
        select: {
          year: true,
          updatedAt: true,
          model: { select: { slug: true, make: { select: { slug: true } } } },
        },
      }),
    ]);

    const makePages: MetadataRoute.Sitemap = makes.map((m) => ({
      url: `${baseUrl}/${m.slug}`,
      lastModified: m.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const modelPages: MetadataRoute.Sitemap = models.map((m) => ({
      url: `${baseUrl}/${m.make.slug}/${m.slug}`,
      lastModified: m.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const yearPages: MetadataRoute.Sitemap = vehicleYears.map((vy) => ({
      url: `${baseUrl}/${vy.model.make.slug}/${vy.model.slug}/${vy.year}`,
      lastModified: vy.updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    }));

    return [...staticPages, ...makePages, ...modelPages, ...yearPages];
  } catch {
    return staticPages;
  }
}

import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://recallradar.com";

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/scripts/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

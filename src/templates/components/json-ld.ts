import { escapeHtml } from "../../lib/utils";

interface FaqItem {
  campaign: string;
  component: string;
  make: string;
  model: string;
  year: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportReceivedDate?: string | null;
}

export function faqPageJsonLd(recalls: FaqItem[], pageUrl?: string): string {
  if (recalls.length === 0) return "";

  const entities = recalls.map((r) => ({
    "@type": "Question",
    name: `What is the ${r.component} recall for the ${r.year} ${r.make} ${r.model}? (Campaign #${r.campaign})`,
    acceptedAnswer: {
      "@type": "Answer",
      text: `${r.summary} ${r.consequence} ${r.remedy}`,
      datePublished: r.reportReceivedDate ?? undefined,
    },
  }));

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  };

  if (pageUrl) {
    schema.url = pageUrl;
  }

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

interface BreadcrumbItem {
  name: string;
  item: string;
}

export function breadcrumbListJsonLd(siteUrl: string, items: BreadcrumbItem[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.item,
    })),
  };

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

interface OrganizationSchema {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

export function websiteJsonLd(siteUrl: string, siteName: string, description: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: siteUrl,
    name: siteName,
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

export function organizationJsonLd(org: OrganizationSchema): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    url: org.url,
    ...(org.logo ? { logo: org.logo } : {}),
    ...(org.sameAs ? { sameAs: org.sameAs } : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

export function vehicleJsonLd(make: string, model: string, year: number, pageUrl: string, recallCount: number): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${year} ${make} ${model}`,
    vehicleModelDate: String(year),
    manufacturer: {
      "@type": "Organization",
      name: make,
    },
    url: pageUrl,
    ...(recallCount > 0
      ? { vehicleSeatingCapacity: undefined, knownVehicleDamages: [`${recallCount} active safety recall${recallCount !== 1 ? "s" : ""}`] }
      : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

// Legacy export for backwards compatibility
export const pageJsonLd = (payload: Record<string, unknown>): string =>
  `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;

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

export function faqPageJsonLd(recalls: FaqItem[], pageUrl?: string, dateModified?: string): string {
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

  if (dateModified) {
    schema.dateModified = dateModified;
  }

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

interface BreadcrumbItem {
  name: string;
  item: string;
}

// siteUrl kept for call-site compatibility but not used internally
export function breadcrumbListJsonLd(_siteUrl: string, items: BreadcrumbItem[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, i) => {
      const listItem: Record<string, unknown> = {
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
      };
      if (crumb.item) {
        listItem.item = crumb.item;
      }
      return listItem;
    }),
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
      ? {
          description: `${recallCount} active safety recall${recallCount !== 1 ? "s" : ""} on record for the ${year} ${make} ${model}.`,
        }
      : { description: `No active safety recalls on record for the ${year} ${make} ${model}.` }),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

interface ItemListEntry {
  name: string;
  url: string;
  description?: string;
}

export function itemListJsonLd(name: string, items: ItemListEntry[], pageUrl?: string): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
  if (pageUrl) {
    schema.url = pageUrl;
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

interface ArticleSchema {
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  image?: string;
}

export function articleJsonLd(article: ArticleSchema): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    description: article.description,
    url: article.url,
    ...(article.datePublished ? { datePublished: article.datePublished } : {}),
    ...(article.dateModified ? { dateModified: article.dateModified } : {}),
    ...(article.author ? { author: { "@type": "Organization", name: article.author } } : {}),
    ...(article.image ? { image: article.image } : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

// Legacy export for backwards compatibility
export const pageJsonLd = (payload: Record<string, unknown>): string =>
  `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;

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
}

export function faqPageJsonLd(recalls: FaqItem[]): string {
  if (recalls.length === 0) return "";

  const entities = recalls.map((r) => ({
    "@type": "Question",
    name: `What is the ${r.component} recall for the ${r.year} ${r.make} ${r.model}? (Campaign #${r.campaign})`,
    acceptedAnswer: {
      "@type": "Answer",
      text: `${r.summary} ${r.consequence} ${r.remedy}`,
    },
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  };

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

interface BreadcrumbItem {
  name: string;
  item: string;
}

export function breadcrumbListJsonLd(
  siteUrl: string,
  items: BreadcrumbItem[]
): string {
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

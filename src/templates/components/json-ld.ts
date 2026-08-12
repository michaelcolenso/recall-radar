import { escapeHtml, slugify } from "../../lib/utils";

/**
 * Serializes a JSON-LD payload for embedding in a <script type="application/ld+json">
 * tag. JSON.stringify alone would preserve a literal "</script" sequence coming
 * from any interpolated field (component/make/model text, summaries, etc.),
 * letting the HTML parser close the tag early and treat the remainder as markup.
 * Escaping "<" (and "&"/">" for good measure) as \uXXXX keeps it valid JSON that
 * still parses to the exact same value.
 */
function jsonLdScript(schema: unknown): string {
  const json = JSON.stringify(schema)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return `<script type="application/ld+json">${json}</script>`;
}

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

export function faqPageJsonLd(
  recalls: FaqItem[],
  pageUrl?: string,
  dateModified?: string,
  riskGrade?: string | null,
  recallCount?: number,
  topSeverity?: string | null,
): string {
  const entities: Array<Record<string, unknown>> = [];

  // Curated overview questions (always included if data available)
  if (riskGrade) {
    entities.push({
      "@type": "Question",
      name: `What is the overall risk grade for the ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `The ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""} has a risk grade of ${riskGrade}. This grade is calculated from ${recallCount ?? recalls.length} NHTSA safety recalls, weighted by severity, recency, and temporal decay. Grades range from A+ (excellent) to F (avoid).`,
      },
    });
  }

  if (recallCount !== undefined && recallCount > 0) {
    entities.push({
      "@type": "Question",
      name: `How many safety recalls does the ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""} have?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `The ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""} has ${recallCount} known safety recall${recallCount !== 1 ? "s" : ""} on record. All recalls are repaired free of charge at authorized dealerships.`,
      },
    });
  }

  if (topSeverity && topSeverity !== "UNKNOWN") {
    entities.push({
      "@type": "Question",
      name: `What is the most severe recall for the ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `The most severe recall for the ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""} is classified as ${topSeverity.toLowerCase()}. This indicates a ${topSeverity === "CRITICAL" ? "life-threatening safety issue" : topSeverity === "HIGH" ? "serious safety concern" : topSeverity === "MEDIUM" ? "moderate safety issue" : "minor safety issue"} that should be addressed promptly.`,
      },
    });
  }

  if (recalls.length > 0) {
    entities.push({
      "@type": "Question",
      name: `Is the ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""} safe to drive?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `The ${recalls[0]?.year ?? ""} ${recalls[0]?.make ?? ""} ${recalls[0]?.model ?? ""} ${recalls.length === 0 ? "has no open safety recalls on record." : `has ${recalls.length} open safety recall${recalls.length !== 1 ? "s" : ""}. While the vehicle may still be driven, owners should contact an authorized dealership to schedule free repairs for any outstanding recalls. Some recalls, especially those classified as critical or high severity, may pose significant safety risks.`}`,
      },
    });
  }

  // Per-recall questions — limit to first 5 to avoid schema bloat and improve rich results eligibility
  for (const r of recalls.slice(0, 5)) {
    entities.push({
      "@type": "Question",
      name: `What is the ${r.component} recall for the ${r.year} ${r.make} ${r.model}? (Campaign #${r.campaign})`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${r.summary} ${r.consequence} ${r.remedy}`,
        datePublished: r.reportReceivedDate ?? undefined,
      },
    });
  }

  if (entities.length === 0) return "";

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

  return jsonLdScript(schema);
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

  return jsonLdScript(schema);
}

interface OrganizationSchema {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

export function websiteJsonLd(siteUrl: string, siteName: string, description: string): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: siteUrl,
    name: siteName,
    description,
    potentialAction: {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return jsonLdScript(schema);
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
  return jsonLdScript(schema);
}

export function vehicleJsonLd(make: string, model: string, year: number, pageUrl: string, recallCount: number): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${year} ${make} ${model}`,
    vehicleModelDate: String(year),
    manufacturer: {
      "@type": "Organization",
      name: make,
    },
    url: pageUrl,
    image: `${pageUrl.replace(/\/[^/]+\/[^/]+\/[^/]+$/, "")}/og/${slugify(make)}/${slugify(model)}/${year}.svg`,
    ...(recallCount > 0
      ? {
          description: `${recallCount} active safety recall${recallCount !== 1 ? "s" : ""} on record for the ${year} ${make} ${model}.`,
        }
      : { description: `No active safety recalls on record for the ${year} ${make} ${model}.` }),
  };
  return jsonLdScript(schema);
}

export function aggregateRatingJsonLd(pageUrl: string, ratingValue: number, reviewCount: number): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    ratingValue,
    bestRating: 5,
    worstRating: 1,
    reviewCount,
    url: pageUrl,
  };
  return jsonLdScript(schema);
}

interface HowToStep {
  name: string;
  text: string;
}

export function howToJsonLd(name: string, description: string, steps: HowToStep[], pageUrl?: string): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((step) => ({
      "@type": "HowToStep",
      name: step.name,
      text: step.text,
    })),
  };
  if (pageUrl) {
    schema.url = pageUrl;
  }
  return jsonLdScript(schema);
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
  return jsonLdScript(schema);
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
    "@type": "Article",
    headline: article.headline,
    description: article.description,
    url: article.url,
    ...(article.datePublished ? { datePublished: article.datePublished } : {}),
    ...(article.dateModified ? { dateModified: article.dateModified } : {}),
    ...(article.author ? { author: { "@type": "Organization", name: article.author } } : {}),
    ...(article.image ? { image: article.image } : {}),
  };
  return jsonLdScript(schema);
}

interface ModelOverviewFaqInput {
  make: string;
  model: string;
  totalRecalls: number;
  yearCount: number;
  yearRange: string;
  /** Count/range of years with a verified recall — narrower than yearCount/yearRange, which include tracked years the model may never have existed in. */
  recallYearCount: number;
  recallYearRange: string;
  topComponent?: string;
  pageUrl: string;
  dateModified?: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

type ModelOverviewFaqContentInput = Omit<ModelOverviewFaqInput, "pageUrl" | "dateModified">;

/**
 * Model-level (all-years) FAQ content. Distinct from faqPageJsonLd, which is
 * scoped to a single model year — this covers the aggregate make/model page
 * and always includes a VIN-eligibility disclaimer question.
 *
 * Shared by modelOverviewFaqJsonLd (the JSON-LD schema) and the visible FAQ
 * section rendered in modelPageTemplate — FAQPage structured data must
 * describe content actually present on the page, so the two stay in sync by
 * construction rather than by convention.
 */
export function modelOverviewFaqEntries({
  make,
  model,
  totalRecalls,
  yearCount,
  yearRange,
  recallYearCount,
  recallYearRange,
  topComponent,
}: ModelOverviewFaqContentInput): FaqEntry[] {
  if (yearCount === 0) return [];

  const vehicle = `${make} ${model}`;
  return [
    {
      question: `How many recalls does the ${vehicle} have?`,
      answer:
        totalRecalls > 0
          ? `The ${vehicle} has ${totalRecalls} known NHTSA safety recall${totalRecalls !== 1 ? "s" : ""} across ${recallYearCount} model year${recallYearCount !== 1 ? "s" : ""} (${recallYearRange})${topComponent ? `, most commonly involving ${topComponent.toLowerCase()}` : ""}. All recalls are repaired free of charge at authorized dealerships.`
          : `The ${vehicle} has no NHTSA safety recalls on record across ${yearCount} tracked model year${yearCount !== 1 ? "s" : ""} (${yearRange}). If this model was sold before 2000 or discontinued earlier, those years aren't reflected here.`,
    },
    {
      question: `Which ${vehicle} model years have open recalls?`,
      answer:
        totalRecalls > 0
          ? `Recall history is tracked separately for each ${vehicle} model year. Select a model year above to see exactly which recalls apply to that year.`
          : `No ${vehicle} model years currently have recalls on record. NHTSA issues new recalls regularly, so it's worth checking back or verifying with your specific VIN.`,
    },
    {
      question: `Is the ${vehicle} safe to drive?`,
      answer: `Model-level recall counts describe the ${vehicle} as a whole, not any individual vehicle. Only your VIN can confirm whether a specific car is included in an open recall — use the free VIN check on this page for an authoritative answer.`,
    },
  ];
}

/**
 * Model-level (all-years) FAQ schema. See modelOverviewFaqEntries — the
 * template renders the same entries visibly, so this markup always
 * describes content actually present on the page.
 */
export function modelOverviewFaqJsonLd(input: ModelOverviewFaqInput): string {
  const entries = modelOverviewFaqEntries(input);
  if (entries.length === 0) return "";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
    url: input.pageUrl,
  };
  if (input.dateModified) {
    schema.dateModified = input.dateModified;
  }
  return jsonLdScript(schema);
}

// Legacy export for backwards compatibility
export const pageJsonLd = (payload: Record<string, unknown>): string => jsonLdScript(payload);

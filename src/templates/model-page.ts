import { escapeHtml, makeLogoImg, slugify, titleCase } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

interface YearRow {
  year: number;
  recall_count: number;
  risk_grade: string | null;
  risk_score: number | null;
  highest_severity: SeverityLevel | null;
}

export interface TopComponent {
  name: string;
  count: number;
}

export interface NotableRecall {
  year: number;
  nhtsa_campaign_number: string;
  component: string;
  severity_level: SeverityLevel;
  report_received_date: string | null;
  summary: string;
}

export interface ModelPageOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  years: YearRow[];
  totalRecalls: number;
  topComponents: TopComponent[];
  notableRecalls: NotableRecall[];
  /** Human-readable "last refreshed" date, e.g. "August 2026". */
  lastUpdated?: string;
  /** Optional paid vehicle-history-report CTA, rendered below the free VIN check. */
  affiliateCtaHtml?: string;
}

export interface ModelPageMetaInput {
  make: string;
  model: string;
  totalRecalls: number;
  yearCount: number;
  yearRange: string;
  topComponent?: string;
  lastUpdated?: string;
}

export interface ModelPageMeta {
  title: string;
  description: string;
}

/**
 * Intent-matched <title>/description for the make/model overview page.
 * Pulled out of the route handler so metadata generation — including the
 * zero-recall and no-data branches — is unit-testable without a D1 binding.
 */
export function modelPageMeta({
  make,
  model,
  totalRecalls,
  yearCount,
  yearRange,
  topComponent,
  lastUpdated,
}: ModelPageMetaInput): ModelPageMeta {
  const hasYearData = yearCount > 0;

  if (!hasYearData) {
    return {
      title: `${make} ${model} Recalls & Safety Information | Recalled Rides`,
      description: `We don't have model-year recall data for the ${make} ${model} yet. Check back soon, or verify a specific vehicle with a free VIN check.`,
    };
  }

  if (totalRecalls === 0) {
    return {
      title: `${make} ${model} Recalls: None Found — Affected Years & VIN Check | Recalled Rides`,
      description: `Good news: the ${make} ${model} has no NHTSA safety recalls on record across ${yearCount} model years (${yearRange}). Verify your specific VIN to be sure.`,
    };
  }

  return {
    title: `${make} ${model} Recalls: ${totalRecalls} Found, Affected Years & VIN Check | Recalled Rides`,
    description: `The ${make} ${model} has ${totalRecalls} known NHTSA safety recall${totalRecalls !== 1 ? "s" : ""} across ${yearCount} model years (${yearRange})${topComponent ? `, most often involving ${topComponent.toLowerCase()}` : ""}. See affected years and verify your VIN — data refreshed ${lastUpdated ?? "recently"}.`,
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 40 ? cut.slice(0, lastSpace) : cut}…`;
}

export function modelPageTemplate({
  make,
  makeSlug,
  model,
  modelSlug,
  years,
  totalRecalls,
  topComponents,
  notableRecalls,
  lastUpdated,
  affiliateCtaHtml,
}: ModelPageOptions): string {
  const hasYearData = years.length > 0;
  const recallYears = years.filter((y) => y.recall_count > 0);
  const yearRange = hasYearData ? `${years[years.length - 1].year}–${years[0].year}` : "";
  const leadingSeverity = notableRecalls[0]?.severity_level ?? null;

  const cards = recallYears.map((y) => `
    <a href="/${makeSlug}/${modelSlug}/${y.year}" class="rr-card rr-card--year" aria-label="${y.year}: ${y.recall_count} recall${y.recall_count !== 1 ? 's' : ''}${y.highest_severity ? ', highest severity ' + y.highest_severity.toLowerCase() : ''}">
      <div class="rr-card__title">${y.year}</div>
      ${y.risk_grade ? `<div class="rr-card__risk-grade" style="margin-top: var(--space-4);"><span class="rr-risk-badge rr-risk-badge--${y.risk_grade.charAt(0).toLowerCase()}">${escapeHtml(y.risk_grade)}</span></div>` : ""}
      ${y.highest_severity ? `<div style="margin-top: var(--space-4);">${severityBadge(y.highest_severity)}</div>` : ""}
      <div class="rr-card__meta">${y.recall_count} RECALLS</div>
    </a>
  `).join("");

  const vinCheckHtml = `
    <section class="rr-aff" aria-labelledby="rr-vincheck-title">
      <div class="rr-aff__title" id="rr-vincheck-title">Not Every ${escapeHtml(model)} Is Affected — Check Your VIN</div>
      <p class="rr-aff__text">This page tracks recalls reported for the ${escapeHtml(make)} ${escapeHtml(model)} across every model year we cover. Model and year alone can't confirm whether your specific car is included — only your 17-character Vehicle Identification Number (VIN) is authoritative.</p>
      <a href="/vin-lookup" class="rr-aff__cta">Check Your VIN For Free →</a>
    </section>
    ${affiliateCtaHtml ?? ""}
  `;

  const summaryHtml = hasYearData
    ? totalRecalls > 0
      ? `
        <section class="rr-body" style="margin-top: var(--space-10); max-width: 720px;">
          <p>The ${escapeHtml(make)} ${escapeHtml(model)} has <strong>${totalRecalls} known NHTSA safety recall${totalRecalls !== 1 ? "s" : ""}</strong> across ${years.length} tracked model year${years.length !== 1 ? "s" : ""} (${escapeHtml(yearRange)})${topComponents.length > 0 ? `, most commonly involving <strong>${escapeHtml(titleCase(topComponents[0].name))}</strong>` : ""}.
          ${lastUpdated ? ` Data last refreshed ${escapeHtml(lastUpdated)}.` : ""}</p>
        </section>
      `
      : ""
    : "";

  const topComponentsHtml = topComponents.length > 0
    ? `
      <section style="margin-top: var(--space-10);">
        <h2 class="rr-label" style="margin-bottom: var(--space-4);">Most Common Issues</h2>
        <div class="rr-related-links">
          ${topComponents.map((c) => `<a href="/${makeSlug}/${slugify(c.name)}-recalls" class="rr-related-link">${escapeHtml(titleCase(c.name))} (${c.count})</a>`).join("\n          ")}
        </div>
      </section>
    `
    : "";

  const notableRecallsHtml = notableRecalls.length > 0
    ? `
      <section class="rr-readout-list" aria-labelledby="rr-notable-title">
        <h2 id="rr-notable-title" class="rr-label" style="margin-bottom: var(--space-6);">Recent &amp; Notable Recalls</h2>
        ${notableRecalls.map((r) => {
          const compName = r.component.split(":")[0].trim();
          const yearPath = `/${makeSlug}/${modelSlug}/${r.year}`;
          const campaignPath = `/recall/${encodeURIComponent(r.nhtsa_campaign_number)}`;
          return `
        <article class="rr-readout rr-readout--${r.severity_level.toLowerCase()}">
          <div class="rr-readout__header">
            <div class="rr-readout__header-left">
              ${severityBadge(r.severity_level)}
              <a class="rr-readout__campaign" href="${campaignPath}">#${escapeHtml(r.nhtsa_campaign_number)}</a>
            </div>
            <div class="rr-readout__header-right">
              ${r.report_received_date ? `<div class="rr-readout__date"><time datetime="${escapeHtml(r.report_received_date)}">${escapeHtml(r.report_received_date)}</time></div>` : ""}
            </div>
          </div>
          <div class="rr-readout__body">
            <div class="rr-readout__field">
              <div class="rr-readout__field-label">Vehicle</div>
              <h3 class="rr-readout__field-value"><a href="${yearPath}">${escapeHtml(String(r.year))} ${escapeHtml(make)} ${escapeHtml(model)}</a></h3>
            </div>
            <div class="rr-readout__field">
              <div class="rr-readout__field-label">Component</div>
              <div class="rr-readout__field-value">${escapeHtml(compName)}</div>
            </div>
            <div class="rr-readout__field">
              <div class="rr-readout__field-label">What Happened</div>
              <div class="rr-readout__field-value">${escapeHtml(truncate(r.summary, 220))}</div>
            </div>
          </div>
          <div class="rr-readout__actions">
            <a href="${yearPath}" class="rr-readout__detail-link">View all ${escapeHtml(String(r.year))} ${escapeHtml(make)} ${escapeHtml(model)} recalls →</a>
            <a href="${campaignPath}" class="rr-readout__detail-link">NHTSA campaign #${escapeHtml(r.nhtsa_campaign_number)} details →</a>
          </div>
        </article>`;
        }).join("")}
      </section>
    `
    : "";

  if (!hasYearData) {
    return `
      <section class="rr-section-header">
        ${makeLogoImg(makeSlug, make, "rr-make-logo rr-make-logo--hero")}
        <h1 class="rr-section-header__title">${escapeHtml(make)} ${escapeHtml(model)} Recalls</h1>
        <p class="rr-section-header__subtitle">We don't have model-year recall data for the ${escapeHtml(make)} ${escapeHtml(model)} yet.</p>
      </section>
      <div class="rr-empty">
        <h2 class="rr-empty__title">No Data Yet</h2>
        <p class="rr-empty__text">We haven't ingested model-year data for this vehicle. Check back soon, or verify a specific vehicle with a free VIN check — it queries NHTSA directly and doesn't depend on our database.</p>
        <a href="/vin-lookup" class="rr-empty__action">Check Your VIN Instead</a>
      </div>
      <p style="margin-top: var(--space-8);">
        <a href="/${makeSlug}" class="rr-back-link">Browse other ${escapeHtml(make)} models →</a>
      </p>
    `;
  }

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, make, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(make)} ${escapeHtml(model)} Recalls${totalRecalls > 0 ? `: ${totalRecalls} Found` : ": None Found"}</h1>
      <p class="rr-section-header__subtitle">${totalRecalls > 0 ? `Affected years, leading issues, and a free VIN check for the ${escapeHtml(make)} ${escapeHtml(model)}.` : `Verified recall history and a free VIN check for the ${escapeHtml(make)} ${escapeHtml(model)}.`}</p>
      <div class="rr-meta-bar">
        <span class="rr-meta-bar__count">${years.length} model year${years.length !== 1 ? "s" : ""} tracked (${escapeHtml(yearRange)})</span>
        ${leadingSeverity ? `<span class="rr-meta-bar__notice"><span>Most severe issue:</span>${severityBadge(leadingSeverity)}</span>` : ""}
        ${lastUpdated ? `<span class="rr-meta-bar__notice">Data refreshed ${escapeHtml(lastUpdated)}</span>` : ""}
      </div>
    </section>

    ${summaryHtml}

    ${totalRecalls === 0 ? `
    <section class="rr-good-news" aria-labelledby="good-news-title">
      <svg class="rr-good-news__icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
        <circle cx="32" cy="32" r="28" stroke-dasharray="176" stroke-dashoffset="176" style="animation:rr-draw-circle 0.8s var(--ease-mechanical) 0.2s forwards"/>
        <path d="M20 33l8 8 16-16" stroke-dasharray="40" stroke-dashoffset="40" style="animation:rr-draw-path 0.5s var(--ease-mechanical) 0.7s forwards"/>
      </svg>
      <h2 id="good-news-title" class="rr-good-news__title">All Clear</h2>
      <p class="rr-good-news__text">No safety recalls on record for the ${escapeHtml(make)} ${escapeHtml(model)} across ${years.length} tracked model years (${escapeHtml(yearRange)}). That's great news — but always confirm with your specific VIN, since NHTSA issues new recalls regularly.</p>
    </section>
    ` : ""}

    ${vinCheckHtml}

    ${notableRecallsHtml}

    ${topComponentsHtml}

    <section style="margin-top: var(--space-10);">
      <h2 class="rr-label" style="margin-bottom: var(--space-4);">Recall History by Year</h2>
      <div class="rr-grid rr-grid--years">
        ${cards || `<p class='rr-body'>No individual model years have recalls on record yet. <a href='/${makeSlug}'>Browse other ${escapeHtml(make)} models</a> or check back soon.</p>`}
      </div>
      <p style="margin-top: var(--space-8);">
        <a href="/stats/${makeSlug}/${modelSlug}" class="rr-back-link">
          View ${escapeHtml(make)} ${escapeHtml(model)} recall statistics and reliability scorecard →
        </a>
      </p>
    </section>
  `;
}

import { escapeHtml } from "../lib/utils";
import { severityBadge } from "./components/severity-badge";
import type { SeverityLevel } from "../db/schema";

export const NEW_RECALLS_PAGE_SIZE = 25;

const SEVERITY_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High Priority" },
  { value: "MEDIUM", label: "Moderate" },
  { value: "LOW", label: "Low Priority" },
  { value: "UNKNOWN", label: "Under Review" },
];

export interface NewRecallRow {
  nhtsa_campaign_number: string;
  component: string;
  severity_level: SeverityLevel;
  report_received_date: string | null;
  make_name: string;
  make_slug: string;
  model_name: string;
  model_slug: string;
  year: number;
}

interface NewRecallsPageOptions {
  recalls: NewRecallRow[];
  severity: string;
  page: number;
  totalPages: number;
  totalCount: number;
}

function filterPills(severity: string): string {
  return `
    <nav class="rr-filter" aria-label="Filter recalls by severity">
      ${SEVERITY_FILTERS.map((f) => {
        const active = f.value === severity;
        const href = f.value ? `/new?severity=${encodeURIComponent(f.value)}` : "/new";
        return `
        <a class="rr-filter__pill ${active ? "rr-filter__pill--active" : ""}" href="${href}" ${active ? 'aria-current="page"' : ""}>
          ${f.label}
        </a>`;
      }).join("")}
    </nav>
  `;
}

function pagination(severity: string, page: number, totalPages: number): string {
  if (totalPages <= 1) return "";
  const qs = severity ? `&severity=${encodeURIComponent(severity)}` : "";
  const hrefFor = (p: number) => (p === 1 ? `/new${severity ? `?severity=${encodeURIComponent(severity)}` : ""}` : `/new?page=${p}${qs}`);

  // Windowed page numbers: first, last, current ±2, ellipses.
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: string[] = [];
  let prev: number | null = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) {
      items.push('<span class="rr-pagination__ellipsis" aria-hidden="true">…</span>');
    }
    const current = p === page;
    items.push(`
      <a class="rr-pagination__link ${current ? "rr-pagination__link--current" : ""}" href="${hrefFor(p)}" ${current ? 'aria-current="page"' : ""}>
        ${p}
      </a>`);
    prev = p;
  }

  const prevLink = page > 1
    ? `<a class="rr-pagination__link" href="${hrefFor(page - 1)}" rel="prev">← Newer</a>`
    : `<span class="rr-pagination__link rr-pagination__link--disabled">← Newer</span>`;
  const nextLink = page < totalPages
    ? `<a class="rr-pagination__link" href="${hrefFor(page + 1)}" rel="next">Older →</a>`
    : `<span class="rr-pagination__link rr-pagination__link--disabled">Older →</span>`;

  return `
    <nav class="rr-pagination" aria-label="Pagination">
      ${prevLink}
      <span class="rr-pagination__numbers">${items.join("")}</span>
      ${nextLink}
    </nav>
  `;
}

export function newRecallsPageTemplate({ recalls, severity, page, totalPages, totalCount }: NewRecallsPageOptions): string {
  const severityLabel = SEVERITY_FILTERS.find((f) => f.value === severity)?.label ?? "All";
  const countLabel = severity ? `${totalCount} ${severityLabel.toLowerCase()} recalls` : `${totalCount} recalls`;

  const listHtml = recalls.length > 0
    ? `
    <section class="rr-readout-list">
      <h2 class="sr-only">Newly Reported Recalls</h2>
      ${recalls.map((r) => {
        const compName = r.component.split(":")[0].trim();
        const campaignPath = `/recall/${encodeURIComponent(r.nhtsa_campaign_number)}`;
        const vehiclePath = `/${r.make_slug}/${r.model_slug}/${r.year}`;
        return `
      <article class="rr-readout rr-readout--new">
        <div class="rr-readout__header">
          <div class="rr-readout__header-left">
            ${severityBadge(r.severity_level)}
            <span class="rr-readout__indicator rr-readout__indicator--new">New</span>
          </div>
          <div class="rr-readout__header-right">
            ${r.report_received_date ? `<div class="rr-readout__date"><time datetime="${escapeHtml(r.report_received_date)}">Reported ${escapeHtml(r.report_received_date)}</time></div>` : ""}
          </div>
        </div>
        <div class="rr-readout__body">
          <div class="rr-readout__field">
            <div class="rr-readout__field-label">Vehicle</div>
            <h3 class="rr-readout__field-value">
              <a href="${vehiclePath}">${escapeHtml(String(r.year))} ${escapeHtml(r.make_name)} ${escapeHtml(r.model_name)}</a>
            </h3>
          </div>
          <div class="rr-readout__field">
            <div class="rr-readout__field-label">Component</div>
            <div class="rr-readout__field-value">${escapeHtml(compName)}</div>
          </div>
        </div>
        <div class="rr-readout__actions">
          <a href="${campaignPath}" class="rr-readout__detail-link">View full recall details →</a>
        </div>
      </article>`;
      }).join("")}
    </section>
    `
    : `
    <section class="rr-empty">
      <h2 class="rr-empty__title">No recalls found</h2>
      <p class="rr-empty__text">No ${severityLabel.toLowerCase()} recalls in the recent window. Try a different filter or browse by make.</p>
      <a href="/" class="rr-empty__action">Browse All Makes</a>
    </section>
    `;

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">New Recalls</h1>
      <p class="rr-section-header__body">Most recently reported NHTSA safety recalls — ${countLabel}. Repairs are always free at authorized dealers.</p>
    </section>

    ${filterPills(severity)}

    <div class="rr-meta-bar" style="margin: var(--space-4) 0 var(--space-6);">
      <span class="rr-meta-bar__count">${countLabel} · page ${page} of ${totalPages}</span>
    </div>

    ${listHtml}
    ${pagination(severity, page, totalPages)}
  `;
}

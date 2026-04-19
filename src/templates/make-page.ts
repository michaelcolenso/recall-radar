import { escapeHtml } from "../lib/utils";

interface ModelRow {
  name: string;
  slug: string;
  min_year: number | null;
  max_year: number | null;
  recall_count: number;
}

export function makePageTemplate(makeName: string, makeSlug: string, models: ModelRow[]): string {
  const cards = models.map((m) => {
    const yearRange = m.min_year && m.max_year ? `${m.min_year}–${m.max_year}` : "";
    return `
      <a href="/${makeSlug}/${m.slug}" class="rr-card">
        <div class="rr-card__title">${escapeHtml(m.name)}</div>
        ${yearRange ? `<div class="rr-card__meta">${yearRange}</div>` : ""}
        ${m.recall_count > 0 ? `<div class="rr-card__alert">${m.recall_count} recall${m.recall_count !== 1 ? "s" : ""}</div>` : ""}
      </a>
    `;
  }).join("");

  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">${escapeHtml(makeName)} Recalls &amp; Safety Issues</h1>
      <p class="rr-section-header__subtitle">Browse recalls by model to find safety issues for your ${escapeHtml(makeName)} vehicle.</p>
    </section>
    <section>
      <div class="rr-grid rr-grid--models">
        ${cards || "<p class='rr-body'>No models found.</p>"}
      </div>
    </section>
  `;
}

import { escapeHtml, makeLogoImg } from "../lib/utils";

interface ModelRow {
  name: string;
  slug: string;
  min_year: number | null;
  max_year: number | null;
  recall_count: number;
}

export function makePageTemplate(makeName: string, makeSlug: string, models: ModelRow[]): string {
  const recallModels = models.filter((m) => m.recall_count > 0);
  const zeroRecallModels = models.filter((m) => m.recall_count === 0);

  const cards = recallModels.map((m) => {
    const yearRange = m.min_year && m.max_year ? `${m.min_year}–${m.max_year}` : "";
    return `
      <a href="/${makeSlug}/${m.slug}" class="rr-card rr-card--model" aria-label="${escapeHtml(m.name)}${yearRange ? ', ' + yearRange : ''}${m.recall_count > 0 ? ', ' + m.recall_count + ' recall' + (m.recall_count !== 1 ? 's' : '') : ''}">
        <div class="rr-card__content">
          <div class="rr-card__title">${escapeHtml(m.name)}</div>
          ${yearRange ? `<div class="rr-card__meta">${yearRange}</div>` : ""}
        </div>
        ${m.recall_count > 0 ? `
          <div class="rr-card__badge-stack" aria-hidden="true">
            <span class="rr-badge">${m.recall_count} RECALLS</span>
          </div>
        ` : ""}
      </a>
    `;
  }).join("");

  const zeroRecallCards = zeroRecallModels.length > 0
    ? `
    <section style="margin-top: var(--space-16);">
      <details class="rr-details">
        <summary class="rr-details__summary">${zeroRecallModels.length} model${zeroRecallModels.length !== 1 ? "s" : ""} with no open recalls</summary>
        <div class="rr-grid rr-grid--models" style="margin-top: var(--space-4);">
          ${zeroRecallModels.map((m) => {
            const yearRange = m.min_year && m.max_year ? `${m.min_year}–${m.max_year}` : "";
            return `
              <div class="rr-card rr-card--model rr-card--muted" aria-label="${escapeHtml(m.name)}${yearRange ? ', ' + yearRange : ''}: no recalls">
                <div class="rr-card__content">
                  <div class="rr-card__title">${escapeHtml(m.name)}</div>
                  ${yearRange ? `<div class="rr-card__meta">${yearRange}</div>` : ""}
                </div>
                <span class="rr-badge rr-badge--ok">No recalls</span>
              </div>
            `;
          }).join("")}
        </div>
      </details>
    </section>
    `
    : "";

  return `
    <section class="rr-section-header">
      ${makeLogoImg(makeSlug, makeName, "rr-make-logo rr-make-logo--hero")}
      <h1 class="rr-section-header__title">${escapeHtml(makeName)} Recalls &amp; Safety Issues</h1>
      <p class="rr-section-header__subtitle">Browse recalls by model to find safety issues for your ${escapeHtml(makeName)} vehicle.</p>
    </section>
    <section>
      <h2 class="rr-label" style="margin-bottom: var(--space-4);">${escapeHtml(makeName)} Models With Recalls</h2>
      <div class="rr-grid rr-grid--models">
        ${cards || "<p class='rr-body'>No models found.</p>"}
      </div>
    </section>
    ${zeroRecallCards}
  `;
}

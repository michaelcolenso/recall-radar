import { escapeHtml } from "../lib/utils";

interface MakeSummary {
  slug: string;
  name: string;
  model_count: number;
  recall_count: number;
}

interface Stats {
  recalls: number;
  vehicles: number;
  makes: number;
}

export function homeTemplate(makes: MakeSummary[], stats: Stats, popularMakes: MakeSummary[] = []): string {
  const popularGrid = popularMakes.length > 0
    ? `
    <section style="margin-bottom: var(--space-24);">
      <div class="rr-section-header">
        <h2 class="rr-section-header__title">Popular Makes</h2>
      </div>
      <div class="rr-grid rr-grid--makes">
        ${popularMakes.map((m) => `
    <a href="/${m.slug}" class="rr-card" aria-label="${escapeHtml(m.name)}: ${m.recall_count.toLocaleString()} recall${m.recall_count !== 1 ? 's' : ''}, ${m.model_count.toLocaleString()} model${m.model_count !== 1 ? 's' : ''}">
      <div class="rr-card__title">${escapeHtml(m.name)}</div>
      <div class="rr-card__meta">
        ${m.recall_count.toLocaleString()} RECALLS
        · ${m.model_count.toLocaleString()} MODELS
      </div>
    </a>
  `).join("")}
      </div>
    </section>
    `
    : "";

  const makeGrid = makes.map((m) => `
    <a href="/${m.slug}" class="rr-card" aria-label="${escapeHtml(m.name)}: ${m.recall_count.toLocaleString()} recall${m.recall_count !== 1 ? 's' : ''}, ${m.model_count.toLocaleString()} model${m.model_count !== 1 ? 's' : ''}">
      <div class="rr-card__title">${escapeHtml(m.name)}</div>
      <div class="rr-card__meta">
        ${m.recall_count.toLocaleString()} RECALLS
        · ${m.model_count.toLocaleString()} MODELS
      </div>
    </a>
  `).join("");

  return `
    <section class="rr-hero">
      <span class="rr-hero__marker" aria-hidden="true">SYSTEM:RECALL_DATABASE_V1.0</span>
      <h1 class="rr-hero__title">Find Safety Recalls fast</h1>
      <p class="rr-hero__subtitle">High-precision vehicle safety data. Sourced directly from NHTSA records, simplified for actionable clarity.</p>
    </section>

    <section class="rr-stats">
      <div class="rr-stats__item">
        <div class="rr-stats__label">TOTAL RECALLS</div>
        <div class="rr-stats__value">${stats.recalls.toLocaleString()}</div>
      </div>
      <div class="rr-stats__item">
        <div class="rr-stats__label">VEHICLES COVERED</div>
        <div class="rr-stats__value">${stats.vehicles.toLocaleString()}</div>
      </div>
      <div class="rr-stats__item">
        <div class="rr-stats__label">MAKES TRACKED</div>
        <div class="rr-stats__value">${stats.makes.toLocaleString()}</div>
      </div>
    </section>

    ${popularGrid}

    <section id="makes">
      <div class="rr-section-header">
        <h2 class="rr-section-header__title">Browse All Makes</h2>
      </div>
      <div class="rr-grid rr-grid--makes">
        ${makeGrid}
      </div>
    </section>
  `;
}

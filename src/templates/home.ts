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
    <section style="margin-bottom: var(--space-12);">
      <div class="rr-section-header">
        <h2 class="rr-section-header__title">Popular Makes</h2>
      </div>
      <div class="rr-grid rr-grid--makes">
        ${popularMakes.map((m) => `
    <a href="/${m.slug}" class="rr-card" aria-label="${escapeHtml(m.name)}: ${m.recall_count.toLocaleString()} recall${m.recall_count !== 1 ? 's' : ''}, ${m.model_count.toLocaleString()} model${m.model_count !== 1 ? 's' : ''}">
      <div class="rr-card__title">${escapeHtml(m.name)}</div>
      <div class="rr-card__meta">
        ${m.recall_count.toLocaleString()} recall${m.recall_count !== 1 ? "s" : ""}
        · ${m.model_count.toLocaleString()} model${m.model_count !== 1 ? "s" : ""}
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
        ${m.recall_count.toLocaleString()} recall${m.recall_count !== 1 ? "s" : ""}
        · ${m.model_count.toLocaleString()} model${m.model_count !== 1 ? "s" : ""}
      </div>
    </a>
  `).join("");

  return `
    <section class="rr-hero">
      <div class="rr-hero__brand" aria-hidden="true">
        <span class="rr-brand-mark"></span>
        <span class="rr-brand-lockup">
          <span class="rr-brand-lockup__name">Recalled Rides</span>
          <span class="rr-brand-lockup__tagline">Every Recall. Every VIN.</span>
        </span>
      </div>
      <h1 class="rr-hero__title">Find Safety Recalls by Make, Model, and Year</h1>
      <p class="rr-hero__subtitle">Understand recall risk fast with a cleaner, clearer experience built around your vehicle.</p>
    </section>

    <section class="rr-stats">
      <div class="rr-stats__item">
        <div class="rr-stats__value">${stats.recalls.toLocaleString()}</div>
        <div class="rr-stats__label">Total Recalls</div>
      </div>
      <div class="rr-stats__item">
        <div class="rr-stats__value">${stats.vehicles.toLocaleString()}</div>
        <div class="rr-stats__label">Vehicles Covered</div>
      </div>
      <div class="rr-stats__item">
        <div class="rr-stats__value">${stats.makes.toLocaleString()}</div>
        <div class="rr-stats__label">Makes Tracked</div>
      </div>
    </section>

    ${popularGrid}

    <section id="makes">
      <div class="rr-section-header">
        <h2 class="rr-section-header__title">Browse Recalls by Make</h2>
      </div>
      <div class="rr-grid rr-grid--makes">
        ${makeGrid}
      </div>
    </section>
  `;
}

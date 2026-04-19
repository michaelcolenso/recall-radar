import { escapeHtml } from "../lib/utils";

interface Stats {
  recalls: number;
  vehicles: number;
  makes: number;
}

export function homeTemplate(makes: Array<{ slug: string; name: string }>, stats: Stats): string {
  const makeGrid = makes.map((m) => `
    <a href="/${m.slug}" class="rr-card">
      <div class="rr-card__title">${escapeHtml(m.name)}</div>
    </a>
  `).join("");

  return `
    <section class="rr-hero">
      <h1 class="rr-hero__title">Is Your Car Safe?</h1>
      <p class="rr-hero__subtitle">Search vehicle recalls in plain English. Find out if your car has open safety issues — and how to get them fixed for free.</p>
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

    <section>
      <div class="rr-section-header">
        <h2 class="rr-section-header__title">Browse Recalls by Make</h2>
      </div>
      <div class="rr-grid rr-grid--makes">
        ${makeGrid}
      </div>
    </section>
  `;
}

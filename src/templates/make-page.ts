import { escapeHtml } from "../lib/utils";

interface ModelRow {
  name: string;
  slug: string;
  min_year: number | null;
  max_year: number | null;
  recall_count: number;
}

export function makePageTemplate(
  makeName: string,
  makeSlug: string,
  models: ModelRow[]
): string {
  const cards = models
    .map((m) => {
      const yearRange =
        m.min_year && m.max_year ? `${m.min_year}–${m.max_year}` : "";
      return `
      <a href="/${makeSlug}/${m.slug}" class="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition">
        <div class="font-semibold text-slate-800">${escapeHtml(m.name)}</div>
        ${yearRange ? `<div class="text-sm text-slate-500 mt-1">${yearRange}</div>` : ""}
        ${m.recall_count > 0 ? `<div class="text-sm text-red-600 mt-1 font-medium">${m.recall_count} recall${m.recall_count !== 1 ? "s" : ""}</div>` : ""}
      </a>
    `;
    })
    .join("");

  return `
    <section class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">${escapeHtml(makeName)} Vehicle Recalls &amp; Safety Issues</h1>
      <p class="text-slate-600">Browse recalls by model to find safety issues for your ${escapeHtml(makeName)} vehicle.</p>
    </section>
    <section>
      <h2 class="text-xl font-semibold text-slate-700 mb-4">${escapeHtml(makeName)} Models (${models.length})</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        ${cards || "<p class='text-slate-500'>No models found.</p>"}
      </div>
    </section>
  `;
}

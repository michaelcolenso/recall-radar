import { escapeHtml } from "../lib/utils";

interface Stats {
  recalls: number;
  vehicles: number;
  makes: number;
}

export function homeTemplate(makes: Array<{ slug: string; name: string }>, stats: Stats): string {
  const makeGrid = makes.map((m) => `
    <a href="/${m.slug}" class="block bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition text-center">
      ${escapeHtml(m.name)}
    </a>
  `).join("");

  return `
    <section class="text-center py-12">
      <h1 class="text-4xl font-bold text-slate-900 mb-4">Is Your Car Safe?</h1>
      <p class="text-xl text-slate-600 max-w-2xl mx-auto">Search vehicle recalls in plain English. Find out if your car has open safety issues — and how to get them fixed for free.</p>
    </section>

    <section class="grid grid-cols-3 gap-4 mb-12">
      <div class="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <div class="text-3xl font-bold text-blue-700">${stats.recalls.toLocaleString()}</div>
        <div class="text-sm text-slate-500 mt-1">Total Recalls</div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <div class="text-3xl font-bold text-blue-700">${stats.vehicles.toLocaleString()}</div>
        <div class="text-sm text-slate-500 mt-1">Vehicles Covered</div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <div class="text-3xl font-bold text-blue-700">${stats.makes.toLocaleString()}</div>
        <div class="text-sm text-slate-500 mt-1">Makes Tracked</div>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-bold text-slate-800 mb-6">Browse Recalls by Make</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        ${makeGrid}
      </div>
    </section>
  `;
}

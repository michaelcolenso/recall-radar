export function dealerLeadGen(): string {
  return `
  <section class="mt-10 bg-blue-50 border border-blue-200 rounded-2xl p-6">
    <h3 class="text-xl font-bold text-blue-900 mb-2">Get Your Recall Fixed — Free</h3>
    <p class="text-blue-800 mb-4">All recalls listed above are repaired at no cost to you at any authorized dealership. Enter your zip code to find a service center near you.</p>
    <div class="flex gap-3 max-w-sm">
      <input type="text" placeholder="Enter zip code" maxlength="10"
        class="flex-1 border border-blue-300 rounded-lg px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        disabled/>
      <button class="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold opacity-60 cursor-not-allowed" disabled>
        Find Dealers
      </button>
    </div>
    <p class="text-xs text-blue-600 mt-2">Dealer finder coming soon.</p>
  </section>
  `;
}

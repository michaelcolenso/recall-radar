import { escapeHtml } from "../../lib/utils";

export function breadcrumbs(items: Array<{ href: string; label: string }>): string {
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast) {
      return `<span class="text-slate-900 font-medium">${escapeHtml(item.label)}</span>`;
    }
    return `<a href="${item.href}" class="text-blue-600 hover:text-blue-800 hover:underline">${escapeHtml(item.label)}</a>`;
  });

  return `
    <nav aria-label="Breadcrumb" class="flex items-center gap-2 text-sm text-slate-500 mb-6 flex-wrap">
      ${parts.join(' <span class="text-slate-300">/</span> ')}
    </nav>
  `;
}

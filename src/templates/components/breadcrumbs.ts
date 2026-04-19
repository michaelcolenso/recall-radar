interface Crumb {
  href?: string;
  label: string;
}

export function breadcrumbs(items: Crumb[]): string {
  const links = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const content = isLast
      ? `<span class="rr-breadcrumb__current">${item.label}</span>`
      : `<a href="${item.href}">${item.label}</a>`;
    const sep = isLast ? "" : `<span class="rr-breadcrumb__sep">/</span>`;
    return `${content}${sep}`;
  }).join("");

  return `<nav class="rr-breadcrumb" aria-label="Breadcrumb">${links}</nav>`;
}

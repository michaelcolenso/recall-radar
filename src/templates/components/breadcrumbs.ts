export const breadcrumbs = (items: Array<{ href: string; label: string }>): string =>
  `<nav>${items.map((i) => `<a href="${i.href}">${i.label}</a>`).join(" / ")}</nav>`;

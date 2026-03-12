export const makePageTemplate = (makeName: string, makeSlug: string, models: Array<{ slug: string; name: string }>): string =>
  `<section class=\"card\"><h2>${makeName} Models</h2><ul>${models.map((m) => `<li><a href=\"/make/${makeSlug}/${m.slug}\">${m.name}</a></li>`).join("")}</ul></section>`;

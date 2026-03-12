export const makePageTemplate = (make: string, models: Array<{ slug: string; name: string }>): string =>
  `<section class=\"card\"><h2>${make} Models</h2><ul>${models.map((m) => `<li><a href=\"/make/${make.toLowerCase()}/${m.slug}\">${m.name}</a></li>`).join("")}</ul></section>`;

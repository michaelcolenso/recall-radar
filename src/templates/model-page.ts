export const modelPageTemplate = (makeSlug: string, model: string, years: number[]): string =>
  `<section class=\"card\"><h2>${model} Years</h2><ul>${years.map((y) => `<li><a href=\"/make/${makeSlug}/${model.toLowerCase()}/${y}\">${y}</a></li>`).join("")}</ul></section>`;

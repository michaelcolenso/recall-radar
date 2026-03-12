export const yearPageTemplate = (title: string, cards: string, leadGen: string): string =>
  `<section class=\"card\"><h2>${title}</h2><p>Open recalls for this vehicle year:</p></section>${cards}${leadGen}`;

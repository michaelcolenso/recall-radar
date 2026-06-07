export const POPULAR_MAKES = [
  "ACURA",
  "AUDI",
  "BMW",
  "BUICK",
  "CADILLAC",
  "CHEVROLET",
  "CHRYSLER",
  "DODGE",
  "FORD",
  "GMC",
  "HONDA",
  "HYUNDAI",
  "INFINITI",
  "JEEP",
  "KIA",
  "LAND ROVER",
  "LEXUS",
  "LINCOLN",
  "MAZDA",
  "MERCEDES-BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "PORSCHE",
  "RAM",
  "SUBARU",
  "TESLA",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
] as const;

export const DEFAULT_YEAR_START = 2000;
// Do NOT use new Date() here — module-level evaluation in Workers returns epoch (1970).
// Compute year end dynamically inside run() methods instead.
export const YEAR_MAX = 2030;

// Cache-busting token for static assets (styles.css). Bump when public/styles.css
// changes so browsers/edge fetch the new file instead of the 7-day cached copy.
// Also bump PAGE_CACHE_VERSION so cached HTML regenerates with the new URL.
export const ASSET_VERSION = "10";

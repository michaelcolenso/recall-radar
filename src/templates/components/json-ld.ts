export const pageJsonLd = (payload: Record<string, unknown>): string =>
  `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;

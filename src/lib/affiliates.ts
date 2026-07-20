// Affiliate partner registry — the single place partner links live.
//
// Enabled partners are selected at runtime by the AFFILIATE_PARTNERS env var
// (comma-separated partner ids, e.g. "dvh,epicvin"), so programs can be
// activated or swapped without a deploy. Pages are edge-cached for up to 12h,
// so env-var changes take effect as cached HTML expires.
//
// All outbound affiliate links route through the first-party /go/:partner
// redirect (src/routes/go.ts) so clicks are logged and URLs stay swappable.

export type AffiliatePlacement = "vin" | "year" | "lookup" | "email";

export interface AffiliatePartner {
  id: string;
  name: string;
  /** Builds the outbound URL. `vin` is a full 17-char VIN when available. */
  urlTemplate: (vin?: string) => string;
  /** Payout terms as verified during signup — documentation only. */
  commissionNote: string;
}

// URL templates below point at each partner's public entry point. Once a
// program application is approved, replace the template with the tracked
// affiliate deeplink (they all support plain-URL deeplinks or homepage links).
export const AFFILIATE_PARTNERS: AffiliatePartner[] = [
  {
    id: "dvh",
    name: "Detailed Vehicle History",
    urlTemplate: (vin) =>
      vin
        ? `https://detailedvehiclehistory.com/vin-check/results?vin=${encodeURIComponent(vin)}`
        : "https://detailedvehiclehistory.com/",
    commissionNote: "25% per sale (up to $20), 90-day cookie — self-serve program",
  },
  {
    id: "epicvin",
    name: "EpicVIN",
    urlTemplate: (vin) =>
      vin ? `https://epicvin.com/?vin=${encodeURIComponent(vin)}` : "https://epicvin.com/",
    commissionNote: "Up to $30/sale (~30%), 30-day cookie — in-house program",
  },
  {
    id: "vininfohub",
    name: "VinInfoHub",
    urlTemplate: (vin) =>
      vin ? `https://vininfohub.com/?vin=${encodeURIComponent(vin)}` : "https://vininfohub.com/",
    commissionNote: "10–20% rev share, 90–180-day earning window",
  },
  {
    id: "vinaudit",
    name: "VinAudit",
    urlTemplate: (vin) =>
      vin ? `https://www.vinaudit.com/?vin=${encodeURIComponent(vin)}` : "https://www.vinaudit.com/",
    commissionNote: "NMVTIS official data — application reviewed by their team",
  },
];

export function getPartner(id: string): AffiliatePartner | undefined {
  return AFFILIATE_PARTNERS.find((p) => p.id === id);
}

/** Parses the AFFILIATE_PARTNERS env var into an ordered list of enabled partners. */
export function getEnabledPartners(envValue: string | undefined): AffiliatePartner[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((id) => getPartner(id))
    .filter((p): p is AffiliatePartner => p !== undefined);
}

/** The partner shown in CTAs — first enabled entry wins. */
export function primaryPartner(envValue: string | undefined): AffiliatePartner | undefined {
  return getEnabledPartners(envValue)[0];
}

export function isPartnerEnabled(envValue: string | undefined, id: string): boolean {
  return getEnabledPartners(envValue).some((p) => p.id === id);
}

/** First-party redirect path for a partner click. */
export function goPath(partnerId: string, placement: AffiliatePlacement, vin?: string): string {
  const params = new URLSearchParams({ placement });
  if (vin) params.set("vin", vin);
  return `/go/${partnerId}?${params.toString()}`;
}

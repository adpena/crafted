export interface GeoContext {
  country: string;
  region: string;
  city?: string;
}

export interface GeoPersonalization {
  jurisdiction: string;
  locale_hint: string;
  context_line: string | null;
}

export function personalize(geo: GeoContext): GeoPersonalization {
  const jurisdiction = geo.region || "FED";
  const locale_hint = geo.country === "US" && geo.region ? "en-US" : "en";
  const context_line = geo.city && geo.region
    ? `Showing information for ${geo.city}, ${geo.region}`
    : null;

  return { jurisdiction, locale_hint, context_line };
}

export const DEFAULT_AMOUNTS = [10, 25, 50, 100, 250];

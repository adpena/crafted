export interface GeoContext {
  country: string;
  region: string;
  city?: string;
}

export function resolveJurisdiction(geo: GeoContext): string {
  return geo.region || "FED";
}

export const DEFAULT_AMOUNTS = [10, 25, 50, 100, 250];

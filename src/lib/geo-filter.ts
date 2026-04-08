/**
 * Geo whitelist/blacklist filtering using Cloudflare cf-ipcountry header.
 *
 * Modes:
 * - **whitelist**: only allow specified countries (e.g., ["US", "PR", "GU"])
 * - **blacklist**: block specified countries
 * - **off**: no filtering (default)
 *
 * Configuration stored per-page in action_props.geo_filter.
 */

export interface GeoFilterConfig {
  /** Filter mode */
  mode: "whitelist" | "blacklist" | "off";
  /** ISO 3166-1 alpha-2 country codes */
  countries: string[];
}

export interface GeoFilterResult {
  allowed: boolean;
  country: string | null;
  reason?: string;
}

/**
 * Check if a request is allowed based on geo filter config.
 * Country code comes from Cloudflare's cf-ipcountry header.
 */
export function checkGeoFilter(
  country: string | null,
  config?: GeoFilterConfig,
): GeoFilterResult {
  if (!config || config.mode === "off") {
    return { allowed: true, country };
  }

  // Unknown country — block in whitelist mode (FEC compliance), allow in blacklist mode
  if (!country || country === "XX" || country === "T1") {
    if (config.mode === "whitelist") {
      return { allowed: false, country, reason: "unknown_country_whitelist" };
    }
    return { allowed: true, country, reason: "unknown_country" };
  }

  const normalized = country.toUpperCase();
  const countries = new Set(config.countries.map(c => c.toUpperCase()));

  if (config.mode === "whitelist") {
    const allowed = countries.has(normalized);
    return {
      allowed,
      country: normalized,
      reason: allowed ? undefined : `country_not_in_whitelist`,
    };
  }

  if (config.mode === "blacklist") {
    const blocked = countries.has(normalized);
    return {
      allowed: !blocked,
      country: normalized,
      reason: blocked ? `country_blacklisted` : undefined,
    };
  }

  return { allowed: true, country };
}

/**
 * Common presets for US campaigns.
 */
export const GEO_PRESETS = {
  /** US states + territories */
  us_only: {
    mode: "whitelist" as const,
    countries: ["US", "PR", "GU", "VI", "AS", "MP"],
  },
  /** Block common bot origins */
  block_bots: {
    mode: "blacklist" as const,
    countries: ["XX", "T1"],
  },
} as const;

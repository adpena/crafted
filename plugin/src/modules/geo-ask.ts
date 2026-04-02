export type GeoContext = { country: string; region: string };
export type RegionConfig = { multiplier: number };
export type AmountConfig = {
  base: number[];
  regions: Record<string, RegionConfig>;
  fallback_multiplier: number;
};

export function suggestAmounts(config: AmountConfig, geo: GeoContext): number[] {
  const key = `${geo.country}-${geo.region}`;
  const multiplier = config.regions[key]?.multiplier ?? config.fallback_multiplier;
  return config.base.map((amount) => Math.round(amount * multiplier));
}

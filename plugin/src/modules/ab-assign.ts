/** djb2 string hash, returns non-negative integer */
export function hashVisitor(visitorId: string): number {
  let hash = 5381;
  for (let i = 0; i < visitorId.length; i++) {
    hash = ((hash << 5) - hash + visitorId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministic variant assignment via hash modulo. Returns "control" for empty arrays. */
export function assignVariant(visitorId: string, variants: string[]): string {
  if (!variants || variants.length === 0) return "control";
  return variants[hashVisitor(visitorId) % variants.length]!;
}

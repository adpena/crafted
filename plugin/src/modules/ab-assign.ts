/** djb2 string hash, returns non-negative integer */
export function hashVisitor(visitorId: string): number {
  let hash = 5381;
  for (let i = 0; i < visitorId.length; i++) {
    hash = ((hash << 5) - hash + visitorId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministic variant assignment via hash modulo */
export function assignVariant(visitorId: string, variants: string[]): string {
  return variants[hashVisitor(visitorId) % variants.length]!;
}

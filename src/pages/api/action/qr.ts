/**
 * QR code generation endpoint for action pages.
 *
 * GET /api/action/qr?slug=fund-public-schools&size=300
 *
 * Proxies through goqr.me API (free, no API key, stable 10+ years).
 * Returns a PNG image with aggressive caching.
 *
 * NOTE: Google Charts QR API was deprecated and returns 404 as of 2025.
 * Replaced with goqr.me (api.qrserver.com) which serves the same purpose.
 */

import type { APIRoute } from "astro";
import { SLUG_RE } from "../../../lib/slug.ts";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug");
  if (!slug || !SLUG_RE.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }

  const rawSize = parseInt(url.searchParams.get("size") ?? "300", 10);
  const size = Math.min(Math.max(Number.isNaN(rawSize) ? 300 : rawSize, 100), 1000);

  const pageUrl = `https://adpena.com/action/${slug}`;

  // goqr.me API — free, no API key, stable since ~2012
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(pageUrl)}&format=png&margin=8`;

  try {
    const res = await fetch(qrUrl, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) {
      return new Response("QR generation failed", { status: 502 });
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("QR generation timed out", { status: 504 });
  }
};

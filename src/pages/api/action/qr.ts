/**
 * QR code generation endpoint for action pages.
 *
 * GET /api/action/qr?slug=fund-public-schools&size=300
 *
 * Proxies through Google Charts QR API for v1.
 * Returns a PNG image with aggressive caching.
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

  // Proxy through Google Charts QR API (reliable, free, no API key)
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(pageUrl)}&choe=UTF-8`;

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

/**
 * Self-contained QR code generation endpoint for action pages.
 *
 * GET /api/action/qr?slug=fund-public-schools
 * GET /api/action/qr?slug=fund-public-schools&size=300&style=rounded&fg=1a1a1a&bg=ffffff
 * GET /api/action/qr?slug=fund-public-schools&logo=https://adpena.com/favicon.svg
 *
 * Returns an SVG image. No external service dependencies.
 */

import type { APIRoute } from "astro";
import { SLUG_RE } from "../../../lib/slug.ts";
import { generateQR } from "../../../lib/qr.ts";
import { renderQRSvg } from "../../../lib/qr-svg.ts";
import type { QRStyleOptions } from "../../../lib/qr-svg.ts";

const HEX_RE = /^[0-9a-fA-F]{6}$/;
const VALID_STYLES = new Set(["square", "rounded", "dot"] as const);

export const GET: APIRoute = async ({ url }) => {
  // ── Validate slug ────────────────────────────────────────────────
  const slug = url.searchParams.get("slug");
  if (!slug || !SLUG_RE.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }

  // ── Validate size (100–1000, default 300) ────────────────────────
  const rawSize = parseInt(url.searchParams.get("size") ?? "300", 10);
  const size = Math.min(Math.max(Number.isNaN(rawSize) ? 300 : rawSize, 100), 1000);

  // ── Validate style ───────────────────────────────────────────────
  const rawStyle = url.searchParams.get("style") ?? "square";
  if (!VALID_STYLES.has(rawStyle as "square" | "rounded" | "dot")) {
    return new Response("Invalid style — must be square, rounded, or dot", { status: 400 });
  }
  const style = rawStyle as "square" | "rounded" | "dot";

  // ── Validate colors ──────────────────────────────────────────────
  const rawFg = url.searchParams.get("fg") ?? "000000";
  const rawBg = url.searchParams.get("bg") ?? "ffffff";
  if (!HEX_RE.test(rawFg) || !HEX_RE.test(rawBg)) {
    return new Response("Invalid color — must be 6-digit hex without #", { status: 400 });
  }

  // ── Validate logo URL ────────────────────────────────────────────
  const logo = url.searchParams.get("logo") ?? undefined;
  if (logo && !logo.startsWith("https://")) {
    return new Response("Logo URL must use HTTPS", { status: 400 });
  }

  // ── Generate QR code ─────────────────────────────────────────────
  const pageUrl = `https://adpena.com/action/${slug}`;

  try {
    const matrix = generateQR(pageUrl);

    // Calculate module size to fit desired pixel size
    const quietZone = 4;
    const totalModules = matrix.length + quietZone * 2;
    const moduleSize = size / totalModules;

    const opts: QRStyleOptions = {
      moduleSize,
      quietZone,
      foreground: `#${rawFg}`,
      background: `#${rawBg}`,
      moduleShape: style,
      logoUrl: logo,
      logoScale: 0.2,
    };

    const svg = renderQRSvg(matrix, opts);

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "QR generation failed";
    return new Response(msg, { status: 500 });
  }
};

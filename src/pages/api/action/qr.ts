/**
 * Self-contained QR code generation endpoint for action pages.
 *
 * GET /api/action/qr?slug=fund-public-schools
 * GET /api/action/qr?slug=fund-public-schools&size=300&style=rounded&fg=1a1a1a&bg=ffffff
 * GET /api/action/qr?slug=fund-public-schools&logo=https://adpena.com/favicon.svg
 * GET /api/action/qr?slug=fund-public-schools&ec=H&eyeShape=circle&gradient=linear&gradientColors=0693e3,1a1a1a
 *
 * Returns an SVG image. No external service dependencies.
 */

import type { APIRoute } from "astro";
import { SLUG_RE } from "../../../lib/slug.ts";
import { generateQR } from "../../../lib/qr.ts";
import type { ECLevel } from "../../../lib/qr.ts";
import { renderQRSvg } from "../../../lib/qr-svg.ts";
import type {
  QRStyleOptions,
  ModuleShape,
  EyeOuterShape,
  EyeInnerShape,
  QRGradient,
  LogoBackgroundShape,
  OuterShape,
} from "../../../lib/qr-svg.ts";

const HEX_RE = /^[0-9a-fA-F]{6}$/;

const VALID_STYLES = new Set<ModuleShape>([
  "square", "rounded", "dot", "classy", "classy-rounded", "extra-rounded", "diamond", "star",
]);
const VALID_EC = new Set<ECLevel>(["L", "M", "Q", "H"]);
const VALID_EYE_SHAPES = new Set<EyeOuterShape>(["square", "rounded", "circle", "classy"]);
const VALID_EYE_INNER_SHAPES = new Set<EyeInnerShape>(["square", "rounded", "circle"]);
const VALID_LOGO_BG_SHAPES = new Set<LogoBackgroundShape>(["square", "rounded", "circle"]);
const VALID_OUTER_SHAPES = new Set<OuterShape>(["square", "circle"]);
const VALID_GRADIENT_TYPES = new Set(["linear", "radial"]);

/** Parse hex color param — returns with # prefix, or null if invalid. */
function parseHexColor(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const clean = raw.replace(/^#/, "");
  return HEX_RE.test(clean) ? `#${clean}` : fallback;
}

export const GET: APIRoute = async ({ url }) => {
  // ── Validate slug ────────────────────────────────────────────────
  const slug = url.searchParams.get("slug");
  if (!slug || !SLUG_RE.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }

  // ── Validate size (100-1000, default 300) ────────────────────────
  const rawSize = parseInt(url.searchParams.get("size") ?? "300", 10);
  const size = Math.min(Math.max(Number.isNaN(rawSize) ? 300 : rawSize, 100), 1000);

  // ── EC level ─────────────────────────────────────────────────────
  const rawEc = (url.searchParams.get("ec") ?? "M").toUpperCase() as ECLevel;
  const ecLevel: ECLevel = VALID_EC.has(rawEc) ? rawEc : "M";

  // ── Module style ─────────────────────────────────────────────────
  const rawStyle = url.searchParams.get("style") ?? "square";
  const style: ModuleShape = VALID_STYLES.has(rawStyle as ModuleShape)
    ? (rawStyle as ModuleShape)
    : "square";

  // ── Colors ───────────────────────────────────────────────────────
  const fgColor = parseHexColor(url.searchParams.get("fg"), "#000000");
  const rawBg = url.searchParams.get("bg");
  const bgColor = rawBg === "transparent" ? "transparent" : parseHexColor(rawBg, "#ffffff");

  // ── Eye styling ──────────────────────────────────────────────────
  const rawEyeShape = url.searchParams.get("eyeShape");
  const eyeShape: EyeOuterShape | undefined = rawEyeShape && VALID_EYE_SHAPES.has(rawEyeShape as EyeOuterShape)
    ? (rawEyeShape as EyeOuterShape)
    : undefined;

  const eyeColor = parseHexColor(url.searchParams.get("eyeColor"), fgColor);

  const rawEyeInnerShape = url.searchParams.get("eyeInnerShape");
  const eyeInnerShape: EyeInnerShape | undefined = rawEyeInnerShape && VALID_EYE_INNER_SHAPES.has(rawEyeInnerShape as EyeInnerShape)
    ? (rawEyeInnerShape as EyeInnerShape)
    : undefined;

  const eyeInnerColor = parseHexColor(url.searchParams.get("eyeInnerColor"), eyeColor);

  // ── Gradient ─────────────────────────────────────────────────────
  let gradient: QRGradient | undefined;
  const rawGradientType = url.searchParams.get("gradient");
  const rawGradientColors = url.searchParams.get("gradientColors");

  if (rawGradientType && VALID_GRADIENT_TYPES.has(rawGradientType) && rawGradientColors) {
    const colors = rawGradientColors.split(",").map((c) => c.trim()).filter((c) => HEX_RE.test(c));
    if (colors.length >= 2) {
      const rawAngle = parseInt(url.searchParams.get("gradientAngle") ?? "0", 10);
      const angle = Number.isNaN(rawAngle) ? 0 : rawAngle;
      gradient = {
        type: rawGradientType as "linear" | "radial",
        rotation: angle,
        colorStops: colors.map((c, i) => ({
          offset: i / (colors.length - 1),
          color: `#${c}`,
        })),
      };
    }
  }

  // ── Logo ─────────────────────────────────────────────────────────
  const logo = url.searchParams.get("logo") ?? undefined;
  if (logo && !logo.startsWith("https://")) {
    return new Response("Logo URL must use HTTPS", { status: 400 });
  }

  const rawLogoMargin = parseInt(url.searchParams.get("logoMargin") ?? "1", 10);
  const logoMargin = Number.isNaN(rawLogoMargin) ? 1 : Math.min(Math.max(rawLogoMargin, 0), 5);

  const rawLogoBg = url.searchParams.get("logoBg");
  const logoBgShape: LogoBackgroundShape | undefined = rawLogoBg && VALID_LOGO_BG_SHAPES.has(rawLogoBg as LogoBackgroundShape)
    ? (rawLogoBg as LogoBackgroundShape)
    : undefined;

  // ── Overall shape ────────────────────────────────────────────────
  const rawOuterShape = url.searchParams.get("shape");
  const outerShape: OuterShape = rawOuterShape && VALID_OUTER_SHAPES.has(rawOuterShape as OuterShape)
    ? (rawOuterShape as OuterShape)
    : "square";

  // ── Generate QR code ─────────────────────────────────────────────
  const pageUrl = `https://adpena.com/action/${slug}`;

  try {
    const matrix = generateQR(pageUrl, ecLevel);

    // Calculate module size to fit desired pixel size
    const quietZone = 4;
    const totalModules = matrix.length + quietZone * 2;
    const moduleSize = size / totalModules;

    const opts: QRStyleOptions = {
      moduleSize,
      quietZone,
      foreground: fgColor,
      background: bgColor,
      moduleShape: style,
      gradient,
      eyeShape,
      eyeColor,
      eyeInnerShape,
      eyeInnerColor,
      logoUrl: logo,
      logoScale: 0.2,
      logoMargin,
      logoBackgroundShape: logoBgShape,
      outerShape,
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

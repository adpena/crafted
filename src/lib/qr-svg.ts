/**
 * SVG renderer for QR code matrices — zero DOM dependency, runs on Workers.
 *
 * Takes the boolean[][] from generateQR() and produces a clean SVG string.
 * Supports custom module shapes, eye styling, gradients, logos, and clipping.
 *
 * @module
 */

// ── Types ──────────────────────────────────────────────────────────

/** Gradient color stop. */
export interface QRGradientStop {
  /** Offset from 0 to 1. */
  offset: number;
  /** CSS color string (hex, rgb, etc.). */
  color: string;
}

/** Gradient definition for QR code fills. */
export interface QRGradient {
  /** Gradient type. Default: "linear" */
  type?: "linear" | "radial";
  /** Rotation in degrees, for linear gradients only. Default: 0 (left to right) */
  rotation?: number;
  /** Color stops. Must have at least 2 entries. */
  colorStops: QRGradientStop[];
}

/** Shape options for finder pattern outer ring. */
export type EyeOuterShape = "square" | "rounded" | "circle" | "classy";

/** Shape options for finder pattern inner dot. */
export type EyeInnerShape = "square" | "rounded" | "circle";

/** Module shape for data modules. */
export type ModuleShape =
  | "square"
  | "rounded"
  | "dot"
  | "classy"
  | "classy-rounded"
  | "extra-rounded"
  | "diamond"
  | "star";

/** Shape of the logo background clear area. */
export type LogoBackgroundShape = "square" | "rounded" | "circle";

/** Overall QR code outer shape. */
export type OuterShape = "square" | "circle";

export interface QRStyleOptions {
  /** Module (dot) size in pixels. Default: 10 */
  moduleSize?: number;
  /** Quiet zone (border) in modules. Default: 4 */
  quietZone?: number;
  /** Foreground color. Default: "#000000" */
  foreground?: string;
  /** Background color, or "transparent". Default: "#ffffff" */
  background?: string;
  /** Module shape for data modules. Default: "square" */
  moduleShape?: ModuleShape;
  /** Foreground gradient — overrides foreground color when set. */
  gradient?: QRGradient;

  // ── Eye (finder pattern) styling ────────────────────────────────

  /** Outer ring shape for all three finder patterns. Default: inherits from moduleShape mapping */
  eyeShape?: EyeOuterShape;
  /** Outer ring color. Default: inherits from foreground */
  eyeColor?: string;
  /** Outer ring gradient — overrides eyeColor when set. */
  eyeGradient?: QRGradient;
  /** Inner dot shape. Default: inherits from eyeShape mapping */
  eyeInnerShape?: EyeInnerShape;
  /** Inner dot color. Default: inherits from eyeColor */
  eyeInnerColor?: string;
  /** Inner dot gradient — overrides eyeInnerColor when set. */
  eyeInnerGradient?: QRGradient;

  // ── Logo ────────────────────────────────────────────────────────

  /** Optional center logo URL (rendered as an embedded image). */
  logoUrl?: string;
  /** Logo size as fraction of QR size. Default: 0.2 (20%) */
  logoScale?: number;
  /** Logo margin in module units — padding between logo and surrounding modules. Default: 1 */
  logoMargin?: number;
  /** Shape of the clear area behind the logo. Default: "square" */
  logoBackgroundShape?: LogoBackgroundShape;
  /** Color of the clear area behind the logo. Default: inherits from background */
  logoBackgroundColor?: string;

  // ── Overall shape ───────────────────────────────────────────────

  /** Overall QR code shape. "circle" adds a circular clip path. Default: "square" */
  outerShape?: OuterShape;
}

// ── Shape renderers ────────────────────────────────────────────────

type ShapeRenderer = (x: number, y: number, size: number) => string;

/** Standard square module. */
function shapeSquare(x: number, y: number, s: number): string {
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
}

/** Square with small rounded corners. */
function shapeRounded(x: number, y: number, s: number): string {
  const r = s * 0.3;
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" ry="${r}"/>`;
}

/** Circular dot. */
function shapeDot(x: number, y: number, s: number): string {
  const r = s * 0.45;
  return `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${r}"/>`;
}

/** Square with one rounded corner — alternating diagonal pattern. */
function shapeClassy(x: number, y: number, s: number, row?: number, col?: number): string {
  const r = s * 0.35;
  const even = ((row ?? 0) + (col ?? 0)) % 2 === 0;
  // Top-left rounded on even, bottom-right rounded on odd
  if (even) {
    return `<path d="M${x + r},${y} H${x + s} V${y + s} H${x} V${y + r} Q${x},${y} ${x + r},${y} Z"/>`;
  } else {
    return `<path d="M${x},${y} H${x + s} V${y + s - r} Q${x + s},${y + s} ${x + s - r},${y + s} H${x} V${y} Z"/>`;
  }
}

/** All corners rounded except one which is extra-rounded. */
function shapeClassyRounded(x: number, y: number, s: number, row?: number, col?: number): string {
  const r = s * 0.25;
  const R = s * 0.5; // extra-rounded corner
  const even = ((row ?? 0) + (col ?? 0)) % 2 === 0;
  if (even) {
    // Top-left gets the big radius
    return `<path d="M${x + R},${y} H${x + s - r} Q${x + s},${y} ${x + s},${y + r} V${y + s - r} Q${x + s},${y + s} ${x + s - r},${y + s} H${x + r} Q${x},${y + s} ${x},${y + s - r} V${y + R} Q${x},${y} ${x + R},${y} Z"/>`;
  } else {
    // Bottom-right gets the big radius
    return `<path d="M${x + r},${y} H${x + s - r} Q${x + s},${y} ${x + s},${y + r} V${y + s - R} Q${x + s},${y + s} ${x + s - R},${y + s} H${x + r} Q${x},${y + s} ${x},${y + s - r} V${y + r} Q${x},${y} ${x + r},${y} Z"/>`;
  }
}

/** Pill/capsule shape — very large border radius. */
function shapeExtraRounded(x: number, y: number, s: number): string {
  const r = s * 0.5;
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" ry="${r}"/>`;
}

/** Diamond — 45-degree rotated square. */
function shapeDiamond(x: number, y: number, s: number): string {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const h = s * 0.45; // half-size, slightly smaller to avoid overlap
  return `<path d="M${cx},${cy - h} L${cx + h},${cy} L${cx},${cy + h} L${cx - h},${cy} Z"/>`;
}

/** Four-pointed star. */
function shapeStar(x: number, y: number, s: number): string {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const outer = s * 0.48;
  const inner = s * 0.18;
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

/** Get the shape renderer function for a module shape name. */
function getShapeRenderer(shape: ModuleShape): (x: number, y: number, s: number, row?: number, col?: number) => string {
  switch (shape) {
    case "square": return shapeSquare;
    case "rounded": return shapeRounded;
    case "dot": return shapeDot;
    case "classy": return shapeClassy;
    case "classy-rounded": return shapeClassyRounded;
    case "extra-rounded": return shapeExtraRounded;
    case "diamond": return shapeDiamond;
    case "star": return shapeStar;
  }
}

// ── Eye (finder pattern) rendering ─────────────────────────────────

/** Finder pattern regions: top-left, top-right, bottom-left */
interface FinderRegion {
  rowStart: number;
  colStart: number;
}

function getFinderRegions(size: number): FinderRegion[] {
  return [
    { rowStart: 0, colStart: 0 },
    { rowStart: 0, colStart: size - 7 },
    { rowStart: size - 7, colStart: 0 },
  ];
}

/** Check if a module is inside any finder pattern (7x7 area). */
function isFinderModule(row: number, col: number, size: number): boolean {
  // Top-left
  if (row >= 0 && row <= 6 && col >= 0 && col <= 6) return true;
  // Top-right
  if (row >= 0 && row <= 6 && col >= size - 7 && col <= size - 1) return true;
  // Bottom-left
  if (row >= size - 7 && row <= size - 1 && col >= 0 && col <= 6) return true;
  return false;
}

/** Render the outer ring (7x7 border) of a finder pattern. */
function renderEyeOuter(
  x: number, y: number, mod: number,
  shape: EyeOuterShape, fill: string,
): string {
  const s7 = 7 * mod;
  const s5 = 5 * mod;
  const offset1 = mod;

  switch (shape) {
    case "square":
      return (
        `<rect x="${x}" y="${y}" width="${s7}" height="${s7}" fill="${fill}"/>` +
        `<rect x="${x + offset1}" y="${y + offset1}" width="${s5}" height="${s5}" fill="EYEHOLE"/>`
      );
    case "rounded": {
      const r = mod * 1.5;
      const ri = mod * 1.0;
      return (
        `<rect x="${x}" y="${y}" width="${s7}" height="${s7}" rx="${r}" ry="${r}" fill="${fill}"/>` +
        `<rect x="${x + offset1}" y="${y + offset1}" width="${s5}" height="${s5}" rx="${ri}" ry="${ri}" fill="EYEHOLE"/>`
      );
    }
    case "circle": {
      const cx = x + s7 / 2;
      const cy = y + s7 / 2;
      const ro = s7 / 2;
      const ri = s5 / 2;
      return (
        `<circle cx="${cx}" cy="${cy}" r="${ro}" fill="${fill}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="EYEHOLE"/>`
      );
    }
    case "classy": {
      // One rounded corner (top-left) on the outer, rest square
      const r = mod * 2;
      return (
        `<path d="M${x + r},${y} H${x + s7} V${y + s7} H${x} V${y + r} Q${x},${y} ${x + r},${y} Z" fill="${fill}"/>` +
        `<path d="M${x + offset1 + r * 0.5},${y + offset1} H${x + offset1 + s5} V${y + offset1 + s5} H${x + offset1} V${y + offset1 + r * 0.5} Q${x + offset1},${y + offset1} ${x + offset1 + r * 0.5},${y + offset1} Z" fill="EYEHOLE"/>`
      );
    }
  }
}

/** Render the inner dot (3x3 center) of a finder pattern. */
function renderEyeInner(
  x: number, y: number, mod: number,
  shape: EyeInnerShape, fill: string,
): string {
  const s3 = 3 * mod;

  switch (shape) {
    case "square":
      return `<rect x="${x}" y="${y}" width="${s3}" height="${s3}" fill="${fill}"/>`;
    case "rounded": {
      const r = mod * 0.8;
      return `<rect x="${x}" y="${y}" width="${s3}" height="${s3}" rx="${r}" ry="${r}" fill="${fill}"/>`;
    }
    case "circle": {
      const cx = x + s3 / 2;
      const cy = y + s3 / 2;
      return `<circle cx="${cx}" cy="${cy}" r="${s3 / 2}" fill="${fill}"/>`;
    }
  }
}

// ── Gradient helpers ───────────────────────────────────────────────

function renderGradientDef(id: string, grad: QRGradient): string {
  const stops = grad.colorStops
    .map((s) => `<stop offset="${s.offset * 100}%" stop-color="${escapeXml(s.color)}"/>`)
    .join("");

  if (grad.type === "radial") {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`;
  }

  // Linear with rotation
  const angle = ((grad.rotation ?? 0) * Math.PI) / 180;
  const x1 = Math.round((50 - 50 * Math.cos(angle)) * 100) / 100;
  const y1 = Math.round((50 - 50 * Math.sin(angle)) * 100) / 100;
  const x2 = Math.round((50 + 50 * Math.cos(angle)) * 100) / 100;
  const y2 = Math.round((50 + 50 * Math.sin(angle)) * 100) / 100;
  return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
}

// ── Logo area clearing ─────────────────────────────────────────────

/**
 * Clear matrix modules in the logo area so they don't render.
 * Mutates the matrix in place.
 */
function clearLogoArea(
  matrix: boolean[][],
  count: number,
  logoScale: number,
  logoMargin: number,
): { rowStart: number; rowEnd: number; colStart: number; colEnd: number } {
  const logoModules = Math.ceil(count * logoScale);
  const totalClear = logoModules + logoMargin * 2;
  const start = Math.floor((count - totalClear) / 2);
  const end = start + totalClear;

  for (let r = Math.max(0, start); r < Math.min(count, end); r++) {
    for (let c = Math.max(0, start); c < Math.min(count, end); c++) {
      // Don't clear finder pattern modules — they're critical
      if (!isFinderModule(r, c, count)) {
        matrix[r][c] = false;
      }
    }
  }

  return { rowStart: start, rowEnd: end, colStart: start, colEnd: end };
}

// ── Main render function ───────────────────────────────────────────

/**
 * Render a QR matrix as an SVG string.
 *
 * @param matrix - 2D boolean array from generateQR()
 * @param options - Style options
 * @returns SVG markup string
 */
export function renderQRSvg(
  matrix: boolean[][],
  options?: QRStyleOptions,
): string {
  const mod = options?.moduleSize ?? 10;
  const quiet = options?.quietZone ?? 4;
  const fg = options?.foreground ?? "#000000";
  const bg = options?.background ?? "#ffffff";
  const shape = options?.moduleShape ?? "square";
  const logoUrl = options?.logoUrl;
  const logoScale = options?.logoScale ?? 0.2;
  const logoMargin = options?.logoMargin ?? 1;
  const logoBgShape = options?.logoBackgroundShape ?? "square";
  const logoBgColor = options?.logoBackgroundColor ?? (bg === "transparent" ? "#ffffff" : bg);
  const outerShape = options?.outerShape ?? "square";
  const gradient = options?.gradient;

  // Eye options — defaults inherit from module style / foreground
  const eyeOuterShape = options?.eyeShape ?? (shape === "dot" ? "circle" : shape === "rounded" ? "rounded" : "square");
  const eyeOuterColor = options?.eyeColor ?? fg;
  const eyeInnerShape = options?.eyeInnerShape ?? (eyeOuterShape === "circle" ? "circle" : eyeOuterShape === "rounded" ? "rounded" : "square");
  const eyeInnerColor = options?.eyeInnerColor ?? eyeOuterColor;
  const eyeGradient = options?.eyeGradient;
  const eyeInnerGradient = options?.eyeInnerGradient;

  // Deep-copy matrix so logo clearing doesn't affect caller
  const mat = matrix.map((row) => [...row]);
  const count = mat.length;
  const totalModules = count + quiet * 2;
  const size = totalModules * mod;

  // Clear logo area from matrix before rendering
  if (logoUrl) {
    clearLogoArea(mat, count, logoScale, logoMargin);
  }

  const parts: string[] = [];
  const defs: string[] = [];

  // ── Build gradient defs ────────────────────────────────────────

  let fgFill = fg;
  if (gradient && gradient.colorStops.length >= 2) {
    defs.push(renderGradientDef("qr-fg-grad", gradient));
    fgFill = "url(#qr-fg-grad)";
  }

  let eyeOuterFill = eyeGradient ? "url(#qr-eye-grad)" : eyeOuterColor;
  if (eyeGradient && eyeGradient.colorStops.length >= 2) {
    defs.push(renderGradientDef("qr-eye-grad", eyeGradient));
  }

  let eyeInnerFill = eyeInnerGradient ? "url(#qr-eye-inner-grad)" : eyeInnerColor;
  if (eyeInnerGradient && eyeInnerGradient.colorStops.length >= 2) {
    defs.push(renderGradientDef("qr-eye-inner-grad", eyeInnerGradient));
  }

  // Circle clip path
  if (outerShape === "circle") {
    defs.push(`<clipPath id="qr-clip"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></clipPath>`);
  }

  // ── SVG open ───────────────────────────────────────────────────

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"${shape === "square" ? ' shape-rendering="crispEdges"' : ""}>`,
  );

  if (defs.length > 0) {
    parts.push(`<defs>${defs.join("")}</defs>`);
  }

  // Wrap in clip group if circle
  if (outerShape === "circle") {
    parts.push(`<g clip-path="url(#qr-clip)">`);
  }

  // Background
  if (bg !== "transparent") {
    parts.push(`<rect width="${size}" height="${size}" fill="${bg}"/>`);
  }

  // ── Render data modules (non-finder) ───────────────────────────

  const renderFn = getShapeRenderer(shape);

  // For square shape with no gradient, use row-run optimization
  if (shape === "square" && !gradient) {
    parts.push(`<g fill="${fgFill}">`);
    for (let row = 0; row < count; row++) {
      let col = 0;
      while (col < count) {
        if (!mat[row][col] || isFinderModule(row, col, count)) {
          col++;
          continue;
        }
        let runLen = 1;
        while (
          col + runLen < count &&
          mat[row][col + runLen] &&
          !isFinderModule(row, col + runLen, count)
        ) {
          runLen++;
        }
        const x = (quiet + col) * mod;
        const y = (quiet + row) * mod;
        parts.push(`<rect x="${x}" y="${y}" width="${runLen * mod}" height="${mod}"/>`);
        col += runLen;
      }
    }
    parts.push(`</g>`);
  } else {
    // Individual module rendering for all other shapes
    parts.push(`<g fill="${fgFill}">`);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!mat[row][col]) continue;
        if (isFinderModule(row, col, count)) continue;
        const x = (quiet + col) * mod;
        const y = (quiet + row) * mod;
        parts.push(renderFn(x, y, mod, row, col));
      }
    }
    parts.push(`</g>`);
  }

  // ── Render finder patterns (eyes) ──────────────────────────────

  const bgForHole = bg === "transparent" ? "#ffffff" : bg;
  const regions = getFinderRegions(count);

  for (const region of regions) {
    const rx = (quiet + region.colStart) * mod;
    const ry = (quiet + region.rowStart) * mod;

    // Outer ring (7x7 border with 5x5 hole)
    let outerSvg = renderEyeOuter(rx, ry, mod, eyeOuterShape as EyeOuterShape, eyeOuterFill);
    // Replace the hole color placeholder with actual background
    outerSvg = outerSvg.replace(/EYEHOLE/g, bgForHole);
    parts.push(outerSvg);

    // Inner dot (3x3 at center)
    const innerX = rx + 2 * mod;
    const innerY = ry + 2 * mod;
    parts.push(renderEyeInner(innerX, innerY, mod, eyeInnerShape as EyeInnerShape, eyeInnerFill));
  }

  // ── Center logo overlay ────────────────────────────────────────

  if (logoUrl) {
    const logoSize = count * mod * logoScale;
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;
    const pad = logoMargin * mod;
    const clearW = logoSize + pad * 2;
    const clearH = logoSize + pad * 2;
    const clearX = logoX - pad;
    const clearY = logoY - pad;

    // Background shape behind logo
    switch (logoBgShape) {
      case "circle": {
        const cr = clearW / 2;
        parts.push(`<circle cx="${clearX + cr}" cy="${clearY + cr}" r="${cr}" fill="${logoBgColor}"/>`);
        break;
      }
      case "rounded": {
        const rr = clearW * 0.15;
        parts.push(`<rect x="${clearX}" y="${clearY}" width="${clearW}" height="${clearH}" rx="${rr}" ry="${rr}" fill="${logoBgColor}"/>`);
        break;
      }
      default:
        parts.push(`<rect x="${clearX}" y="${clearY}" width="${clearW}" height="${clearH}" fill="${logoBgColor}"/>`);
    }

    parts.push(
      `<image href="${escapeXml(logoUrl)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`,
    );
  }

  // Close clip group
  if (outerShape === "circle") {
    parts.push(`</g>`);
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

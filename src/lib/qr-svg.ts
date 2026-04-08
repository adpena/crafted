/**
 * SVG renderer for QR code matrices — zero DOM dependency, runs on Workers.
 *
 * Takes the boolean[][] from generateQR() and produces a clean SVG string.
 *
 * @module
 */

export interface QRStyleOptions {
  /** Module (dot) size in pixels. Default: 10 */
  moduleSize?: number;
  /** Quiet zone (border) in modules. Default: 4 */
  quietZone?: number;
  /** Foreground color. Default: "#000000" */
  foreground?: string;
  /** Background color. Default: "#ffffff" */
  background?: string;
  /** Module shape: "square" | "rounded" | "dot". Default: "square" */
  moduleShape?: "square" | "rounded" | "dot";
  /** Optional center logo URL (rendered as an embedded image). */
  logoUrl?: string;
  /** Logo size as fraction of QR size. Default: 0.2 (20%) */
  logoScale?: number;
}

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

  const count = matrix.length;
  const totalModules = count + quiet * 2;
  const size = totalModules * mod;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">`,
  );
  parts.push(`<rect width="${size}" height="${size}" fill="${bg}"/>`);

  if (shape === "dot") {
    // Circle modules — no row-run optimization possible
    const r = mod * 0.45;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!matrix[row][col]) continue;
        const cx = (quiet + col + 0.5) * mod;
        const cy = (quiet + row + 0.5) * mod;
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fg}"/>`);
      }
    }
  } else {
    // Square or rounded — use row-run optimization (merge consecutive dark modules)
    const rx = shape === "rounded" ? mod * 0.3 : 0;
    const ry = rx;

    for (let row = 0; row < count; row++) {
      let col = 0;
      while (col < count) {
        if (!matrix[row][col]) {
          col++;
          continue;
        }
        // Find run length
        let runLen = 1;
        while (col + runLen < count && matrix[row][col + runLen]) runLen++;

        const x = (quiet + col) * mod;
        const y = (quiet + row) * mod;
        const w = runLen * mod;
        const h = mod;

        if (rx > 0) {
          parts.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${ry}" fill="${fg}"/>`,
          );
        } else {
          parts.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fg}"/>`,
          );
        }
        col += runLen;
      }
    }
  }

  // Center logo overlay
  if (logoUrl) {
    const logoSize = count * mod * logoScale;
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;
    const pad = logoSize * 0.1;
    // White background behind logo for contrast / error correction clearance
    parts.push(
      `<rect x="${logoX - pad}" y="${logoY - pad}" width="${logoSize + pad * 2}" height="${logoSize + pad * 2}" fill="${bg}" rx="${pad}"/>`,
    );
    parts.push(
      `<image href="${escapeXml(logoUrl)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`,
    );
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

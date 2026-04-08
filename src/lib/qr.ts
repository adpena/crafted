/**
 * Pure TypeScript QR code encoder — zero dependencies, runs on Workers.
 *
 * Supports byte mode (any ASCII/UTF-8), error correction levels L/M/Q/H,
 * versions 1-10 (up to ~270 bytes at EC level L — plenty for URLs).
 *
 * Based on the Nayuki QR algorithm (MIT-licensed reference).
 *
 * @module
 */

// ── EC level enum ─────────────────────────────────────────────────

/** QR error correction levels, ordered by increasing redundancy. */
export type ECLevel = "L" | "M" | "Q" | "H";

/** Numeric EC level indicators for format information (ISO 18004 Table C.1) */
const EC_LEVEL_BITS: Record<ECLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

// ── Galois field GF(2^8) arithmetic for Reed-Solomon ──────────────

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = v;
    GF_LOG[v] = i;
    v <<= 1;
    if (v >= 256) v ^= 0x11d; // primitive polynomial
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// ── Reed-Solomon error correction ──────────────────────────────────

function rsGenPoly(degree: number): Uint8Array {
  const gen = new Uint8Array(degree + 1);
  gen[0] = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = i + 1; j >= 1; j--) {
      gen[j] = gen[j - 1] ^ gfMul(gen[j], GF_EXP[i]);
    }
    gen[0] = gfMul(gen[0], GF_EXP[i]);
  }
  return gen;
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      remainder[j] ^= gfMul(gen[ecCount - 1 - j], factor);
    }
  }
  return remainder;
}

// ── QR version / capacity tables (all EC levels, versions 1-10) ──

interface VersionInfo {
  /** Total data codewords (before EC) */
  dataCodewords: number;
  /** EC codewords per block */
  ecPerBlock: number;
  /** Number of group-1 blocks */
  g1Blocks: number;
  /** Data codewords in each group-1 block */
  g1DataCw: number;
  /** Number of group-2 blocks */
  g2Blocks: number;
  /** Data codewords in each group-2 block */
  g2DataCw: number;
  /** Alignment pattern center coordinates */
  alignCenters: number[];
}

/**
 * ISO 18004 capacity tables for versions 1-10, all EC levels.
 * Key: `${version}-${ecLevel}`, value: VersionInfo.
 *
 * Data from ISO 18004:2015 Tables 7, 9, and Annex A.
 */
const VERSION_EC_TABLE: Record<string, VersionInfo> = {};

// Alignment pattern centers per version (shared across EC levels)
const ALIGN_CENTERS: number[][] = [
  /* v0 */ [],
  /* v1 */ [],
  /* v2 */ [6, 18],
  /* v3 */ [6, 22],
  /* v4 */ [6, 26],
  /* v5 */ [6, 30],
  /* v6 */ [6, 34],
  /* v7 */ [6, 22, 38],
  /* v8 */ [6, 24, 42],
  /* v9 */ [6, 26, 46],
  /* v10 */ [6, 28, 50],
];

// Compact table: [version, level, dataCodewords, ecPerBlock, g1Blocks, g1DataCw, g2Blocks, g2DataCw]
const RAW_TABLE: [number, ECLevel, number, number, number, number, number, number][] = [
  // Version 1
  [1, "L", 19, 7, 1, 19, 0, 0],
  [1, "M", 16, 10, 1, 16, 0, 0],
  [1, "Q", 13, 13, 1, 13, 0, 0],
  [1, "H", 9, 17, 1, 9, 0, 0],
  // Version 2
  [2, "L", 34, 10, 1, 34, 0, 0],
  [2, "M", 28, 16, 1, 28, 0, 0],
  [2, "Q", 22, 22, 1, 22, 0, 0],
  [2, "H", 16, 28, 1, 16, 0, 0],
  // Version 3
  [3, "L", 55, 15, 1, 55, 0, 0],
  [3, "M", 44, 26, 1, 44, 0, 0],
  [3, "Q", 34, 18, 2, 17, 0, 0],
  [3, "H", 26, 22, 2, 13, 0, 0],
  // Version 4
  [4, "L", 80, 20, 1, 80, 0, 0],
  [4, "M", 64, 18, 2, 32, 0, 0],
  [4, "Q", 48, 26, 2, 24, 0, 0],
  [4, "H", 36, 16, 4, 9, 0, 0],
  // Version 5
  [5, "L", 108, 26, 1, 108, 0, 0],
  [5, "M", 86, 24, 2, 43, 0, 0],
  [5, "Q", 62, 18, 2, 15, 2, 16],
  [5, "H", 46, 22, 2, 11, 2, 12],
  // Version 6
  [6, "L", 136, 18, 2, 68, 0, 0],
  [6, "M", 108, 16, 4, 27, 0, 0],
  [6, "Q", 76, 24, 4, 19, 0, 0],
  [6, "H", 60, 28, 4, 15, 0, 0],
  // Version 7
  [7, "L", 156, 20, 2, 78, 0, 0],
  [7, "M", 124, 18, 4, 31, 0, 0],
  [7, "Q", 88, 18, 2, 14, 4, 15],
  [7, "H", 66, 26, 4, 13, 1, 14],
  // Version 8
  [8, "L", 194, 24, 2, 97, 0, 0],
  [8, "M", 154, 22, 2, 38, 2, 39],
  [8, "Q", 110, 22, 4, 18, 2, 19],
  [8, "H", 86, 26, 4, 14, 2, 15],
  // Version 9
  [9, "L", 232, 30, 2, 116, 0, 0],
  [9, "M", 182, 22, 3, 36, 2, 37],
  [9, "Q", 132, 20, 4, 16, 4, 17],
  [9, "H", 100, 24, 4, 12, 4, 13],
  // Version 10
  [10, "L", 274, 18, 2, 68, 2, 69],
  [10, "M", 216, 26, 4, 43, 1, 44],
  [10, "Q", 154, 24, 6, 19, 2, 20],
  [10, "H", 122, 28, 6, 15, 2, 16],
];

for (const [v, ec, dataCw, ecPer, g1b, g1d, g2b, g2d] of RAW_TABLE) {
  VERSION_EC_TABLE[`${v}-${ec}`] = {
    dataCodewords: dataCw,
    ecPerBlock: ecPer,
    g1Blocks: g1b,
    g1DataCw: g1d,
    g2Blocks: g2b,
    g2DataCw: g2d,
    alignCenters: ALIGN_CENTERS[v],
  };
}

function getVersionInfo(version: number, ecLevel: ECLevel): VersionInfo {
  const info = VERSION_EC_TABLE[`${version}-${ecLevel}`];
  if (!info) throw new Error(`No data for version ${version}, EC level ${ecLevel}`);
  return info;
}

function selectVersion(dataLen: number, ecLevel: ECLevel): number {
  // Byte mode overhead: 4 bits mode + 8/16 bits length + data + terminator
  for (let v = 1; v <= 10; v++) {
    const charCountBits = v <= 9 ? 8 : 16;
    const totalBits = 4 + charCountBits + dataLen * 8;
    const capacity = getVersionInfo(v, ecLevel).dataCodewords * 8;
    if (totalBits <= capacity) return v;
  }
  throw new Error(`Data too long for QR versions 1-10 at EC level ${ecLevel} (${dataLen} bytes)`);
}

// ── Data encoding (byte mode) ──────────────────────────────────────

function encodeData(text: string, version: number, ecLevel: ECLevel): Uint8Array {
  const info = getVersionInfo(version, ecLevel);
  const data = new TextEncoder().encode(text);
  const charCountBits = version <= 9 ? 8 : 16;

  // Build bit stream
  const bits: number[] = [];
  function pushBits(value: number, count: number) {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  }

  pushBits(0b0100, 4); // byte mode indicator
  pushBits(data.length, charCountBits);
  for (const b of data) pushBits(b, 8);

  // Terminator (up to 4 zero bits)
  const capacity = info.dataCodewords * 8;
  const termLen = Math.min(4, capacity - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes
  const codewords = new Uint8Array(info.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    codewords[i] = byte;
  }

  // Pad codewords with alternating 0xEC, 0x11
  let padIdx = bits.length / 8;
  const pads = [0xec, 0x11];
  let pi = 0;
  while (padIdx < info.dataCodewords) {
    codewords[padIdx++] = pads[pi++ % 2];
  }

  return codewords;
}

// ── Interleave data + EC blocks ────────────────────────────────────

function interleave(data: Uint8Array, version: number, ecLevel: ECLevel): Uint8Array {
  const info = getVersionInfo(version, ecLevel);
  const totalBlocks = info.g1Blocks + info.g2Blocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < totalBlocks; i++) {
    const blockDataLen = i < info.g1Blocks ? info.g1DataCw : info.g2DataCw;
    const blockData = data.slice(offset, offset + blockDataLen);
    offset += blockDataLen;
    dataBlocks.push(blockData);
    ecBlocks.push(rsEncode(blockData, info.ecPerBlock));
  }

  const result: number[] = [];

  // Interleave data codewords
  const maxDataLen = Math.max(info.g1DataCw, info.g2DataCw);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }

  return new Uint8Array(result);
}

// ── Matrix construction ────────────────────────────────────────────

function moduleCount(version: number): number {
  return 17 + version * 4;
}

type Grid = (boolean | null)[][];

function createGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

/** Place a finder pattern with its separator */
function placeFinderPattern(grid: Grid, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || rr >= grid.length || cc < 0 || cc >= grid.length) continue;
      const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      grid[rr][cc] = inOuter ? (onBorder || inInner) : false;
    }
  }
}

function placeAlignmentPattern(grid: Grid, row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      grid[row + r][col + c] = isBorder || isCenter;
    }
  }
}

function placeTimingPatterns(grid: Grid) {
  const size = grid.length;
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (grid[6][i] === null) grid[6][i] = val;
    if (grid[i][6] === null) grid[i][6] = val;
  }
}

function reserveFormatBits(grid: Grid) {
  const size = grid.length;
  // Around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
    if (grid[i][8] === null) grid[i][8] = false;
  }
  // Bottom-left
  for (let i = size - 8; i < size; i++) {
    if (grid[i][8] === null) grid[i][8] = false;
  }
  // Top-right
  for (let i = size - 8; i < size; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
  }
  // Dark module
  grid[size - 8][8] = true;
}

function placeFunctionPatterns(grid: Grid, version: number, ecLevel: ECLevel) {
  const size = grid.length;
  const info = getVersionInfo(version, ecLevel);

  // Finder patterns
  placeFinderPattern(grid, 0, 0);
  placeFinderPattern(grid, 0, size - 7);
  placeFinderPattern(grid, size - 7, 0);

  // Alignment patterns
  const centers = info.alignCenters;
  for (const r of centers) {
    for (const c of centers) {
      // Skip if overlapping finder patterns
      if (r <= 8 && c <= 8) continue;
      if (r <= 8 && c >= size - 9) continue;
      if (r >= size - 9 && c <= 8) continue;
      placeAlignmentPattern(grid, r, c);
    }
  }

  placeTimingPatterns(grid);
  reserveFormatBits(grid);
}

// ── Data placement ─────────────────────────────────────────────────

function placeData(grid: Grid, data: Uint8Array) {
  const size = grid.length;
  let bitIdx = 0;
  const totalBits = data.length * 8;

  // Data is placed in 2-column strips, right to left, alternating up/down
  let col = size - 1;
  while (col >= 0) {
    if (col === 6) col--; // skip timing column

    const upward = ((size - 1 - col) >> 1) % 2 === 0;
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (c < 0) continue;
        if (grid[row][c] !== null) continue;
        if (bitIdx < totalBits) {
          const byteIdx = bitIdx >> 3;
          const bitPos = 7 - (bitIdx & 7);
          grid[row][c] = ((data[byteIdx] >> bitPos) & 1) === 1;
          bitIdx++;
        } else {
          grid[row][c] = false;
        }
      }
    }
    col -= 2;
  }
}

// ── Masking ────────────────────────────────────────────────────────

type MaskFn = (row: number, col: number) => boolean;

const MASK_FUNCTIONS: MaskFn[] = [
  (r, c) => (r + c) % 2 === 0,
  (r, _) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(grid: Grid, functionGrid: Grid, maskIdx: number): Grid {
  const size = grid.length;
  const result: Grid = grid.map((row) => [...row]);
  const fn = MASK_FUNCTIONS[maskIdx];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (functionGrid[r][c] !== null) continue; // skip function modules
      if (fn(r, c)) {
        result[r][c] = !result[r][c];
      }
    }
  }
  return result;
}

// ── Penalty scoring ────────────────────────────────────────────────

function penaltyScore(grid: Grid): number {
  const size = grid.length;
  let score = 0;

  // Rule 1: runs of same color (horizontal + vertical)
  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) score += runLen - 2;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += runLen - 2;
  }
  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) score += runLen - 2;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += runLen - 2;
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 3: finder-like patterns
  const pattern1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pattern2 = [...pattern1].reverse();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      let match1 = true, match2 = true;
      for (let k = 0; k < 11; k++) {
        if (grid[r][c + k] !== pattern1[k]) match1 = false;
        if (grid[r][c + k] !== pattern2[k]) match2 = false;
      }
      if (match1 || match2) score += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 11; r++) {
      let match1 = true, match2 = true;
      for (let k = 0; k < 11; k++) {
        if (grid[r + k][c] !== pattern1[k]) match1 = false;
        if (grid[r + k][c] !== pattern2[k]) match2 = false;
      }
      if (match1 || match2) score += 40;
    }
  }

  // Rule 4: proportion of dark modules
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) darkCount++;
    }
  }
  const pct = (darkCount * 100) / (size * size);
  const prev5 = Math.floor(pct / 5) * 5;
  const next5 = prev5 + 5;
  score += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

  return score;
}

// ── Format information ─────────────────────────────────────────────

/**
 * Compute format bits for a given EC level and mask pattern.
 * BCH(15,5) encoding per ISO 18004 Annex C.
 */
function computeFormatBits(ecLevel: ECLevel, mask: number): number {
  const ecBits = EC_LEVEL_BITS[ecLevel];
  let data = (ecBits << 3) | mask;
  let bits = data << 10;
  // Polynomial division by x^10 + x^8 + x^5 + x^4 + x^2 + x + 1 (0x537)
  for (let i = 4; i >= 0; i--) {
    if (bits & (1 << (i + 10))) {
      bits ^= 0x537 << i;
    }
  }
  bits = (data << 10) | bits;
  bits ^= 0x5412; // XOR mask
  return bits;
}

function placeFormatBits(grid: Grid, ecLevel: ECLevel, maskIdx: number) {
  const size = grid.length;
  const bits = computeFormatBits(ecLevel, maskIdx);

  // Horizontal strip near top-left
  const hPositions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const val = ((bits >> i) & 1) === 1;
    const [r, c] = hPositions[i];
    grid[r][c] = val;
  }

  // Second copy: bottom-left vertical + top-right horizontal
  const vPositions: [number, number][] = [];
  for (let i = 0; i < 7; i++) vPositions.push([size - 1 - i, 8]);
  for (let i = 7; i < 15; i++) vPositions.push([8, size - 15 + i]);

  for (let i = 0; i < 15; i++) {
    const val = ((bits >> i) & 1) === 1;
    const [r, c] = vPositions[i];
    grid[r][c] = val;
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generate a QR code matrix from a text string.
 *
 * @param text - The data to encode (typically a URL, up to ~270 bytes at EC level L)
 * @param ecLevel - Error correction level: L (7%), M (15%), Q (25%), H (30%). Default: M
 * @returns 2D boolean array where `true` = dark module
 */
export function generateQR(text: string, ecLevel: ECLevel = "M"): boolean[][] {
  // Use UTF-8 byte length for version selection — JS string.length counts
  // UTF-16 code units which undercount multi-byte characters (emoji, CJK).
  const byteLength = new TextEncoder().encode(text).length;
  const version = selectVersion(byteLength, ecLevel);
  const size = moduleCount(version);

  // Encode data codewords
  const dataCw = encodeData(text, version, ecLevel);

  // Generate interleaved data + EC codewords
  const finalData = interleave(dataCw, version, ecLevel);

  // Create function-pattern grid (to know which cells are reserved)
  const functionGrid = createGrid(size);
  placeFunctionPatterns(functionGrid, version, ecLevel);

  // Place data in a working grid
  const workGrid = createGrid(size);
  placeFunctionPatterns(workGrid, version, ecLevel);
  placeData(workGrid, finalData);

  // Evaluate all 8 masks, pick the best
  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(workGrid, functionGrid, m);
    placeFormatBits(masked, ecLevel, m);
    const score = penaltyScore(masked);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
    }
  }

  // Apply best mask and format bits
  const result = applyMask(workGrid, functionGrid, bestMask);
  placeFormatBits(result, ecLevel, bestMask);

  return result.map((row) => row.map((cell) => cell === true));
}

/**
 * Pure TypeScript QR code encoder — zero dependencies, runs on Workers.
 *
 * Supports byte mode (any ASCII/UTF-8), error correction level M,
 * versions 1–10 (up to 213 bytes of data — plenty for URLs).
 *
 * Based on the Nayuki QR algorithm (MIT-licensed reference).
 *
 * @module
 */

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

// ── QR version / capacity tables (byte mode, EC level M) ──────────

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

// Versions 1–10, EC level M
const VERSION_TABLE: VersionInfo[] = [
  /* v0 placeholder */ { dataCodewords: 0, ecPerBlock: 0, g1Blocks: 0, g1DataCw: 0, g2Blocks: 0, g2DataCw: 0, alignCenters: [] },
  /* v1  */ { dataCodewords: 16, ecPerBlock: 10, g1Blocks: 1, g1DataCw: 16, g2Blocks: 0, g2DataCw: 0, alignCenters: [] },
  /* v2  */ { dataCodewords: 28, ecPerBlock: 16, g1Blocks: 1, g1DataCw: 28, g2Blocks: 0, g2DataCw: 0, alignCenters: [6, 18] },
  /* v3  */ { dataCodewords: 44, ecPerBlock: 26, g1Blocks: 1, g1DataCw: 44, g2Blocks: 0, g2DataCw: 0, alignCenters: [6, 22] },
  /* v4  */ { dataCodewords: 64, ecPerBlock: 18, g1Blocks: 2, g1DataCw: 32, g2Blocks: 0, g2DataCw: 0, alignCenters: [6, 26] },
  /* v5  */ { dataCodewords: 86, ecPerBlock: 24, g1Blocks: 2, g1DataCw: 43, g2Blocks: 0, g2DataCw: 0, alignCenters: [6, 30] },
  /* v6  */ { dataCodewords: 108, ecPerBlock: 16, g1Blocks: 4, g1DataCw: 27, g2Blocks: 0, g2DataCw: 0, alignCenters: [6, 34] },
  /* v7  */ { dataCodewords: 124, ecPerBlock: 18, g1Blocks: 4, g1DataCw: 31, g2Blocks: 0, g2DataCw: 0, alignCenters: [6, 22, 38] },
  /* v8  */ { dataCodewords: 154, ecPerBlock: 22, g1Blocks: 2, g1DataCw: 38, g2Blocks: 2, g2DataCw: 39, alignCenters: [6, 24, 42] },
  /* v9  */ { dataCodewords: 182, ecPerBlock: 22, g1Blocks: 3, g1DataCw: 36, g2Blocks: 2, g2DataCw: 37, alignCenters: [6, 26, 46] },
  /* v10 */ { dataCodewords: 216, ecPerBlock: 26, g1Blocks: 4, g1DataCw: 43, g2Blocks: 1, g2DataCw: 44, alignCenters: [6, 28, 50] },
];

function selectVersion(dataLen: number): number {
  // Byte mode overhead: 4 bits mode + 8/16 bits length + data + terminator
  for (let v = 1; v <= 10; v++) {
    const charCountBits = v <= 9 ? 8 : 16;
    const totalBits = 4 + charCountBits + dataLen * 8;
    const capacity = VERSION_TABLE[v].dataCodewords * 8;
    if (totalBits <= capacity) return v;
  }
  throw new Error(`Data too long for QR versions 1-10 (${dataLen} bytes)`);
}

// ── Data encoding (byte mode) ──────────────────────────────────────

function encodeData(text: string, version: number): Uint8Array {
  const info = VERSION_TABLE[version];
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

function interleave(data: Uint8Array, version: number): Uint8Array {
  const info = VERSION_TABLE[version];
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

function placeFunctionPatterns(grid: Grid, version: number) {
  const size = grid.length;

  // Finder patterns
  placeFinderPattern(grid, 0, 0);
  placeFinderPattern(grid, 0, size - 7);
  placeFinderPattern(grid, size - 7, 0);

  // Alignment patterns
  const centers = VERSION_TABLE[version].alignCenters;
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

// EC level M = 0b00, mask patterns 0-7
const FORMAT_BITS_TABLE: number[] = [];

(function initFormatBits() {
  // BCH(15,5) encoding for format info
  // Format = EC level (2 bits) + mask (3 bits) → 5 data bits → 15 total with EC
  for (let mask = 0; mask < 8; mask++) {
    let data = (0b00 << 3) | mask; // EC level M = 00
    let bits = data << 10;
    // Polynomial division by x^10 + x^8 + x^5 + x^4 + x^2 + x + 1 (0x537)
    for (let i = 4; i >= 0; i--) {
      if (bits & (1 << (i + 10))) {
        bits ^= 0x537 << i;
      }
    }
    bits = (data << 10) | bits;
    bits ^= 0x5412; // XOR mask
    FORMAT_BITS_TABLE.push(bits);
  }
})();

function placeFormatBits(grid: Grid, maskIdx: number) {
  const size = grid.length;
  const bits = FORMAT_BITS_TABLE[maskIdx];

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
 * @param text - The data to encode (typically a URL, up to ~210 bytes)
 * @returns 2D boolean array where `true` = dark module
 */
export function generateQR(text: string): boolean[][] {
  const version = selectVersion(text.length);
  const size = moduleCount(version);
  const info = VERSION_TABLE[version];

  // Encode data codewords
  const dataCw = encodeData(text, version);

  // Generate interleaved data + EC codewords
  const finalData = interleave(dataCw, version);

  // Create function-pattern grid (to know which cells are reserved)
  const functionGrid = createGrid(size);
  placeFunctionPatterns(functionGrid, version);

  // Place data in a working grid
  const workGrid = createGrid(size);
  placeFunctionPatterns(workGrid, version);
  placeData(workGrid, finalData);

  // Evaluate all 8 masks, pick the best
  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(workGrid, functionGrid, m);
    placeFormatBits(masked, m);
    const score = penaltyScore(masked);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
    }
  }

  // Apply best mask and format bits
  const result = applyMask(workGrid, functionGrid, bestMask);
  placeFormatBits(result, bestMask);

  return result.map((row) => row.map((cell) => cell === true));
}

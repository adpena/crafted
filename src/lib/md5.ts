/**
 * Minimal MD5 implementation for Cloudflare Workers.
 *
 * Workers' crypto.subtle does not support MD5. This pure-JS implementation
 * is used exclusively for Mailchimp's subscriber_hash (MD5 of lowercase email).
 *
 * Based on the well-known RFC 1321 algorithm. Only ~60 lines of logic.
 */

export function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const padded = pad(bytes);
  let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] =
        padded[i + j * 4] |
        (padded[i + j * 4 + 1] << 8) |
        (padded[i + j * 4 + 2] << 16) |
        (padded[i + j * 4 + 3] << 24);
    }

    let [aa, bb, cc, dd] = [a, b, c, d];

    for (let j = 0; j < 64; j++) {
      let f: number, g: number;
      if (j < 16) {
        f = (bb & cc) | (~bb & dd);
        g = j;
      } else if (j < 32) {
        f = (dd & bb) | (~dd & cc);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * j + 5) % 16;
      } else {
        f = cc ^ (bb | ~dd);
        g = (7 * j) % 16;
      }
      const temp = dd;
      dd = cc;
      cc = bb;
      bb = (bb + rotl((aa + f + K[j] + M[g]) >>> 0, S[j])) >>> 0;
      aa = temp;
    }

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }

  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function toHex(n: number): string {
  return (
    ((n & 0xff).toString(16).padStart(2, "0")) +
    (((n >>> 8) & 0xff).toString(16).padStart(2, "0")) +
    (((n >>> 16) & 0xff).toString(16).padStart(2, "0")) +
    (((n >>> 24) & 0xff).toString(16).padStart(2, "0"))
  );
}

function pad(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8;
  // message + 1 byte (0x80) + padding + 8 bytes (length)
  const totalLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  // Append original length in bits as 64-bit LE (only low 32 bits needed for our use)
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, 0, true);
  return buf;
}

/* prettier-ignore */
const K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

/* prettier-ignore */
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

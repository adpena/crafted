// Mandelbrot render worker — smooth coloring, warm editorial palette
self.onmessage = function(e) {
  const { W, H, cx, cy, zoom, maxIter, colorShift } = e.data;
  const scale = 3.0 / (zoom * W);
  const buf = new Uint8ClampedArray(W * H * 4);
  const ln2 = Math.log(2);
  const shift = colorShift || 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cr = cx + (x - W / 2) * scale;
      const ci = cy + (y - H / 2) * scale;
      let zr = 0, zi = 0, i = 0;
      while (i < maxIter) {
        const tr = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = tr;
        if (zr * zr + zi * zi > 256) break;
        i++;
      }
      const idx = (y * W + x) * 4;
      if (i === maxIter) {
        buf[idx] = 26; buf[idx + 1] = 26; buf[idx + 2] = 26; // near-black (#1a1a1a)
      } else {
        const mag = Math.sqrt(zr * zr + zi * zi);
        const mu = i + 1 - Math.log(Math.log(mag)) / ln2;
        const t = (mu + shift) * 0.015;
        // Warm editorial palette: cream, amber, terracotta, deep blue
        const r = 0.5 + 0.5 * Math.cos(6.28 * (t + 0.0));
        const g = 0.5 + 0.5 * Math.cos(6.28 * (t + 0.15));
        const b = 0.5 + 0.5 * Math.cos(6.28 * (t + 0.35));
        buf[idx]     = (r * 235 + 20) | 0;
        buf[idx + 1] = (g * 210 + 20) | 0;
        buf[idx + 2] = (b * 200 + 30) | 0;
      }
      buf[idx + 3] = 255;
    }
  }

  self.postMessage({ buf, W, H }, [buf.buffer]);
};

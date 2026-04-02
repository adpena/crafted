// Mandelbrot render worker — smooth coloring, off main thread
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
        buf[idx] = buf[idx + 1] = buf[idx + 2] = 0;
      } else {
        // Smooth iteration count avoids color banding
        const mag = Math.sqrt(zr * zr + zi * zi);
        const mu = i + 1 - Math.log(Math.log(mag)) / ln2;
        const t = (mu + shift) * 0.025;
        // Sine-based palette — cycles smoothly, never repeats exactly
        buf[idx]     = (Math.sin(t * 3.0) * 127 + 128) | 0;
        buf[idx + 1] = (Math.sin(t * 3.0 + 2.1) * 127 + 128) | 0;
        buf[idx + 2] = (Math.sin(t * 3.0 + 4.2) * 127 + 128) | 0;
      }
      buf[idx + 3] = 255;
    }
  }

  self.postMessage({ buf, W, H }, [buf.buffer]);
};

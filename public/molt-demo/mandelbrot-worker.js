// Mandelbrot render worker — runs off the main thread
self.onmessage = function(e) {
  const { W, H, cx, cy, zoom, maxIter } = e.data;
  const scale = 3.0 / (zoom * W);
  const buf = new Uint8ClampedArray(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cr = cx + (x - W / 2) * scale;
      const ci = cy + (y - H / 2) * scale;
      let zr = 0, zi = 0, i = 0;
      while (i < maxIter) {
        const tr = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = tr;
        if (zr * zr + zi * zi > 4) break;
        i++;
      }
      const idx = (y * W + x) * 4;
      if (i === maxIter) {
        buf[idx] = buf[idx+1] = buf[idx+2] = 0;
      } else {
        const t = i / maxIter;
        buf[idx]   = (9 * (1-t) * t*t*t * 255) | 0;
        buf[idx+1] = (15 * (1-t)*(1-t) * t*t * 255) | 0;
        buf[idx+2] = (8.5 * (1-t)*(1-t)*(1-t) * t * 255) | 0;
      }
      buf[idx+3] = 255;
    }
  }

  self.postMessage({ buf, W, H }, [buf.buffer]);
};

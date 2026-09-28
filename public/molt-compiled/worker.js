import { loadMoltWasm } from './browser_host.js';
self.onmessage = async () => {
  try {
    const rows = [];
    const started = performance.now();
    const app = await loadMoltWasm({
      linkedUrl: new URL('./mandelbrot.wasm', import.meta.url).href,
      log: (level, text) => {
        if (level === 'stdout') rows.push(text);
        else if (level === 'stderr') throw new Error(text);
      },
    });
    app.run();
    if (rows.length !== 28 || rows.some((row) => row.length !== 72)) throw new Error('Unexpected program output');
    self.postMessage({ type: 'done', output: rows.join('\n'), elapsed: performance.now() - started });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

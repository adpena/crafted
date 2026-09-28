import { loadMoltWasm } from './browser_host.js';
self.onmessage = async (event) => {
  try {
    const name = event.data.example;
    if (!['mandelbrot', 'transfer-summary', 'word-count'].includes(name)) throw new Error('Unknown example');
    const rows = [];
    const started = performance.now();
    const app = await loadMoltWasm({
      linkedUrl: new URL(`./${name}.wasm`, import.meta.url).href,
      log: (level, text) => {
        if (level === 'stdout') rows.push(text);
        else if (level === 'stderr') throw new Error(text);
      },
    });
    app.run();
    if (!rows.length) throw new Error('The program produced no output');
    self.postMessage({ type: 'done', output: rows.join('\n'), elapsed: performance.now() - started });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

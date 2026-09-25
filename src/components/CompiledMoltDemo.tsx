import { useEffect, useRef, useState } from "react";

export default function CompiledMoltDemo() {
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Ready to run");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/molt-compiled/mandelbrot.py", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("Source unavailable");
      return response.text();
    }).then(setSource).catch(() => {});
    return () => { controller.abort(); worker.current?.terminate(); if (timeout.current) clearTimeout(timeout.current); };
  }, []);

  function run() {
    if (running) return;
    setRunning(true); setOutput(""); setStatus("Loading and running WebAssembly…");
    try {
      worker.current = new Worker("/molt-compiled/worker.js", { type: "module" });
      const finish = () => { if (timeout.current) clearTimeout(timeout.current); worker.current?.terminate(); worker.current = null; setRunning(false); };
      worker.current.onmessage = (event) => {
        if (event.data.type === "done") {
          setOutput(event.data.output);
          setStatus(`Finished in ${(event.data.elapsed / 1000).toFixed(2)} seconds, including loading. Executed by WebAssembly.`);
        } else setStatus(`Could not run: ${event.data.message}`);
        finish();
      };
      worker.current.onerror = () => { setStatus("Could not start the WebAssembly worker. Try reloading the page."); finish(); };
      timeout.current = setTimeout(() => { setStatus("The example timed out. Try again."); finish(); }, 30000);
      worker.current.postMessage({ type: "run" });
    } catch (error) { setRunning(false); setStatus(`Could not start: ${error instanceof Error ? error.message : String(error)}`); }
  }

  return <section className="artifact-panel" aria-label="Compiled Python demo">
    <p className="eyebrow">Python → Molt → WebAssembly</p>
    <h2>A small program, running in your browser</h2>
    <p>I compiled this Python Mandelbrot program with Molt. The button runs the resulting WebAssembly in a browser worker and displays its standard output.</p>
    <button className="demo-button" disabled={running} onClick={run}>{running ? "Running…" : "Run compiled Python"}</button>
    <p className="source-note" role="status" aria-live="polite">{status}</p>
    {output && <pre className="terminal-snapshot molt-output" tabIndex={0} aria-label="Mandelbrot output from the compiled Python program">{output}</pre>}
    <details><summary>Python source</summary>{source ? <pre tabIndex={0}>{source}</pre> : <p><a href="/molt-compiled/mandelbrot.py">Open the source file</a></p>}</details>
    <p className="source-note">This example was compiled ahead of time. Editing and compiling arbitrary Python on this website is not supported.</p>
    <div className="artifact-links"><a href="/molt-compiled/mandelbrot.py">Python source</a><a href="/molt-compiled/mandelbrot.wasm">Compiled Wasm (3.3 MB)</a><a href="/molt-compiled/provenance.json">Build record</a><a href="https://github.com/adpena/molt">Molt repository</a></div>
  </section>;
}

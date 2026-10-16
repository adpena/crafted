import { useEffect, useRef, useState } from "react";

export default function CompiledMoltDemo() {
  const [example, setExample] = useState("mandelbrot");
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [source, setSource] = useState("");
  const [sourceState, setSourceState] = useState<"loading" | "loaded" | "error">("loading");
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Ready to run");
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const runButton = useRef<HTMLButtonElement>(null);

  function stopWorker() {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    if (worker.current) {
      worker.current.onmessage = null;
      worker.current.onerror = null;
      worker.current.terminate();
      worker.current = null;
    }
  }

  useEffect(() => { setReady(true); return stopWorker; }, []);
  useEffect(() => { setOutput(""); setStatus("Ready to run"); }, [example]);

  useEffect(() => {
    setSource(""); setSourceState("loading");
    const controller = new AbortController();
    fetch(`/molt-compiled/${example}.py`, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("Source unavailable");
      return response.text();
    }).then((text) => {
      if (!controller.signal.aborted) { setSource(text); setSourceState("loaded"); }
    }).catch(() => { if (!controller.signal.aborted) setSourceState("error"); });
    return () => controller.abort();
  }, [example, sourceAttempt]);

  function run() {
    if (!ready || worker.current) return;
    setRunning(true); setOutput(""); setStatus("Loading and running WebAssembly…");
    try {
      worker.current = new Worker("/molt-compiled/worker.js", { type: "module" });
      const finish = () => { stopWorker(); setRunning(false); };
      worker.current.onmessage = (event) => {
        if (event.data.type === "done") {
          setOutput(event.data.output);
          setStatus(`Finished in ${(event.data.elapsed / 1000).toFixed(2)} seconds, including loading. Executed by WebAssembly.`);
        } else setStatus(`Could not run: ${event.data.message}. You can try again.`);
        finish();
      };
      worker.current.onerror = (event) => { event.preventDefault(); setStatus("Could not start the WebAssembly worker. Check your connection and try again."); finish(); };
      timeout.current = setTimeout(() => { setStatus("The example timed out. Try again."); finish(); }, 30000);
      worker.current.postMessage({ type: "run", example });
    } catch (error) { stopWorker(); setRunning(false); setStatus(`Could not start: ${error instanceof Error ? error.message : String(error)}. You can try again.`); }
  }

  function cancel() {
    stopWorker(); setRunning(false); setStatus("Stopped. You can choose another example or run this one again.");
    // The cancel button disappears; keep keyboard focus at the runnable control.
    requestAnimationFrame(() => runButton.current?.focus());
  }

  return <section className="artifact-panel" aria-label="Compiled Python demo">
    <p className="eyebrow">Python → Molt → WebAssembly</p>
    <h2>A small program, running in your browser</h2>
    <p>I compiled these Python programs with a pinned version of Molt. Choose a fractal, a school-data calculation, or a word counter. The button runs the resulting WebAssembly in a browser worker and displays its standard output.</p>
    <label className="example-picker">Python example<select value={example} disabled={!ready || running} onChange={(event) => setExample(event.target.value)}><option value="mandelbrot">Mandelbrot fractal</option><option value="transfer-summary">Austin ISD transfer summary</option><option value="word-count">Word counter</option></select></label>
    <noscript><p>Enable JavaScript to run the examples. You can still read the Python source and download the compiled files.</p></noscript>
    <div className="demo-actions"><button ref={runButton} className="demo-button" disabled={!ready || running} onClick={run}>{running ? "Running…" : "Run compiled Python"}</button>{running && <button className="demo-button demo-button-secondary" onClick={cancel}>Stop example</button>}</div>
    <p className="source-note" role="status" aria-live="polite">{status}</p>
    {output && <pre className="terminal-snapshot molt-output" tabIndex={0} aria-label="Output from the compiled Python program">{output}</pre>}
    <details><summary>Python source</summary>{sourceState === "loaded" ? <pre tabIndex={0}>{source}</pre> : <><p role="status">{!ready ? "Source preview requires JavaScript." : sourceState === "error" ? "The source preview could not be loaded." : "Loading source…"}</p><div className="demo-actions">{ready && sourceState === "error" && <button className="demo-button demo-button-secondary" onClick={() => setSourceAttempt((attempt) => attempt + 1)}>Retry source preview</button>}<a className="text-link" href={`/molt-compiled/${example}.py`}>Open the source file</a></div></>}</details>
    {example === "transfer-summary" && <p className="source-note">Counts from the <a href="/portfolio/charter-austin-original.docx">original Austin ISD report</a>, using May 2024 inputs. The program calculates transfer shares, not revenue losses.</p>}
    <p className="source-note">This example was compiled ahead of time. Editing and compiling arbitrary Python on this website is not supported.</p>
    <div className="artifact-links"><a href={`/molt-compiled/${example}.py`}>Python source</a><a href={`/molt-compiled/${example}.wasm`}>Compiled WebAssembly</a><a href="/molt-compiled/provenance.json">Build record</a><a href="https://github.com/adpena/molt">Molt repository</a></div>
  </section>;
}

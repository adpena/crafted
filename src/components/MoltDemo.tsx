import { useState, useEffect, useRef, useCallback } from "react";

interface MoltDemoProps {
	embedMode?: "standalone" | "embed" | "stacked";
}

const TARGET_X = -0.7453;
const TARGET_Y = 0.1127;
const MAX_CANVAS_W = 600;

export default function MoltDemo({ embedMode = "standalone" }: MoltDemoProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const codeRef = useRef<HTMLTextAreaElement>(null);
	const lineNumRef = useRef<HTMLDivElement>(null);
	const workerRef = useRef<Worker | null>(null);

	const [code, setCode] = useState("");
	const [animating, setAnimating] = useState(true);
	const [status, setStatus] = useState("Loading source...");
	const [meta, setMeta] = useState("");
	const [lineNumbers, setLineNumbers] = useState("1");

	// Mutable refs for animation loop (avoids stale closures)
	const stateRef = useRef({
		zoom: 1.0,
		frame: 0,
		animating: true,
		rendering: false,
		W: 640,
		H: 400,
	});

	// Update line numbers from code content
	const updateLineNumbers = useCallback((src: string) => {
		const count = (src || "").split("\n").length;
		setLineNumbers(Array.from({ length: count }, (_, i) => i + 1).join("\n"));
	}, []);

	// Parse render parameters from the Python source
	const parseParams = useCallback((src: string) => {
		const p = (name: string, fb: number) => {
			const m = src.match(new RegExp(name + "\\s*[:=]\\s*([\\-0-9.]+)"));
			return m ? parseFloat(m[1]) : fb;
		};
		return {
			maxIter: p("MAX_ITER", 100),
			cx: p("CENTER_X", TARGET_X),
			cy: p("CENTER_Y", TARGET_Y),
		};
	}, []);

	// Request a render from the Web Worker
	const requestRender = useCallback((src?: string) => {
		const s = stateRef.current;
		if (s.rendering || !workerRef.current) return;
		s.rendering = true;
		const source = src ?? codeRef.current?.value ?? "";
		const { maxIter, cx, cy } = parseParams(source);
		const dynamicIter = Math.min(800, Math.max(maxIter, 50 + Math.floor(Math.log(s.zoom + 1) * 40)));
		workerRef.current.postMessage({
			W: s.W, H: s.H, cx, cy,
			zoom: s.zoom,
			maxIter: dynamicIter,
			colorShift: s.frame * 0.08,
		});
	}, [parseParams]);

	// Animation loop
	const animate = useCallback(() => {
		const s = stateRef.current;
		if (!s.animating) return;
		s.zoom *= 1.0015;
		if (s.zoom > 1e12) s.zoom = 1.0;
		s.frame++;

		requestRender();

		const dynIter = Math.min(800, 50 + Math.floor(Math.log(s.zoom + 1) * 40));
		setMeta(`${s.W}×${s.H} · zoom: ${s.zoom.toFixed(1)}x · iter: ${dynIter} · frame ${s.frame}`);
		requestAnimationFrame(animate);
	}, [requestRender]);

	// Initialize canvas, worker, and load source
	useEffect(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Size canvas to container
		const rect = wrap.getBoundingClientRect();
		const aspect = rect.width / rect.height;
		const W = Math.min(MAX_CANVAS_W, Math.round(rect.width));
		const H = Math.round(W / aspect);
		canvas.width = W;
		canvas.height = H;
		stateRef.current.W = W;
		stateRef.current.H = H;

		// Create Web Worker
		const worker = new Worker("/molt-demo/mandelbrot-worker.js");
		workerRef.current = worker;

		worker.onmessage = (e) => {
			const { buf, W: w, H: h } = e.data;
			const img = new ImageData(new Uint8ClampedArray(buf), w, h);
			ctx.putImageData(img, 0, 0);
			stateRef.current.rendering = false;
		};

		// Load source
		fetch("/molt-demo/mandelbrot.py")
			.then((r) => r.text())
			.then((src) => {
				setCode(src);
				updateLineNumbers(src);
				setStatus("Animating — click canvas to pause");

				// Start rendering
				requestRender(src);
				requestAnimationFrame(animate);
			});

		return () => { worker.terminate(); };
	}, []);

	// Toggle animation on canvas click
	const handleCanvasClick = useCallback(() => {
		const s = stateRef.current;
		s.animating = !s.animating;
		setAnimating(s.animating);
		if (s.animating) requestAnimationFrame(animate);
		setStatus(s.animating ? "Animating" : "Paused — click to resume");
	}, [animate]);

	// Handle code edits
	const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const src = e.target.value;
		setCode(src);
		updateLineNumbers(src);
		stateRef.current.animating = false;
		setAnimating(false);
		setStatus("Paused — editing");
		requestRender(src);
	}, [updateLineNumbers, requestRender]);

	// Sync scroll between textarea and line numbers
	const handleCodeScroll = useCallback(() => {
		if (codeRef.current && lineNumRef.current) {
			lineNumRef.current.style.transform = `translateY(-${codeRef.current.scrollTop}px)`;
		}
	}, []);

	// WebMCP postMessage interface — allows AI agents to control the demo
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			if (!e.data || typeof e.data.tool !== "string") return;

			const { tool, params } = e.data;
			const s = stateRef.current;
			let result: unknown;

			switch (tool) {
				case "get_code":
					result = { code: codeRef.current?.value ?? "" };
					break;

				case "set_code":
					if (typeof params?.code === "string") {
						setCode(params.code);
						updateLineNumbers(params.code);
						s.animating = false;
						setAnimating(false);
						requestRender(params.code);
						result = { ok: true };
					} else {
						result = { error: "missing params.code" };
					}
					break;

				case "set_parameters": {
					const src = codeRef.current?.value ?? "";
					let updated = src;
					if (params?.center_x != null) updated = updated.replace(/CENTER_X[^=]*=\s*[\-0-9.]+/, `CENTER_X: float = ${params.center_x}`);
					if (params?.center_y != null) updated = updated.replace(/CENTER_Y[^=]*=\s*[\-0-9.]+/, `CENTER_Y: float = ${params.center_y}`);
					if (params?.max_iter != null) updated = updated.replace(/MAX_ITER[^=]*=\s*\d+/, `MAX_ITER: int = ${params.max_iter}`);
					if (params?.zoom != null) s.zoom = Number(params.zoom);
					setCode(updated);
					updateLineNumbers(updated);
					requestRender(updated);
					result = { ok: true, zoom: s.zoom };
					break;
				}

				case "get_state":
					result = { zoom: s.zoom, frame: s.frame, animating: s.animating, width: s.W, height: s.H };
					break;

				case "pause":
					s.animating = false;
					setAnimating(false);
					result = { ok: true };
					break;

				case "resume":
					s.animating = true;
					setAnimating(true);
					requestAnimationFrame(animate);
					result = { ok: true };
					break;

				case "reset":
					s.zoom = 1.0;
					s.frame = 0;
					requestRender();
					result = { ok: true };
					break;

				case "snapshot":
					result = { image: canvasRef.current?.toDataURL("image/png") };
					break;

				default:
					result = { error: `unknown tool: ${tool}` };
			}

			if (e.source && e.source !== window) {
				(e.source as Window).postMessage({ id: e.data.id, result }, { targetOrigin: "*" });
			}
		};

		window.addEventListener("message", handler);

		// Expose tools list for discovery
		// Expose tools list for MCP agent discovery
		(window as unknown as Record<string, unknown>).__molt_mcp_tools = [
			{ name: "get_code", description: "Get the current Python source code" },
			{ name: "set_code", description: "Replace the Python source code", params: { code: "string" } },
			{ name: "set_parameters", description: "Update render parameters", params: { center_x: "number?", center_y: "number?", zoom: "number?", max_iter: "number?" } },
			{ name: "get_state", description: "Get current animation state (zoom, frame, animating)" },
			{ name: "pause", description: "Pause the animation" },
			{ name: "resume", description: "Resume the animation" },
			{ name: "reset", description: "Reset zoom to 1.0" },
			{ name: "snapshot", description: "Capture the canvas as a base64 PNG image" },
		];

		return () => { window.removeEventListener("message", handler); };
	}, [animate, requestRender, updateLineNumbers]);

	const isEmbed = embedMode === "embed";
	const isStacked = embedMode === "stacked";

	return (
		<div className="molt-island">
			{!isEmbed && !isStacked && (
				<header>
					<span className="title"><a href="/work/dev/molt">Molt</a> — Mandelbrot</span>
					<span className="note">Python → Wasm → Canvas</span>
				</header>
			)}

			<div className="demo-layout">
				<div className="pane">
					<div className="canvas-wrap" id="canvas-wrap" ref={wrapRef}>
						<canvas
							id="canvas"
							ref={canvasRef}
							onClick={handleCanvasClick}
							role="img"
							aria-label="Mandelbrot fractal animation — click to pause"
						/>
					</div>
				</div>

				{!isEmbed && (
					<div className="pane pane-left">
						<div className="pane-header">
							<span>mandelbrot.py</span>
							<div style={{ display: "flex", gap: "0.3rem" }}>
								<button className="btn primary" id="compile-btn" disabled title="Molt compilation coming soon">
									Compile & Run
								</button>
							</div>
						</div>
						<div className="code-wrap">
							<div className="line-numbers" ref={lineNumRef}>{lineNumbers}</div>
							<textarea
								id="code"
								ref={codeRef}
								spellCheck={false}
								value={code}
								onChange={handleCodeChange}
								onScroll={handleCodeScroll}
							/>
						</div>
					</div>
				)}
			</div>

			{!isEmbed && !isStacked && (
				<div className="status">
					<span id="status-text">{status}</span>
					<span id="status-meta">{meta}</span>
				</div>
			)}
		</div>
	);
}

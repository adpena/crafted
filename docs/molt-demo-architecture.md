# Molt Live Demo Architecture

## Concept

A split-pane demo on the Molt detail page:
- Left: editable Python code (Mandelbrot renderer)
- Right: live canvas animation showing the output

User edits parameters in the code → hits compile → Cloudflare Worker running Molt-as-Wasm compiles the Python → returns new .wasm → browser loads and executes it → canvas updates in real-time.

## Why this is impressive

- The compiler itself runs as Wasm on Cloudflare's free tier
- No interpreter, no cold start, no backend server
- Python → native-speed Wasm binary in seconds, at the edge
- The animation runs at 60fps from a compiled binary, not an interpreter
- Pyodide/PyScript cannot do this — they ship a 15MB+ interpreter

## Architecture

```
Browser                             Cloudflare Worker (free tier)
├── Monaco/textarea (Python code)
├── Canvas (Mandelbrot output)      ├── Molt compiler (Wasm)
│                                   │
├── POST /compile ──────────────────→ molt build input.py
├── Receive .wasm ←─────────────────┤   --target wasm
│                                   │   --wasm-profile pure
├── loadMoltWasm(compiled.wasm)     │   --output output.wasm
├── Call mandelbrot(params)         │
├── Read RGBA from Wasm memory      
├── putImageData on canvas          
└── requestAnimationFrame loop      
```

## Components to build

1. **Compile Worker** — Cloudflare Worker running Molt compiled to Wasm
   - Accepts Python source via POST
   - Returns compiled .wasm binary
   - Cached: same source → same binary (content-hash)
   
2. **Canvas bridge** (~50 lines JS)
   - Reads RGBA pixel data from Wasm linear memory
   - Blits to canvas via putImageData
   - requestAnimationFrame loop for animation

3. **Mandelbrot Python program**
   - Parameterized: center_x, center_y, zoom, max_iterations, width, height
   - Writes RGBA bytes to a known memory offset
   - Adapted from existing bench/luau/bench_mandelbrot.py

4. **Split pane React island**
   - Left: code editor (textarea or lightweight editor)
   - Right: canvas
   - "Compile" button with loading state
   - Uses the existing ResizablePanel component

## Pre-compiled default

The default Mandelbrot is pre-compiled and bundled as a static .wasm file.
First load is instant — no compilation needed. Editing triggers recompilation.

## Molt repo integration

- The compile worker lives in the Molt repo (examples/compile-service/)
- The browser host (wasm/browser_host.js) already exists
- The VFS (wasm/molt_vfs_browser.js) already exists
- Deploy: `molt build --target wasm --wasm-profile pure`

/**
 * MCP-compatible HTTP endpoint for the Molt demo.
 *
 * Exposes the demo's tools as a JSON-RPC-style API that AI agents
 * can call directly via HTTP without needing a browser.
 *
 * GET  /api/mcp/demo          → list available tools
 * POST /api/mcp/demo          → call a tool ({ tool, params })
 *
 * For browser-side control, use postMessage on the demo iframe instead.
 */

// Future(mcp-protocol): Upgrade to full MCP Streamable HTTP transport.
//   Current implementation is a simplified JSON-RPC-style API.
//   When emdash supports plugin-provided MCP tools, register these
//   through the plugin system instead of a standalone endpoint.
//
// Future(molt-compile): Add compile_and_run tool that accepts arbitrary
//   Python, compiles via Molt Worker, runs the result, returns output.
//
// Future(monty-interpret): Add interpret tool that runs Python via Monty
//   Wasm in the browser (intermediate step before Molt compilation).

import type { APIRoute } from "astro";
import { parseRpcRequest, rpcResult, rpcError, RPC_PARSE_ERROR, RPC_INVALID_REQUEST, RPC_METHOD_NOT_FOUND } from "../../../lib/jsonrpc.ts";

const TOOLS = [
  { name: "get_code", description: "Get the current Python source code" },
  { name: "set_code", description: "Replace the Python source code", params: { code: "string" } },
  { name: "set_parameters", description: "Update Mandelbrot render parameters", params: { center_x: "number?", center_y: "number?", zoom: "number?", max_iter: "number?" } },
  { name: "get_state", description: "Get current animation state" },
  { name: "pause", description: "Pause the animation" },
  { name: "resume", description: "Resume the animation" },
  { name: "reset", description: "Reset zoom to 1.0" },
  { name: "snapshot", description: "Capture the canvas as a base64 PNG image" },
];

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    name: "molt-demo",
    description: "Mandelbrot fractal renderer — Python compiled to WebAssembly",
    tools: TOOLS,
    transport: "http",
    browser_url: "/demo/molt",
    note: "This endpoint lists available tools. For browser-side control, use postMessage on the /demo/molt iframe. Server-side tool execution requires the demo page to be open in a browser.",
  }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  // Server-side tool calls are limited — the rendering happens in the browser.
  // Accepts both JSON-RPC 2.0 and legacy { tool, params } formats.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, RPC_PARSE_ERROR, "Request body must be valid JSON.", 400);
  }

  const req = parseRpcRequest(body);
  if (!req) {
    return rpcError(null, RPC_INVALID_REQUEST, "Expected JSON-RPC 2.0 { jsonrpc, method, params, id } or legacy { tool, params }", 400);
  }

  const { method: tool, id } = req;

  switch (tool) {
    case "get_code": {
      // Return the default Mandelbrot source inline (can't self-fetch on Workers)
      const code = `# Mandelbrot set renderer — compiled by Molt to WebAssembly
WIDTH: int = 640
HEIGHT: int = 400
MAX_ITER: int = 100
CENTER_X: float = -0.7453
CENTER_Y: float = 0.1127
ZOOM: float = 1.0

def render() -> None:
    scale: float = 3.0 / (ZOOM * WIDTH)
    y: int = 0
    while y < HEIGHT:
        x: int = 0
        while x < WIDTH:
            cr: float = CENTER_X + (x - WIDTH / 2) * scale
            ci: float = CENTER_Y + (y - HEIGHT / 2) * scale
            zr: float = 0.0
            zi: float = 0.0
            i: int = 0
            while i < MAX_ITER:
                tr: float = zr * zr - zi * zi + cr
                zi = 2.0 * zr * zi + ci
                zr = tr
                if zr * zr + zi * zi > 4.0:
                    break
                i = i + 1
            print(i)
            x = x + 1
        y = y + 1

def main() -> None:
    render()

main()`;
      return rpcResult(id, { code });
    }

    case "get_state":
      return rpcResult(id, {
        note: "State is browser-side. Use postMessage on the iframe for live state.",
        default_center_x: -0.7453,
        default_center_y: 0.1127,
        default_max_iter: 100,
      });

    default: {
      const safeName = String(tool).slice(0, 64);
      return rpcError(id, RPC_METHOD_NOT_FOUND, `Tool '${safeName}' requires browser execution. Use postMessage on the /demo/molt iframe.`);
    }
  }
};

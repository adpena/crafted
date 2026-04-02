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

import type { APIRoute } from "astro";

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
  // This endpoint can serve static tools (get default code, list params).
  const body = await request.json() as { tool: string; params?: Record<string, unknown> };

  switch (body.tool) {
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
      return new Response(JSON.stringify({ data: { code } }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    case "get_state":
      return new Response(JSON.stringify({
        data: {
          note: "State is browser-side. Use postMessage on the iframe for live state.",
          default_center_x: -0.7453,
          default_center_y: 0.1127,
          default_max_iter: 100,
        },
      }), {
        headers: { "Content-Type": "application/json" },
      });

    default:
      return new Response(JSON.stringify({
        error: {
          code: "BROWSER_ONLY",
          message: `Tool '${body.tool}' requires browser execution. Use postMessage({ tool: '${body.tool}', params: ... }) on the /demo/molt iframe.`,
        },
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
  }
};

/**
 * JSON-RPC 2.0 helpers for MCP endpoints.
 *
 * Accepts both JSON-RPC 2.0 format ({ jsonrpc: "2.0", method, params, id })
 * and legacy format ({ tool, params }) for backward compatibility.
 * Always responds in JSON-RPC 2.0 format.
 */

export interface JsonRpcRequest {
	method: string;
	params: Record<string, unknown>;
	id: string | number | null;
}

export interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

/**
 * Parse a request body as JSON-RPC 2.0 or legacy { tool, params } format.
 * Returns the normalized request or null if invalid.
 */
export function parseRpcRequest(body: unknown): JsonRpcRequest | null {
	if (typeof body !== "object" || body === null) return null;
	const b = body as Record<string, unknown>;

	// JSON-RPC 2.0 format
	if (b.jsonrpc === "2.0" && typeof b.method === "string") {
		return {
			method: b.method,
			params: (typeof b.params === "object" && b.params !== null ? b.params : {}) as Record<string, unknown>,
			id: typeof b.id === "string" || typeof b.id === "number" ? b.id : null,
		};
	}

	// Legacy format: { tool, params }
	if (typeof b.tool === "string") {
		return {
			method: b.tool,
			params: (typeof b.params === "object" && b.params !== null ? b.params : {}) as Record<string, unknown>,
			id: typeof b.id === "string" || typeof b.id === "number" ? b.id : null,
		};
	}

	return null;
}

/** Build a JSON-RPC 2.0 success response */
export function rpcResult(id: string | number | null, result: unknown): Response {
	const body: JsonRpcResponse = { jsonrpc: "2.0", id, result };
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

/** Build a JSON-RPC 2.0 error response */
export function rpcError(
	id: string | number | null,
	code: number,
	message: string,
	status = 200,
	data?: unknown,
): Response {
	const body: JsonRpcResponse = {
		jsonrpc: "2.0",
		id,
		error: { code, message, ...(data ? { data } : {}) },
	};
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** Standard JSON-RPC 2.0 error codes */
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

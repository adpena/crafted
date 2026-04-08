import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getToken as readToken, setToken as writeToken } from "./token.ts";

/**
 * Webhook inbox viewer.
 *
 * GET /api/admin/webhook-inbox?source=&limit=50&offset=0
 * Renders paginated entries with a click-to-expand JSON payload view.
 */

interface InboxEntry {
	id: string;
	source: string;
	payload: string;
	ip_hash: string | null;
	user_agent: string | null;
	timestamp: string;
}

interface InboxResponse {
	data: InboxEntry[];
	pagination: {
		total: number;
		limit: number;
		offset: number;
		has_more: boolean;
	};
}

const PAGE_SIZE = 50;

export function WebhookInboxViewer() {
	const [token, setToken] = useState(readToken());
	const [tokenInput, setTokenInput] = useState("");
	const [sourceFilter, setSourceFilter] = useState("");
	const [offset, setOffset] = useState(0);
	const [data, setData] = useState<InboxResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	useEffect(() => {
		if (!token) return;
		let cancelled = false;
		setLoading(true);
		setError("");
		const params = new URLSearchParams({
			limit: String(PAGE_SIZE),
			offset: String(offset),
		});
		if (sourceFilter) params.set("source", sourceFilter);
		fetch(`/api/admin/webhook-inbox?${params.toString()}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<InboxResponse>;
			})
			.then((json) => { if (!cancelled) setData(json); })
			.catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed"); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [token, sourceFilter, offset]);

	function saveToken() {
		writeToken(tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	function toggle(id: string) {
		setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Webhook Inbox</h1>
				<label htmlFor="wh-token" style={{ display: "block", color: "#6b7280", marginBottom: "0.5rem" }}>
					Admin token (stored locally)
				</label>
				<input
					id="wh-token"
					type="password"
					value={tokenInput}
					onChange={(e) => setTokenInput(e.target.value)}
					placeholder="MCP_ADMIN_TOKEN"
					style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem" }}
				/>
				<button type="button" onClick={saveToken} disabled={!tokenInput} style={primaryBtn(Boolean(tokenInput))}>
					Save Token
				</button>
			</div>
		);
	}

	const pagination = data?.pagination;

	return (
		<div style={{ padding: "2rem" }}>
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Webhook Inbox</h1>
			<p style={{ color: "#6b7280", margin: "0 0 1rem", fontSize: "0.9rem" }}>
				Incoming webhook payloads, newest first.
			</p>

			<div style={{ marginBottom: "1rem", maxWidth: "320px" }}>
				<label htmlFor="wh-source" style={labelStyle}>Source filter</label>
				<input
					id="wh-source"
					type="text"
					value={sourceFilter}
					onChange={(e) => { setSourceFilter(e.target.value); setOffset(0); }}
					placeholder="e.g. stripe"
					style={{ ...inputStyle, width: "100%" }}
				/>
			</div>

			{loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
			{error && <p role="alert" aria-live="polite" style={{ color: "#dc2626" }}>{error}</p>}
			{!loading && !error && data && data.data.length === 0 && (
				<p style={{ color: "#6b7280" }}>No webhook entries.</p>
			)}

			{data && data.data.length > 0 && (
				<>
					<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
						{data.data.map((entry) => {
							const isOpen = Boolean(expanded[entry.id]);
							return (
								<div key={entry.id} style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", background: "#fff" }}>
									<button
										type="button"
										onClick={() => toggle(entry.id)}
										aria-expanded={isOpen}
										style={{
											width: "100%",
											textAlign: "left",
											padding: "0.75rem 1rem",
											background: "transparent",
											border: "none",
											cursor: "pointer",
											display: "flex",
											flexWrap: "wrap",
											justifyContent: "space-between",
											alignItems: "center",
											gap: "0.5rem",
											minHeight: "44px",
										}}
									>
										<div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
											<span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>
												<code>{entry.source || "(unknown)"}</code>
											</span>
											<span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
												{new Date(entry.timestamp).toLocaleString()}
											</span>
										</div>
										<span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{isOpen ? "▾" : "▸"}</span>
									</button>
									{isOpen && (
										<div style={{ padding: "0 1rem 0.875rem" }}>
											<pre
												style={{
													margin: 0,
													background: "#111827",
													color: "#e5e7eb",
													padding: "0.75rem",
													borderRadius: "0.375rem",
													fontSize: "0.75rem",
													overflow: "auto",
													maxHeight: "360px",
													fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
												}}
											>
												{prettyJson(entry.payload)}
											</pre>
											{(entry.ip_hash || entry.user_agent) && (
												<div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#6b7280" }}>
													{entry.ip_hash && <span>ip_hash: <code>{entry.ip_hash}</code> · </span>}
													{entry.user_agent && <span>ua: {entry.user_agent}</span>}
												</div>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{pagination && (
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
							<span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
								{offset + 1}–{offset + data.data.length} of {pagination.total.toLocaleString()}
							</span>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								<button type="button" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} style={pageBtn(offset === 0)}>
									Previous
								</button>
								<button type="button" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={!pagination.has_more} style={pageBtn(!pagination.has_more)}>
									Next
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

function prettyJson(raw: string): string {
	try {
		return JSON.stringify(JSON.parse(raw), null, 2);
	} catch {
		return raw;
	}
}

const inputStyle: CSSProperties = {
	padding: "0.5rem 0.625rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.25rem",
	fontSize: "0.875rem",
	minHeight: "44px",
	boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
	display: "block",
	fontSize: "0.8rem",
	fontWeight: 600,
	color: "#374151",
	marginBottom: "0.35rem",
};

function primaryBtn(enabled: boolean): CSSProperties {
	return {
		minHeight: "44px",
		padding: "0.625rem 1.125rem",
		background: "#1f2937",
		color: "#fff",
		border: "none",
		borderRadius: "0.375rem",
		cursor: enabled ? "pointer" : "not-allowed",
		opacity: enabled ? 1 : 0.5,
		fontWeight: 600,
		fontSize: "0.875rem",
	};
}

function pageBtn(disabled: boolean): CSSProperties {
	return {
		minHeight: "44px",
		padding: "0.5rem 0.875rem",
		fontSize: "0.875rem",
		background: disabled ? "#f3f4f6" : "#fff",
		border: "1px solid #d1d5db",
		borderRadius: "0.25rem",
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.5 : 1,
	};
}

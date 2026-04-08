import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Audit log viewer.
 *
 * GET /api/admin/audit-log?action=&target=&actor=&limit=50&offset=0
 * Paginated list with expandable metadata JSON.
 */

interface AuditRow {
	id: string;
	action: string;
	target: string;
	actor: string;
	metadata: unknown;
	ip_hash: string | null;
	user_agent: string | null;
	timestamp: string;
}

interface AuditResponse {
	data: AuditRow[];
	pagination: {
		total: number;
		limit: number;
		offset: number;
		has_more: boolean;
	};
}

const PAGE_SIZE = 50;

function getToken(): string {
	if (typeof window === "undefined") return "";
	return localStorage.getItem("action_pages_admin_token") ?? "";
}

export function AuditLogViewer() {
	const [token, setToken] = useState(getToken());
	const [tokenInput, setTokenInput] = useState("");
	const [action, setAction] = useState("");
	const [target, setTarget] = useState("");
	const [actor, setActor] = useState("");
	const [offset, setOffset] = useState(0);
	const [data, setData] = useState<AuditResponse | null>(null);
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
		if (action) params.set("action", action);
		if (target) params.set("target", target);
		if (actor) params.set("actor", actor);
		fetch(`/api/admin/audit-log?${params.toString()}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<AuditResponse>;
			})
			.then((json) => { if (!cancelled) setData(json); })
			.catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed"); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [token, action, target, actor, offset]);

	function saveToken() {
		localStorage.setItem("action_pages_admin_token", tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	function toggle(id: string) {
		setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Audit Log</h1>
				<label htmlFor="al-token" style={{ display: "block", color: "#6b7280", marginBottom: "0.5rem" }}>
					Admin token (stored locally)
				</label>
				<input
					id="al-token"
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
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Audit Log</h1>
			<p style={{ color: "#6b7280", margin: "0 0 1rem", fontSize: "0.9rem" }}>
				Newest first. Use filters to narrow down by action, target, or actor.
			</p>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
					gap: "0.5rem",
					marginBottom: "1rem",
				}}
			>
				<div>
					<label htmlFor="al-action" style={labelStyle}>Action</label>
					<input id="al-action" type="text" value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} placeholder="e.g. brand_extract" style={{ ...inputStyle, width: "100%" }} />
				</div>
				<div>
					<label htmlFor="al-target" style={labelStyle}>Target (contains)</label>
					<input id="al-target" type="text" value={target} onChange={(e) => { setTarget(e.target.value); setOffset(0); }} placeholder="e.g. /page/slug" style={{ ...inputStyle, width: "100%" }} />
				</div>
				<div>
					<label htmlFor="al-actor" style={labelStyle}>Actor</label>
					<input id="al-actor" type="text" value={actor} onChange={(e) => { setActor(e.target.value); setOffset(0); }} placeholder="e.g. admin" style={{ ...inputStyle, width: "100%" }} />
				</div>
			</div>

			{loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
			{error && <p role="alert" aria-live="polite" style={{ color: "#dc2626" }}>{error}</p>}
			{!loading && !error && data && data.data.length === 0 && (
				<p style={{ color: "#6b7280" }}>No audit entries match.</p>
			)}

			{data && data.data.length > 0 && (
				<>
					<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
						{data.data.map((row) => {
							const isOpen = Boolean(expanded[row.id]);
							return (
								<div key={row.id} style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", background: "#fff" }}>
									<button
										type="button"
										onClick={() => toggle(row.id)}
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
										<div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", minWidth: 0, flex: 1 }}>
											<div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
												{new Date(row.timestamp).toLocaleString()}
											</div>
											<div style={{ fontSize: "0.875rem", color: "#111827", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
												<strong>{row.actor || "—"}</strong>
												<code style={{ background: "#f3f4f6", padding: "0.05rem 0.375rem", borderRadius: "0.25rem" }}>
													{row.action}
												</code>
												<span style={{ color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis" }}>{row.target}</span>
											</div>
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
													maxHeight: "320px",
													fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
												}}
											>
												{JSON.stringify(row.metadata, null, 2)}
											</pre>
											{(row.ip_hash || row.user_agent) && (
												<div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#6b7280" }}>
													{row.ip_hash && <span>ip_hash: <code>{row.ip_hash}</code> · </span>}
													{row.user_agent && <span>ua: {row.user_agent}</span>}
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

import { useEffect, useState } from "react";

/**
 * Admin submissions viewer.
 *
 * Calls /api/action/list (Bearer authenticated) and renders a paginated,
 * filterable, searchable table of submissions for a given page slug.
 *
 * Authentication: requires the user's MCP_ADMIN_TOKEN to be available in
 * localStorage as "action_pages_admin_token". The Notifications admin page
 * already provides a flow to capture this.
 */

interface Submission {
	id: string;
	type: string;
	first_name?: string;
	last_name?: string;
	email?: string;
	zip?: string;
	comment?: string;
	amount?: number;
	visitor_id: string | null;
	variant: string;
	country: string | null;
	created_at: string;
}

interface ListResponse {
	data: Submission[];
	pagination: {
		total: number;
		total_all: number;
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

export function SubmissionsViewer() {
	const [slug, setSlug] = useState("");
	const [search, setSearch] = useState("");
	const [variant, setVariant] = useState("");
	const [offset, setOffset] = useState(0);
	const [data, setData] = useState<ListResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [token, setToken] = useState(getToken());
	const [tokenInput, setTokenInput] = useState("");

	useEffect(() => {
		if (!slug || !token) return;

		let cancelled = false;
		setLoading(true);
		setError("");

		const params = new URLSearchParams({
			slug,
			limit: String(PAGE_SIZE),
			offset: String(offset),
		});
		if (search) params.set("q", search);
		if (variant) params.set("variant", variant);

		fetch(`/api/action/list?${params.toString()}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<ListResponse>;
			})
			.then((json) => {
				if (!cancelled) setData(json);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => { cancelled = true; };
	}, [slug, search, variant, offset, token]);

	function saveToken() {
		localStorage.setItem("action_pages_admin_token", tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	function handleExport() {
		if (!slug || !token) return;
		const url = `/api/action/export?slug=${encodeURIComponent(slug)}&format=csv`;
		// Create a temporary anchor with the auth header — fetch + blob approach
		fetch(url, { headers: { Authorization: `Bearer ${token}` } })
			.then(async (res) => {
				if (!res.ok) throw new Error(`Export failed: ${res.status}`);
				const blob = await res.blob();
				const objUrl = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = objUrl;
				a.download = `${slug}-submissions.csv`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(objUrl);
			})
			.catch((err) => setError(err instanceof Error ? err.message : "Export failed"));
	}

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
					Submissions
				</h1>
				<p style={{ color: "#6b7280", marginBottom: "1rem" }}>
					Enter your admin token to view submissions. This token is stored in your browser only.
				</p>
				<input
					type="password"
					value={tokenInput}
					onChange={(e) => setTokenInput(e.target.value)}
					placeholder="MCP_ADMIN_TOKEN"
					style={{
						width: "100%",
						padding: "0.5rem",
						border: "1px solid #d1d5db",
						borderRadius: "0.25rem",
						marginBottom: "0.5rem",
						fontFamily: "monospace",
					}}
				/>
				<button
					type="button"
					onClick={saveToken}
					disabled={!tokenInput}
					style={{
						padding: "0.5rem 1rem",
						background: "#1f2937",
						color: "#fff",
						border: "none",
						borderRadius: "0.25rem",
						cursor: tokenInput ? "pointer" : "not-allowed",
						opacity: tokenInput ? 1 : 0.5,
					}}
				>
					Save Token
				</button>
			</div>
		);
	}

	const pagination = data?.pagination;

	return (
		<div style={{ padding: "2rem" }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Submissions</h1>
				<button
					type="button"
					onClick={() => { localStorage.removeItem("action_pages_admin_token"); setToken(""); }}
					style={{
						padding: "0.25rem 0.75rem",
						fontSize: "0.75rem",
						background: "transparent",
						border: "1px solid #d1d5db",
						borderRadius: "0.25rem",
						cursor: "pointer",
					}}
				>
					Forget token
				</button>
			</div>

			{/* Filters */}
			<div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: "0.75rem", marginBottom: "1rem" }}>
				<input
					type="text"
					placeholder="Page slug (e.g. fund-public-schools)"
					value={slug}
					onChange={(e) => { setSlug(e.target.value); setOffset(0); }}
					style={inputStyle}
				/>
				<input
					type="text"
					placeholder="Search email, name, zip..."
					value={search}
					onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
					style={inputStyle}
				/>
				<input
					type="text"
					placeholder="Variant"
					value={variant}
					onChange={(e) => { setVariant(e.target.value); setOffset(0); }}
					style={inputStyle}
				/>
				<button
					type="button"
					onClick={handleExport}
					disabled={!slug}
					style={{
						padding: "0.5rem 1rem",
						background: "#1f2937",
						color: "#fff",
						border: "none",
						borderRadius: "0.25rem",
						cursor: slug ? "pointer" : "not-allowed",
						opacity: slug ? 1 : 0.5,
						whiteSpace: "nowrap",
					}}
				>
					Export CSV
				</button>
			</div>

			{loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
			{error && <p style={{ color: "#dc2626" }}>{error}</p>}
			{!loading && !error && data && data.data.length === 0 && (
				<p style={{ color: "#6b7280" }}>No submissions found.</p>
			)}

			{data && data.data.length > 0 && (
				<>
					<div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "0.5rem" }}>
						<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
							<thead style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								<tr>
									<th style={th}>Date</th>
									<th style={th}>Type</th>
									<th style={th}>Name</th>
									<th style={th}>Email</th>
									<th style={th}>Zip</th>
									<th style={th}>Variant</th>
									<th style={th}>Country</th>
								</tr>
							</thead>
							<tbody>
								{data.data.map((row) => (
									<tr key={row.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
										<td style={td}>{new Date(row.created_at).toLocaleString()}</td>
										<td style={td}>{row.type}</td>
										<td style={td}>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}</td>
										<td style={{ ...td, fontFamily: "monospace", fontSize: "0.8rem" }}>{row.email ?? "—"}</td>
										<td style={td}>{row.zip ?? "—"}</td>
										<td style={td}><code>{row.variant}</code></td>
										<td style={td}>{row.country ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{pagination && (
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
							<span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
								{offset + 1}–{offset + data.data.length} of {pagination.total.toLocaleString()}
							</span>
							<div style={{ display: "flex", gap: "0.5rem" }}>
								<button
									type="button"
									onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
									disabled={offset === 0}
									style={pageBtn(offset === 0)}
								>
									Previous
								</button>
								<button
									type="button"
									onClick={() => setOffset(offset + PAGE_SIZE)}
									disabled={!pagination.has_more}
									style={pageBtn(!pagination.has_more)}
								>
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

const inputStyle: React.CSSProperties = {
	padding: "0.5rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.25rem",
	fontSize: "0.875rem",
};

const th: React.CSSProperties = {
	padding: "0.5rem 0.75rem",
	textAlign: "left",
	fontWeight: 600,
	color: "#374151",
	textTransform: "uppercase",
	fontSize: "0.75rem",
	letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
	padding: "0.5rem 0.75rem",
	color: "#1f2937",
};

function pageBtn(disabled: boolean): React.CSSProperties {
	return {
		padding: "0.375rem 0.75rem",
		fontSize: "0.875rem",
		background: disabled ? "#f3f4f6" : "#fff",
		border: "1px solid #d1d5db",
		borderRadius: "0.25rem",
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.5 : 1,
	};
}

import { useState } from "react";
import type { CSSProperties } from "react";

/**
 * AI-powered Action Page generator UI.
 *
 * POST /api/admin/generate-page
 *   Body: { description, brandUrl?, preferredAction? }
 *   Returns an ActionPageConfig (untyped here to avoid deep coupling).
 *
 * The "Use this page" button fires `onApply(config)` so a parent (PageBuilder)
 * can hydrate its form from the generated result.
 */

const MIN_DESC = 20;
const MAX_DESC = 2000;

const ACTION_OPTIONS = [
	{ value: "", label: "— No preference —" },
	{ value: "petition", label: "Petition" },
	{ value: "fundraise", label: "Fundraise" },
	{ value: "signup", label: "Email signup" },
	{ value: "event", label: "Event RSVP" },
	{ value: "gotv", label: "Get out the vote" },
	{ value: "letter", label: "Letter to rep" },
	{ value: "call", label: "Click to call" },
	{ value: "step", label: "Multi-step form" },
];

export interface AIPageGeneratorProps {
	onApply?: (config: Record<string, unknown>) => void;
	endpoint?: string;
}

function getToken(): string {
	if (typeof window === "undefined") return "";
	return localStorage.getItem("action_pages_admin_token") ?? "";
}

export function AIPageGenerator({ onApply, endpoint = "/api/admin/generate-page" }: AIPageGeneratorProps) {
	const [token, setToken] = useState(getToken());
	const [tokenInput, setTokenInput] = useState("");

	// Tab: "describe" (free text) or "legislation" (bill URL)
	const [tab, setTab] = useState<"describe" | "legislation">("describe");

	const [description, setDescription] = useState("");
	const [brandUrl, setBrandUrl] = useState("");
	const [preferredAction, setPreferredAction] = useState("");

	// Legislation tab state
	const [billInput, setBillInput] = useState("");
	const [billAction, setBillAction] = useState<"letter" | "call">("letter");

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<Record<string, unknown> | null>(null);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");
	const [createSuccess, setCreateSuccess] = useState("");

	function saveToken() {
		localStorage.setItem("action_pages_admin_token", tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	const descLen = description.trim().length;
	const descValid = descLen >= MIN_DESC && descLen <= MAX_DESC;
	const brandUrlValid = !brandUrl || brandUrl.startsWith("https://");
	const canSubmit = tab === "describe"
		? descValid && brandUrlValid && !loading
		: billInput.trim().length > 0 && !loading;

	async function handleGenerate(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		setLoading(true);
		setError("");
		setResult(null);
		try {
			if (tab === "legislation") {
				const res = await fetch("/api/admin/bill-to-page", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ bill: billInput.trim(), action: billAction }),
				});
				const json = (await res.json()) as Record<string, unknown>;
				if (!res.ok) {
					throw new Error((json.error as string) ?? `HTTP ${res.status}`);
				}
				setResult(json);
			} else {
				const body: Record<string, unknown> = { description: description.trim() };
				if (brandUrl) body.brandUrl = brandUrl;
				if (preferredAction) body.preferredAction = preferredAction;

				const res = await fetch(endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify(body),
				});
				const json = (await res.json()) as Record<string, unknown>;
				if (!res.ok) {
					throw new Error((json.error as string) ?? `HTTP ${res.status}`);
				}
				setResult(json);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Generation failed");
		} finally {
			setLoading(false);
		}
	}

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>AI Page Generator</h1>
				<label htmlFor="ai-token" style={{ display: "block", color: "#6b7280", marginBottom: "0.5rem" }}>
					Admin token (stored locally)
				</label>
				<input
					id="ai-token"
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

	return (
		<div style={{ padding: "2rem", maxWidth: "780px" }}>
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>AI Page Generator</h1>
			<p style={{ color: "#6b7280", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
				Generate a complete action page from a description or legislation.
			</p>

			{/* Tab switcher */}
			<div style={{ display: "flex", gap: "0", marginBottom: "1.25rem", borderBottom: "1px solid #d1d5db" }}>
				<button
					type="button"
					onClick={() => { setTab("legislation"); setError(""); setResult(null); }}
					style={{
						...tabBtnStyle,
						borderBottom: tab === "legislation" ? "2px solid #1f2937" : "2px solid transparent",
						color: tab === "legislation" ? "#1f2937" : "#6b7280",
						fontWeight: tab === "legislation" ? 600 : 400,
					}}
				>
					From legislation
				</button>
				<button
					type="button"
					onClick={() => { setTab("describe"); setError(""); setResult(null); }}
					style={{
						...tabBtnStyle,
						borderBottom: tab === "describe" ? "2px solid #1f2937" : "2px solid transparent",
						color: tab === "describe" ? "#1f2937" : "#6b7280",
						fontWeight: tab === "describe" ? 600 : 400,
					}}
				>
					From description
				</button>
			</div>

			<form onSubmit={handleGenerate} noValidate>
				{tab === "legislation" ? (
					<>
						<div style={{ marginBottom: "1rem" }}>
							<label htmlFor="ai-bill" style={labelStyle}>
								Bill URL or reference <span style={{ color: "#dc2626" }}>*</span>
							</label>
							<input
								id="ai-bill"
								type="text"
								value={billInput}
								onChange={(e) => setBillInput(e.target.value)}
								placeholder="e.g. https://www.congress.gov/bill/118th-congress/house-bill/4532 or HR 4532"
								style={{ ...inputStyle, width: "100%" }}
							/>
							<div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
								Congress.gov URL, or short form: HR 4532, S 1234, HJRES 123
							</div>
						</div>
						<div style={{ marginBottom: "1rem" }}>
							<label style={labelStyle}>Action type</label>
							<div style={{ display: "flex", gap: "1rem" }}>
								<label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", cursor: "pointer" }}>
									<input type="radio" name="bill-action" value="letter" checked={billAction === "letter"} onChange={() => setBillAction("letter")} />
									Letter to rep
								</label>
								<label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", cursor: "pointer" }}>
									<input type="radio" name="bill-action" value="call" checked={billAction === "call"} onChange={() => setBillAction("call")} />
									Call your rep
								</label>
							</div>
						</div>
					</>
				) : (
					<>
						<div style={{ marginBottom: "1rem" }}>
							<label htmlFor="ai-description" style={labelStyle}>
								Campaign description <span style={{ color: "#dc2626" }}>*</span>
							</label>
							<textarea
								id="ai-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="e.g. We're running a petition to save the local library from budget cuts. Our audience is parents and students in Travis County…"
								rows={6}
								required
								minLength={MIN_DESC}
								maxLength={MAX_DESC}
								style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit" }}
							/>
							<div
								style={{
									fontSize: "0.75rem",
									color: descLen === 0 || descValid ? "#6b7280" : "#dc2626",
									marginTop: "0.25rem",
								}}
							>
								{descLen}/{MAX_DESC} characters (minimum {MIN_DESC})
							</div>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1rem" }}>
							<div>
								<label htmlFor="ai-brand-url" style={labelStyle}>
									Brand URL (optional)
								</label>
								<input
									id="ai-brand-url"
									type="url"
									value={brandUrl}
									onChange={(e) => setBrandUrl(e.target.value)}
									placeholder="https://example.org"
									style={{ ...inputStyle, width: "100%" }}
								/>
								{!brandUrlValid && (
									<div role="alert" style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>
										Must start with https://
									</div>
								)}
							</div>
							<div>
								<label htmlFor="ai-preferred-action" style={labelStyle}>
									Preferred action (optional)
								</label>
								<select
									id="ai-preferred-action"
									value={preferredAction}
									onChange={(e) => setPreferredAction(e.target.value)}
									style={{ ...inputStyle, width: "100%", minHeight: "44px" }}
								>
									{ACTION_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
							</div>
						</div>
					</>
				)}

				<button type="submit" disabled={!canSubmit} style={primaryBtn(canSubmit)}>
					{loading ? "Generating…" : tab === "legislation" ? "Generate from bill" : "Generate page"}
				</button>
			</form>

			{error && (
				<div
					role="alert"
					aria-live="polite"
					style={{
						marginTop: "1rem",
						padding: "0.75rem 1rem",
						background: "#fef2f2",
						color: "#991b1b",
						border: "1px solid #fecaca",
						borderRadius: "0.375rem",
					}}
				>
					{error}
				</div>
			)}

			{result && (
				<div
					style={{
						marginTop: "1.5rem",
						padding: "1rem",
						border: "1px solid #d1d5db",
						borderRadius: "0.5rem",
						background: "#f9fafb",
					}}
				>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
						<h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Generated page</h2>
						<div style={{ display: "flex", gap: "0.5rem" }}>
							{onApply && (
								<button type="button" onClick={() => onApply(result)} style={{ ...primaryBtn(true), background: "#fff", color: "#374151", border: "1px solid #d1d5db" }}>
									Edit in PageBuilder
								</button>
							)}
							<button
								type="button"
								disabled={creating}
								onClick={async () => {
									setCreating(true);
									setCreateError("");
									try {
										const res = await fetch("/api/mcp/actions", {
											method: "POST",
											headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
											body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "create_page", params: result }),
										});
										const json = await res.json() as Record<string, unknown>;
										const data = json.result as Record<string, unknown> | undefined;
										if (data?.data && (data.data as Record<string, unknown>)?.ok) {
											const url = (data.data as Record<string, unknown>).url as string;
											setCreateSuccess(url);
										} else {
											const err = json.error as Record<string, unknown> | undefined;
											setCreateError(err?.message as string ?? "Creation failed");
										}
									} catch (err) {
										setCreateError(err instanceof Error ? err.message : "Creation failed");
									} finally {
										setCreating(false);
									}
								}}
								style={primaryBtn(!creating)}
							>
								{creating ? "Creating…" : "Create & publish"}
							</button>
						</div>
					</div>
					{createError && (
						<div role="alert" style={{ padding: "0.5rem 0.75rem", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "0.25rem", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
							{createError}
						</div>
					)}
					{createSuccess && (
						<div style={{ padding: "0.5rem 0.75rem", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: "0.25rem", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
							Page created! <a href={createSuccess} target="_blank" rel="noopener noreferrer" style={{ color: "#065f46", fontWeight: 600 }}>{createSuccess}</a>
						</div>
					)}
					<pre
						style={{
							margin: 0,
							maxHeight: "420px",
							overflow: "auto",
							background: "#111827",
							color: "#e5e7eb",
							padding: "0.875rem",
							borderRadius: "0.375rem",
							fontSize: "0.75rem",
							lineHeight: 1.5,
							fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						}}
					>
						{JSON.stringify(result, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}

const tabBtnStyle: CSSProperties = {
	background: "none",
	border: "none",
	padding: "0.5rem 1rem",
	fontSize: "0.85rem",
	cursor: "pointer",
	marginBottom: "-1px",
};

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

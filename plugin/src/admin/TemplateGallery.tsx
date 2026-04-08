import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getToken as readToken, setToken as writeToken } from "./token.ts";

/**
 * Template gallery — grid of pre-built action page templates.
 *
 * GET /api/admin/templates — returns a library of PageTemplate objects.
 * Clicking a card fires `onSelect(template.config)` so a parent (PageBuilder)
 * can clone the config as a starting point.
 */

export interface PageTemplate {
	id: string;
	name: string;
	description: string;
	category: string;
	preview_image?: string;
	config: Record<string, unknown>;
}

interface TemplatesResponse {
	data: PageTemplate[];
	total: number;
	categories: string[];
}

export interface TemplateGalleryProps {
	/** Called when user clicks "Use this template" on a card. */
	onSelect?: (config: Record<string, unknown>, template: PageTemplate) => void;
	/** Override fetch URL (for tests). */
	fetchUrl?: string;
}

export function TemplateGallery({ onSelect, fetchUrl = "/api/admin/templates" }: TemplateGalleryProps) {
	const [token, setToken] = useState(readToken());
	const [tokenInput, setTokenInput] = useState("");
	const [data, setData] = useState<TemplatesResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [category, setCategory] = useState<string>("");

	useEffect(() => {
		if (!token) return;
		let cancelled = false;
		setLoading(true);
		setError("");
		const url = category ? `${fetchUrl}?category=${encodeURIComponent(category)}` : fetchUrl;
		fetch(url, { headers: { Authorization: `Bearer ${token}` } })
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<TemplatesResponse>;
			})
			.then((json) => { if (!cancelled) setData(json); })
			.catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load templates"); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [token, category, fetchUrl]);

	function saveToken() {
		writeToken(tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	if (!token) {
		return <TokenGate title="Template Gallery" tokenInput={tokenInput} setTokenInput={setTokenInput} onSave={saveToken} />;
	}

	return (
		<div style={{ padding: "2rem" }}>
			<header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
				<div>
					<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Template Gallery</h1>
					<p style={{ color: "#6b7280", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
						Pre-built action pages to clone as a starting point.
					</p>
				</div>
				{data && data.categories.length > 0 && (
					<div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
						<CategoryChip active={!category} onClick={() => setCategory("")} label="All" />
						{data.categories.map((c) => (
							<CategoryChip key={c} active={category === c} onClick={() => setCategory(c)} label={c} />
						))}
					</div>
				)}
			</header>

			{loading && <p style={{ color: "#6b7280" }}>Loading templates…</p>}
			{error && <p role="alert" aria-live="polite" style={{ color: "#dc2626" }}>{error}</p>}
			{!loading && !error && data && data.data.length === 0 && (
				<p style={{ color: "#6b7280" }}>No templates in this category.</p>
			)}

			{data && data.data.length > 0 && (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
						gap: "1rem",
					}}
				>
					{data.data.map((tpl) => (
						<article
							key={tpl.id}
							style={{
								border: "1px solid #e5e7eb",
								borderRadius: "0.5rem",
								overflow: "hidden",
								background: "#fff",
								display: "flex",
								flexDirection: "column",
							}}
						>
							<div
								style={{
									aspectRatio: "16/9",
									background: tpl.preview_image
										? `#f3f4f6 url(${tpl.preview_image}) center/cover no-repeat`
										: "linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)",
									display: "flex",
									alignItems: "flex-start",
									justifyContent: "flex-start",
									padding: "0.5rem",
								}}
							>
								<span
									style={{
										fontSize: "0.7rem",
										fontWeight: 600,
										padding: "0.2rem 0.5rem",
										background: "rgba(17, 24, 39, 0.75)",
										color: "#fff",
										borderRadius: "9999px",
										textTransform: "uppercase",
										letterSpacing: "0.04em",
									}}
								>
									{tpl.category}
								</span>
							</div>
							<div style={{ padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
								<h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{tpl.name}</h3>
								<p style={{ margin: 0, fontSize: "0.8rem", color: "#4b5563", lineHeight: 1.4, flex: 1 }}>{tpl.description}</p>
								<button
									type="button"
									onClick={() => onSelect?.(tpl.config, tpl)}
									style={{
										marginTop: "0.5rem",
										minHeight: "44px",
										padding: "0.5rem 0.875rem",
										background: "#1f2937",
										color: "#fff",
										border: "none",
										borderRadius: "0.375rem",
										cursor: "pointer",
										fontWeight: 600,
										fontSize: "0.875rem",
									}}
								>
									Use this template
								</button>
							</div>
						</article>
					))}
				</div>
			)}
		</div>
	);
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				minHeight: "36px",
				padding: "0.35rem 0.75rem",
				background: active ? "#1f2937" : "#fff",
				color: active ? "#fff" : "#374151",
				border: "1px solid #d1d5db",
				borderRadius: "9999px",
				cursor: "pointer",
				fontSize: "0.8rem",
				fontWeight: 500,
				textTransform: "capitalize",
			}}
		>
			{label}
		</button>
	);
}

function TokenGate({
	title,
	tokenInput,
	setTokenInput,
	onSave,
}: {
	title: string;
	tokenInput: string;
	setTokenInput: (v: string) => void;
	onSave: () => void;
}) {
	return (
		<div style={{ padding: "2rem", maxWidth: "600px" }}>
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>{title}</h1>
			<p style={{ color: "#6b7280", marginBottom: "1rem" }}>
				Enter your admin token to continue. Stored in your browser only.
			</p>
			<label htmlFor="tg-token" style={{ display: "none" }}>Admin token</label>
			<input
				id="tg-token"
				type="password"
				value={tokenInput}
				onChange={(e) => setTokenInput(e.target.value)}
				placeholder="MCP_ADMIN_TOKEN"
				style={{
					width: "100%",
					minHeight: "44px",
					padding: "0.5rem",
					border: "1px solid #d1d5db",
					borderRadius: "0.25rem",
					marginBottom: "0.5rem",
					fontFamily: "monospace",
				}}
			/>
			<button
				type="button"
				onClick={onSave}
				disabled={!tokenInput}
				style={saveBtn(Boolean(tokenInput))}
			>
				Save Token
			</button>
		</div>
	);
}

function saveBtn(enabled: boolean): CSSProperties {
	return {
		minHeight: "44px",
		padding: "0.5rem 1rem",
		background: "#1f2937",
		color: "#fff",
		border: "none",
		borderRadius: "0.25rem",
		cursor: enabled ? "pointer" : "not-allowed",
		opacity: enabled ? 1 : 0.5,
	};
}

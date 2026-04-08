import { useState } from "react";
import type { CSSProperties } from "react";
import { getToken as readToken, setToken as writeToken } from "./token.ts";

/**
 * Brand extractor — pull a BrandKit from a URL and render 4 theme variants.
 *
 * POST /api/admin/brand-extract  { url } -> { brand, variants }
 *
 * Clicking a variant calls `onSelect(variant, brand)`.
 */

export interface BrandColor {
	hex: string;
	role?: string;
}

export interface BrandKit {
	source_url: string;
	name?: string;
	logo_url?: string | null;
	colors?: Array<BrandColor | string>;
	fonts?: string[];
	[key: string]: unknown;
}

export interface BrandThemeVariant {
	id: string;
	name: string;
	description?: string;
	theme?: Record<string, unknown>;
	preview?: {
		background?: string;
		surface?: string;
		text?: string;
		accent?: string;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

interface ExtractResponse {
	brand: BrandKit;
	variants: BrandThemeVariant[];
}

export interface BrandExtractorProps {
	onSelect?: (variant: BrandThemeVariant, brand: BrandKit) => void;
	endpoint?: string;
}

export function BrandExtractor({ onSelect, endpoint = "/api/admin/brand-extract" }: BrandExtractorProps) {
	const [token, setToken] = useState(readToken());
	const [tokenInput, setTokenInput] = useState("");
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [data, setData] = useState<ExtractResponse | null>(null);

	function saveToken() {
		writeToken(tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	async function handleExtract(e: React.FormEvent) {
		e.preventDefault();
		if (!url || !url.startsWith("https://")) {
			setError("URL must start with https://");
			return;
		}
		setLoading(true);
		setError("");
		setData(null);
		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ url }),
			});
			const json = (await res.json()) as Record<string, unknown>;
			if (!res.ok) throw new Error((json.error as string) ?? `HTTP ${res.status}`);
			setData(json as unknown as ExtractResponse);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Extraction failed");
		} finally {
			setLoading(false);
		}
	}

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Brand Extractor</h1>
				<label htmlFor="be-token" style={{ display: "block", color: "#6b7280", marginBottom: "0.5rem" }}>
					Admin token (stored locally)
				</label>
				<input
					id="be-token"
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

	const colors = normalizeColors(data?.brand.colors);

	return (
		<div style={{ padding: "2rem", maxWidth: "960px" }}>
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Brand Extractor</h1>
			<p style={{ color: "#6b7280", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
				Paste a URL — we&apos;ll pull colors, fonts, and logo, and propose 4 themes.
			</p>

			<form onSubmit={handleExtract} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
				<label htmlFor="be-url" style={{ display: "none" }}>Brand URL</label>
				<input
					id="be-url"
					type="url"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://example.org"
					required
					style={{ ...inputStyle, flex: "1 1 260px" }}
				/>
				<button type="submit" disabled={!url || loading} style={primaryBtn(Boolean(url) && !loading)}>
					{loading ? "Extracting…" : "Extract brand"}
				</button>
			</form>

			{error && (
				<div role="alert" aria-live="polite" style={errorBoxStyle}>
					{error}
				</div>
			)}

			{data && (
				<>
					<section style={{ marginBottom: "1.5rem" }}>
						<h2 style={sectionHeading}>Brand kit</h2>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
								gap: "0.75rem",
								padding: "1rem",
								border: "1px solid #e5e7eb",
								borderRadius: "0.5rem",
								background: "#fff",
							}}
						>
							<KV k="Source" v={data.brand.source_url} mono />
							{data.brand.name && <KV k="Name" v={data.brand.name} />}
							{data.brand.logo_url && (
								<div>
									<div style={kvKey}>Logo</div>
									<img
										src={data.brand.logo_url}
										alt="Brand logo"
										style={{ maxHeight: "48px", maxWidth: "100%", background: "#f3f4f6", padding: "0.25rem", borderRadius: "0.25rem" }}
									/>
								</div>
							)}
							{data.brand.fonts && data.brand.fonts.length > 0 && (
								<KV k="Fonts" v={data.brand.fonts.join(", ")} />
							)}
							{colors.length > 0 && (
								<div style={{ gridColumn: "1 / -1" }}>
									<div style={kvKey}>Colors</div>
									<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
										{colors.map((c, i) => (
											<div key={`${c.hex}-${i}`} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
												<span
													style={{
														width: "22px",
														height: "22px",
														borderRadius: "4px",
														background: c.hex,
														border: "1px solid #e5e7eb",
														display: "inline-block",
													}}
												/>
												<code style={{ fontSize: "0.75rem", color: "#374151" }}>{c.hex}</code>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</section>

					<section>
						<h2 style={sectionHeading}>Theme variants</h2>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
								gap: "0.75rem",
							}}
						>
							{data.variants.map((variant) => {
								const preview = variant.preview ?? {};
								const bg = (preview.background as string) || "#ffffff";
								const surface = (preview.surface as string) || "#f3f4f6";
								const text = (preview.text as string) || "#111827";
								const accent = (preview.accent as string) || "#1f2937";
								return (
									<button
										key={variant.id}
										type="button"
										onClick={() => onSelect?.(variant, data.brand)}
										style={{
											textAlign: "left",
											padding: 0,
											border: "1px solid #e5e7eb",
											borderRadius: "0.5rem",
											background: "#fff",
											cursor: "pointer",
											overflow: "hidden",
											display: "flex",
											flexDirection: "column",
											minHeight: "180px",
										}}
									>
										<div
											style={{
												background: bg,
												color: text,
												padding: "0.875rem",
												display: "flex",
												flexDirection: "column",
												gap: "0.5rem",
												flex: 1,
											}}
										>
											<div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{variant.name}</div>
											<div
												style={{
													background: surface,
													borderRadius: "0.25rem",
													padding: "0.375rem 0.5rem",
													fontSize: "0.7rem",
													color: text,
												}}
											>
												Surface example
											</div>
											<span
												style={{
													display: "inline-block",
													background: accent,
													color: "#fff",
													padding: "0.25rem 0.625rem",
													borderRadius: "9999px",
													fontSize: "0.7rem",
													fontWeight: 600,
													alignSelf: "flex-start",
												}}
											>
												Accent
											</span>
										</div>
										{variant.description && (
											<div style={{ padding: "0.5rem 0.875rem", fontSize: "0.75rem", color: "#6b7280", borderTop: "1px solid #f3f4f6" }}>
												{variant.description}
											</div>
										)}
									</button>
								);
							})}
						</div>
					</section>
				</>
			)}
		</div>
	);
}

function normalizeColors(raw: BrandKit["colors"]): BrandColor[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((c): BrandColor | null => {
			if (typeof c === "string") return { hex: c };
			if (c && typeof c === "object" && typeof c.hex === "string") return c;
			return null;
		})
		.filter((c): c is BrandColor => c !== null);
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
	return (
		<div>
			<div style={kvKey}>{k}</div>
			<div style={{ fontSize: "0.85rem", color: "#111827", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>
				{v}
			</div>
		</div>
	);
}

const kvKey: CSSProperties = {
	fontSize: "0.7rem",
	color: "#6b7280",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	marginBottom: "0.125rem",
};

const sectionHeading: CSSProperties = {
	fontSize: "0.8rem",
	fontWeight: 600,
	color: "#374151",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	margin: "0 0 0.5rem",
};

const inputStyle: CSSProperties = {
	padding: "0.5rem 0.625rem",
	border: "1px solid #d1d5db",
	borderRadius: "0.25rem",
	fontSize: "0.875rem",
	minHeight: "44px",
	boxSizing: "border-box",
};

const errorBoxStyle: CSSProperties = {
	marginBottom: "1rem",
	padding: "0.75rem 1rem",
	background: "#fef2f2",
	color: "#991b1b",
	border: "1px solid #fecaca",
	borderRadius: "0.375rem",
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

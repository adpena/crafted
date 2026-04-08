import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Live page preview iframe.
 *
 * Renders the current PageBuilder config in an iframe pointed at
 *   /action/preview?config={base64-encoded-config}
 *
 * Features:
 *   - Device-width toggle (desktop / tablet / mobile)
 *   - Reload button
 *   - Loading spinner while iframe loads
 *   - Error state if config is too large (32 KB limit)
 *   - "Open in new tab" button
 *   - Placeholder when no config is available yet
 */

/** Max base64-encoded config size (matches preview.astro MAX_CONFIG_BYTES) */
const MAX_CONFIG_BYTES = 32_768;

export interface LivePagePreviewConfig {
	slug?: string;
	[key: string]: unknown;
}

export interface LivePagePreviewProps {
	config: LivePagePreviewConfig | null;
	/** Override the preview base path. Defaults to "/action". */
	basePath?: string;
	/** Override the default initial device. */
	initialDevice?: DeviceId;
}

type DeviceId = "desktop" | "tablet" | "mobile";

const DEVICES: Record<DeviceId, { label: string; width: number | "100%"; height: number }> = {
	desktop: { label: "Desktop", width: "100%", height: 720 },
	tablet: { label: "Tablet", width: 768, height: 1024 },
	mobile: { label: "Mobile", width: 390, height: 780 },
};

function encodeConfig(config: LivePagePreviewConfig): string {
	try {
		const json = JSON.stringify(config);
		if (typeof window === "undefined") {
			return Buffer.from(json, "utf-8").toString("base64");
		}
		// Browser-safe base64 for UTF-8
		const bytes = new TextEncoder().encode(json);
		let bin = "";
		for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
		return btoa(bin);
	} catch {
		return "";
	}
}

const toolbarBtnStyle = (active = false): CSSProperties => ({
	minHeight: "36px",
	padding: "0.35rem 0.75rem",
	background: active ? "#1f2937" : "#fff",
	color: active ? "#fff" : "#374151",
	border: "1px solid #d1d5db",
	borderRadius: "0.375rem",
	cursor: "pointer",
	fontSize: "0.8rem",
	fontWeight: 500,
});

export function LivePagePreview({ config, basePath = "/action", initialDevice = "desktop" }: LivePagePreviewProps) {
	const [device, setDevice] = useState<DeviceId>(initialDevice);
	const [reloadKey, setReloadKey] = useState(0);
	const [loading, setLoading] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const slug = (config && typeof config.slug === "string" && config.slug) || "preview";

	const { previewUrl, encodedSize, tooLarge } = useMemo(() => {
		if (!config) return { previewUrl: null, encodedSize: 0, tooLarge: false };
		const encoded = encodeConfig(config);
		const size = encoded.length;
		if (size > MAX_CONFIG_BYTES) {
			return { previewUrl: null, encodedSize: size, tooLarge: true };
		}
		const params = new URLSearchParams({ preview: "1" });
		if (encoded) params.set("config", encoded);
		return {
			previewUrl: `${basePath}/preview?${params.toString()}`,
			encodedSize: size,
			tooLarge: false,
		};
	}, [config, basePath]);

	const handleIframeLoad = useCallback(() => {
		setLoading(false);
	}, []);

	const handleOpenNewTab = useCallback(() => {
		if (previewUrl && typeof window !== "undefined") {
			window.open(previewUrl, "_blank");
		}
	}, [previewUrl]);

	const d = DEVICES[device];

	// No config yet — placeholder
	if (!config) {
		return (
			<div style={{ padding: "1rem", background: "#f3f4f6", borderRadius: "0.5rem" }}>
				<div style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "400px",
					background: "#fff",
					borderRadius: "0.375rem",
					border: "1px dashed #d1d5db",
					color: "#9ca3af",
					fontFamily: "'SF Mono', 'Fira Code', monospace",
					fontSize: "0.85rem",
					textAlign: "center",
					padding: "2rem",
				}}>
					Preview will appear here once you<br />select a template and action.
				</div>
			</div>
		);
	}

	// Config too large
	if (tooLarge) {
		return (
			<div style={{ padding: "1rem", background: "#f3f4f6", borderRadius: "0.5rem" }}>
				<div style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "200px",
					background: "#fef2f2",
					borderRadius: "0.375rem",
					border: "1px solid #fecaca",
					color: "#991b1b",
					fontFamily: "'SF Mono', 'Fira Code', monospace",
					fontSize: "0.85rem",
					textAlign: "center",
					padding: "2rem",
					gap: "0.5rem",
				}}>
					<strong>Preview config too large</strong>
					<span>{Math.round(encodedSize / 1024)}KB / {Math.round(MAX_CONFIG_BYTES / 1024)}KB max</span>
					<span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
						Reduce content length or remove large fields to enable preview.
					</span>
				</div>
			</div>
		);
	}

	return (
		<div style={{ padding: "1rem", background: "#f3f4f6", borderRadius: "0.5rem" }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "0.75rem",
					gap: "0.5rem",
					flexWrap: "wrap",
				}}
			>
				<div style={{ display: "flex", gap: "0.25rem" }} role="radiogroup" aria-label="Preview device">
					{(Object.keys(DEVICES) as DeviceId[]).map((id) => (
						<button
							key={id}
							type="button"
							role="radio"
							aria-checked={device === id}
							onClick={() => {
								setDevice(id);
								setLoading(true);
							}}
							style={toolbarBtnStyle(device === id)}
						>
							{DEVICES[id].label}
						</button>
					))}
				</div>
				<div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
					<code style={{ fontSize: "0.7rem", color: "#6b7280" }}>{slug}</code>
					<button
						type="button"
						onClick={() => {
							setReloadKey((k) => k + 1);
							setLoading(true);
						}}
						aria-label="Reload preview"
						style={toolbarBtnStyle()}
					>
						&#8635; Reload
					</button>
					<button
						type="button"
						onClick={handleOpenNewTab}
						aria-label="Open preview in new tab"
						title="Open full preview in new tab"
						style={toolbarBtnStyle()}
					>
						&#8599; Full
					</button>
				</div>
			</div>

			<div
				style={{
					position: "relative",
					display: "flex",
					justifyContent: "center",
					background: "#fff",
					borderRadius: "0.375rem",
					border: "1px solid #e5e7eb",
					padding: device === "desktop" ? 0 : "1rem",
					overflow: "auto",
				}}
			>
				{loading && (
					<div style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						background: "rgba(255,255,255,0.8)",
						zIndex: 2,
						borderRadius: "0.375rem",
						fontFamily: "'SF Mono', 'Fira Code', monospace",
						fontSize: "0.8rem",
						color: "#6b7280",
					}}>
						Loading preview...
					</div>
				)}
				<iframe
					ref={iframeRef}
					key={`${reloadKey}-${previewUrl}`}
					src={previewUrl ?? "about:blank"}
					title={`Preview: ${slug}`}
					onLoad={handleIframeLoad}
					style={{
						width: d.width,
						height: d.height,
						border: device === "desktop" ? "none" : "1px solid #e5e7eb",
						borderRadius: device === "desktop" ? "0.375rem" : "0.25rem",
						background: "#fff",
						display: "block",
					} satisfies CSSProperties}
					// Intentionally omit `allow-same-origin` — combining it with
					// `allow-scripts` allows the framed page to remove its own
					// sandbox attribute via parent.document.querySelector(...).
					// This is the documented sandbox escape. Preview is visual-
					// only; form submission is disabled in the preview route.
					sandbox="allow-scripts"
				/>
			</div>
		</div>
	);
}

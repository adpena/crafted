import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Live page preview iframe.
 *
 * Renders the current PageBuilder config in an iframe pointed at
 *   /action/{slug}?preview=1&config={base64-encoded-config}
 *
 * The backend preview route is TBD — this component only handles the
 * client-side scaffolding: building the URL, the iframe, a device-width
 * toggle (desktop / tablet / mobile), and a reload button.
 */

export interface LivePagePreviewConfig {
	slug?: string;
	[key: string]: unknown;
}

export interface LivePagePreviewProps {
	config: LivePagePreviewConfig;
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

export function LivePagePreview({ config, basePath = "/action", initialDevice = "desktop" }: LivePagePreviewProps) {
	const [device, setDevice] = useState<DeviceId>(initialDevice);
	const [reloadKey, setReloadKey] = useState(0);

	const slug = (typeof config.slug === "string" && config.slug) || "draft";
	const previewUrl = useMemo(() => {
		const encoded = encodeConfig(config);
		const params = new URLSearchParams({ preview: "1" });
		if (encoded) params.set("config", encoded);
		return `${basePath}/${encodeURIComponent(slug)}?${params.toString()}`;
	}, [config, basePath, slug]);

	const d = DEVICES[device];

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
							onClick={() => setDevice(id)}
							style={{
								minHeight: "36px",
								padding: "0.35rem 0.75rem",
								background: device === id ? "#1f2937" : "#fff",
								color: device === id ? "#fff" : "#374151",
								border: "1px solid #d1d5db",
								borderRadius: "0.375rem",
								cursor: "pointer",
								fontSize: "0.8rem",
								fontWeight: 500,
							}}
						>
							{DEVICES[id].label}
						</button>
					))}
				</div>
				<div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
					<code style={{ fontSize: "0.7rem", color: "#6b7280" }}>{slug}</code>
					<button
						type="button"
						onClick={() => setReloadKey((k) => k + 1)}
						aria-label="Reload preview"
						style={{
							minHeight: "36px",
							padding: "0.35rem 0.75rem",
							background: "#fff",
							color: "#374151",
							border: "1px solid #d1d5db",
							borderRadius: "0.375rem",
							cursor: "pointer",
							fontSize: "0.8rem",
							fontWeight: 500,
						}}
					>
						↻ Reload
					</button>
				</div>
			</div>

			<div
				style={{
					display: "flex",
					justifyContent: "center",
					background: "#fff",
					borderRadius: "0.375rem",
					border: "1px solid #e5e7eb",
					padding: device === "desktop" ? 0 : "1rem",
					overflow: "auto",
				}}
			>
				<iframe
					key={reloadKey}
					src={previewUrl}
					title={`Preview: ${slug}`}
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

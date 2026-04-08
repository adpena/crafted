import { useEffect, useState } from "react";
import { getToken } from "./token.ts";

/**
 * Action page stats dashboard widget.
 *
 * Calls /api/action/stats (Bearer authenticated) to show:
 * - Total submissions for a slug
 * - Per-variant counts and percentages
 * - Two-variant statistical significance (basic z-test)
 */

interface StatsResponse {
	slug: string;
	total: number;
	by_variant: Record<string, { count: number; percentage: number }>;
	by_country: Record<string, number>;
	by_day: Record<string, number>;
	significance?: {
		variant_a: string;
		variant_b: string;
		p_value: number;
		winner: string | null;
	};
}

export function StatsWidget() {
	const [slug, setSlug] = useState("");
	const [data, setData] = useState<StatsResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const token = getToken();
		if (!slug || !token) return;

		let cancelled = false;
		setLoading(true);
		setError("");

		fetch(`/api/action/stats?slug=${encodeURIComponent(slug)}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<StatsResponse>;
			})
			.then((json) => { if (!cancelled) setData(json); })
			.catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed"); })
			.finally(() => { if (!cancelled) setLoading(false); });

		return () => { cancelled = true; };
	}, [slug]);

	const variants = data ? Object.entries(data.by_variant).sort((a, b) => b[1].count - a[1].count) : [];
	const topCountries = data ? Object.entries(data.by_country).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];

	return (
		<div style={{ padding: "1rem" }}>
			<h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>
				Action Page Stats
			</h3>

			<input
				type="text"
				placeholder="Page slug…"
				value={slug}
				onChange={(e) => setSlug(e.target.value)}
				style={{
					width: "100%",
					padding: "0.5rem",
					border: "1px solid #d1d5db",
					borderRadius: "0.25rem",
					fontSize: "0.875rem",
					marginBottom: "0.75rem",
				}}
			/>

			{loading && <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>Loading…</p>}
			{error && <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: 0 }}>{error}</p>}

			{data && (
				<div>
					<div style={{ marginBottom: "1rem" }}>
						<div style={{ fontSize: "2rem", fontWeight: 700, color: "#1f2937", lineHeight: 1 }}>
							{data.total.toLocaleString()}
						</div>
						<div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
							Total submissions
						</div>
					</div>

					{variants.length > 0 && (
						<div style={{ marginBottom: "1rem" }}>
							<div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
								By variant
							</div>
							{variants.map(([name, stats]) => (
								<div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", borderBottom: "1px solid #f3f4f6", fontSize: "0.875rem" }}>
									<code style={{ fontSize: "0.8rem" }}>{name}</code>
									<span>
										<strong>{stats.count.toLocaleString()}</strong>
										<span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>{stats.percentage}%</span>
									</span>
								</div>
							))}
						</div>
					)}

					{data.significance && (
						<div style={{
							padding: "0.75rem",
							background: data.significance.winner ? "#ecfdf5" : "#f9fafb",
							border: `1px solid ${data.significance.winner ? "#a7f3d0" : "#e5e7eb"}`,
							borderRadius: "0.375rem",
							marginBottom: "1rem",
							fontSize: "0.875rem",
						}}>
							<div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
								{data.significance.winner
									? `Winner: ${data.significance.winner}`
									: "No significant difference"}
							</div>
							<div style={{ color: "#6b7280", fontSize: "0.75rem" }}>
								p = {data.significance.p_value} {data.significance.winner ? "(p < 0.05)" : "(needs more data)"}
							</div>
						</div>
					)}

					{topCountries.length > 0 && (
						<div>
							<div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
								Top countries
							</div>
							{topCountries.map(([country, count]) => (
								<div key={country} style={{ display: "flex", justifyContent: "space-between", padding: "0.125rem 0", fontSize: "0.875rem" }}>
									<span>{country}</span>
									<span style={{ color: "#6b7280" }}>{count.toLocaleString()}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

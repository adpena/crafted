import { useState } from "react";

type District = {
	id: string; name: string; teacher?: number | null; beginning?: number | null; support?: number | null;
	ssra?: number | null; bonus?: number | null; ada?: number | null; paraFte?: number | null;
	revenue?: number | null; enrollment?: number | string | null; transfers?: string; loss?: number | null; sof?: string; paymentCycle?: string;
};
const money = (n: number | null | undefined) => n == null ? "Not reported" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const number = (n: number | null | undefined) => n == null ? "Not reported" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
const percent = (n: number | null | undefined) => n == null ? "Not reported" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

export default function DistrictResearch({ kind, rows, paths = [] }: { kind: "pay" | "hb2" | "charter"; rows: District[]; paths?: { id: string; d: string }[] }) {
	const [id, setId] = useState(rows.find((r) => r.name === "AUSTIN ISD")?.id ?? rows[0]!.id);
	const [comparison, setComparison] = useState(rows.find((r) => r.name === "HOUSTON ISD")?.id ?? rows[1]!.id);
	const [query, setQuery] = useState("");
	const row = rows.find((r) => r.id === id)!;
	const other = rows.find((r) => r.id === comparison)!;
	const filtered = rows.filter((r) => `${r.name} ${r.id}`.toLowerCase().includes(query.toLowerCase()));
	const byId = new Map(rows.map((r) => [r.id, r]));
	const title = kind === "pay" ? "Compare district pay history" : kind === "hb2" ? "Explore the SSRA comparison" : "From source inputs to an estimate";
	return <section className="artifact-panel">
		<p className="eyebrow">{kind === "pay" ? "2009–10 to 2020–21 · 2021 dollars" : kind === "hb2" ? "2025–26 estimates · published workbook" : "2023–24 · June 21, 2024 export"}</p>
		<h2>{title}</h2>
		{kind === "pay" && <p>This is the dataset behind the original Respect Campaign Map and 2022 Lost Decade research. Values show changes in average pay after inflation. The 2024 report is linked separately on the project page.</p>}
		{kind === "hb2" && <p>Compare projected Support Staff Retention Allotment funding and the portion attributed to TEA’s adjusted attendance calculation. These are funding estimates, not observed raises.</p>}
		{kind === "charter" && <p>Choose a district to inspect the reported funding, attendance, enrollment, and charter-transfer inputs alongside the published revenue estimate.</p>}
		<label>Find a district<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or district number" /></label>
		<label className="demo-select-label">District<select aria-label="District" value={id} onChange={(e) => setId(e.target.value)}>
			{!filtered.some((r) => r.id === id) && <option value={id}>{row.name} · {id}</option>}
			{filtered.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.id}</option>)}
		</select></label>
		<p className="source-note" role="status">{filtered.length} matching districts</p>
		{kind === "pay" && <>
			{paths.length > 0 && <svg viewBox="0 0 970 910" className="district-map" role="img" aria-label="Texas school districts, colored by change in inflation-adjusted teacher pay. Use the district selector for keyboard access.">
				{paths.map((path) => { const district = byId.get(path.id); const value = district?.teacher; return <path key={path.id} d={path.d} stroke={id === path.id ? "var(--color-text)" : "var(--color-bg)"} strokeWidth={id === path.id ? 2.5 : .35} fill={value == null ? "#aaa" : value < -10 ? "#a54930" : value < 0 ? "#dca879" : value < 10 ? "#80aaa2" : "#32665c"} onClick={() => setId(path.id)}><title>{`${district?.name}: ${percent(value)}`}</title></path>; })}
			</svg>}
			{paths.length > 0 && <p className="source-note">Map: rust indicates falling purchasing power; green indicates gains. Click a district or use the selector. Gray means no value was reported.</p>}
			<label>Compare with<select aria-label="Compare with" value={comparison} onChange={(e) => setComparison(e.target.value)}>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
			<div className="artifact-table-wrap"><table className="artifact-table"><caption>Change in average pay, adjusted for inflation</caption><thead><tr><th scope="col">Staff group</th><th scope="col">{row.name}</th><th scope="col">{other.name}</th></tr></thead><tbody>{([['Teachers', 'teacher'], ['Beginning teachers', 'beginning'], ['Support staff', 'support']] as const).map(([label, key]) => <tr key={key}><th scope="row">{label}</th><td>{percent(row[key])}</td><td>{percent(other[key])}</td></tr>)}</tbody></table></div>
			<p className="source-note">{rows.length.toLocaleString()} districts. This compares district averages, not the pay history of individual employees. Geometry is simplified for display; it is not a current boundary reference.</p>
		</>}
		{kind === "hb2" && <>
			<h3>{row.name}</h3>
			<dl className="artifact-metrics"><div><dt>Estimated SSRA</dt><dd>{money(row.ssra)}</dd></div><div><dt>From attendance adjustment</dt><dd>{money(row.bonus)}</dd></div><div><dt>Share from adjustment</dt><dd>{row.ssra && row.bonus != null ? `${(row.bonus / row.ssra * 100).toFixed(1)}%` : "Not reported"}</dd></div></dl>
			<div className="artifact-table-wrap"><table className="artifact-table"><tbody><tr><th scope="row">Sparsity-adjusted regular program attendance</th><td>{number(row.ada)}</td></tr><tr><th scope="row">Paraprofessional FTE used in this workbook</th><td>{number(row.paraFte)}</td></tr></tbody></table></div>
			<p className="source-note">The model assigns $45 per adjusted student in average daily attendance. Staffing categories and fallback years matter: this comparison workbook’s paraprofessional counts should not be substituted for the broader support-staff denominator in the published raise examples.</p>
		</>}
		{kind === "charter" && <>
			<h3>{row.name}</h3>
			<dl className="artifact-metrics"><div><dt>Estimated revenue effect</dt><dd>{money(row.loss)}</dd></div><div><dt>Charter transfers</dt><dd>{row.transfers || "Not reported"}</dd></div><div><dt>District enrollment</dt><dd>{typeof row.enrollment === "string" ? row.enrollment : number(row.enrollment)}</dd></div></dl>
			<div className="artifact-table-wrap"><table className="artifact-table"><tbody><tr><th scope="row">Estimated district revenue</th><td>{money(row.revenue)}</td></tr><tr><th scope="row">Refined average daily attendance</th><td>{number(row.ada)}</td></tr><tr><th scope="row">Summary of Finances</th><td>{row.sof}</td></tr></tbody></table></div>
			<p>The model estimates revenue associated with charter transfers using the district’s funding and attendance inputs. It does not measure recoverable savings or promise that every estimated dollar would return if a student transferred back.</p>
			<p className="source-note">Values are reproduced from the source export, including masked enrollment counts such as “&lt;10”. This one-year exhibit contains {rows.length.toLocaleString()} district rows; the full project covers 1,023 districts across five years.</p>
		</>}
	</section>;
}

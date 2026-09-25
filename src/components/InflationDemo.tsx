import { useState } from "react";

export default function InflationDemo({ periods }: { periods: { period: string; cpi: number }[] }) {
	const [amount, setAmount] = useState("1000");
	const [from, setFrom] = useState("2010-01");
	const [to, setTo] = useState(periods.at(-1)!.period);
	const start = periods.find((p) => p.period === from)!;
	const end = periods.find((p) => p.period === to)!;
	const value = Number(amount);
	const valid = amount.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 1e12;
	const adjusted = valid ? value * end.cpi / start.cpi : null;
	const format = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
	return <section className="artifact-panel"><p className="eyebrow">Historical calculator · data through {periods.at(-1)!.period}</p><h2>What would that amount buy?</h2><p>Choose two months to compare an amount using the Texas CPI series in the original calculator’s archived dataset.</p>
		<div className="demo-channel-grid"><label>Amount in dollars<input type="number" min="0" max="1000000000000" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>From<select aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)}>{periods.map((p) => <option key={p.period}>{p.period}</option>)}</select></label><label>To<select aria-label="To" value={to} onChange={(e) => setTo(e.target.value)}>{periods.map((p) => <option key={p.period}>{p.period}</option>)}</select></label></div>
		<div role="status" aria-live="polite">{adjusted != null ? <p className="inflation-result">{format(value)} in {from} ≈ <strong>{format(adjusted)}</strong> in {to}</p> : <p>Enter an amount between zero and one trillion dollars.</p>}</div>
		<p className="source-note">Calculation: amount × destination CPI ÷ starting CPI. CPI measures average price changes; it does not describe every household’s costs. The exhibit uses the original dated snapshot and is not a current inflation forecast.</p>
	</section>;
}

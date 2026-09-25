import { useState } from "react";
import { notifyAll, type NotifyResult } from "@adpena/notifications";

import { CHANNELS, mockAdapters, type Outcome } from "../lib/notification-demo";

export default function NotificationsDemo() {
	const [subject, setSubject] = useState("The report is ready");
	const [body, setBody] = useState("The district analysis is ready for review.");
	const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({ Email: "success", Slack: "success", Discord: "skip" });
	const [progress, setProgress] = useState<Record<string, string>>({});
	const [result, setResult] = useState<NotifyResult | null>(null);
	const [running, setRunning] = useState(false);
	const [elapsed, setElapsed] = useState(0);

	async function run() {
		if (running || !subject.trim() || !body.trim()) return;
		setRunning(true);
		setResult(null);
		setProgress({});
		const start = performance.now();
		const adapters = mockAdapters(outcomes, (name, state) => setProgress((current) => ({ ...current, [name]: state })));
		try {
			setResult(await notifyAll({}, { subject: subject.trim(), body: body.trim() }, adapters));
		} finally {
			setElapsed(performance.now() - start);
			setRunning(false);
		}
	}

	return <section className="artifact-panel" aria-label="Notifications demo">
		<p className="eyebrow">Interactive example</p>
		<h2>One message, three channels</h2>
		<p>This runs the library’s dispatcher with local mock adapters. No messages leave your browser. Change a channel’s outcome to see how the others continue.</p>
		<div className="demo-fields">
			<label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} disabled={running} /></label>
			<label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} disabled={running} rows={3} /></label>
		</div>
		<div className="demo-channel-grid">
			{CHANNELS.map((name) => <label key={name}>{name}
				<select aria-label={name} value={outcomes[name]} disabled={running} onChange={(event) => setOutcomes({ ...outcomes, [name]: event.target.value as Outcome })}>
					<option value="success">Deliver locally</option><option value="failure">Simulate failure</option><option value="timeout">Simulate timeout</option><option value="skip">Not configured</option>
				</select>
				<span className="demo-status">{progress[name] ?? (outcomes[name] === "skip" ? "Will be skipped" : "Ready")}</span>
			</label>)}
		</div>
		<button className="demo-button" disabled={running || !subject.trim() || !body.trim()} onClick={run}>{running ? "Running…" : "Run local dispatch"}</button>
		<div role="status" aria-live="polite">{result && <p>Finished in {(elapsed / 1000).toFixed(1)} seconds. {result.sent.length} simulated deliveries, {result.failed.length} failures, {result.skipped.length} skipped.</p>}</div>
		<details><summary>Inspect the message and result</summary>
			<pre>{JSON.stringify({ message: { subject, body }, result }, null, 2)}</pre>
		</details>
		<p className="source-note">Uses @adpena/notifications 0.1.0. Each configured adapter starts in parallel and has its own five-second timeout.</p>
	</section>;
}

import { useState } from "react";
import type { CSSProperties } from "react";
import { getToken as readToken, setToken as writeToken } from "./token.ts";

/**
 * Email blast composer.
 *
 * POST /api/admin/email/send
 *   dry_run=true -> { eligible: N }
 *   dry_run=false -> { sent, failed, skipped, errors }
 *
 * Flow:
 *   1. User fills subject + HTML body + optional tag filter
 *   2. "Preview recipients" calls with dry_run=true
 *   3. "Send" opens a confirm dialog with the eligible count
 */

const DEFAULT_BODY = `<!-- Merge fields: {{first_name}} {{last_name}} {{email}} -->
<p>Hi {{first_name}},</p>

<p>Write your update here.</p>

<p>Thanks,<br>The Team</p>

<p style="font-size:12px;color:#666">
  You can unsubscribe at any time via the link in the email footer.
</p>`;

export interface EmailBlastComposerProps {
	endpoint?: string;
}

interface DryRunResponse {
	dry_run: true;
	eligible: number;
}

interface SendResponse {
	sent: number;
	failed: number;
	skipped: number;
	errors: string[];
}

export function EmailBlastComposer({ endpoint = "/api/admin/email/send" }: EmailBlastComposerProps) {
	const [token, setToken] = useState(readToken());
	const [tokenInput, setTokenInput] = useState("");

	const [subject, setSubject] = useState("");
	const [html, setHtml] = useState(DEFAULT_BODY);
	const [tagFilter, setTagFilter] = useState("");

	const [eligible, setEligible] = useState<number | null>(null);
	const [previewing, setPreviewing] = useState(false);
	const [sending, setSending] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<SendResponse | null>(null);

	function saveToken() {
		writeToken(tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	function stripHtml(h: string): string {
		return h.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
	}

	async function postBlast(dryRun: boolean) {
		const body: Record<string, unknown> = {
			subject,
			html,
			text: stripHtml(html),
			dry_run: dryRun,
		};
		if (tagFilter) body.tag_filter = tagFilter;
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			body: JSON.stringify(body),
		});
		const json = (await res.json()) as Record<string, unknown>;
		if (!res.ok) throw new Error((json.error as string) ?? `HTTP ${res.status}`);
		return json;
	}

	async function handlePreview() {
		setError("");
		setPreviewing(true);
		setEligible(null);
		try {
			const json = (await postBlast(true)) as DryRunResponse;
			setEligible(json.eligible);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Preview failed");
		} finally {
			setPreviewing(false);
		}
	}

	async function handleSend() {
		setError("");
		setSending(true);
		setResult(null);
		try {
			const json = (await postBlast(false)) as SendResponse;
			setResult(json);
			setConfirmOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Send failed");
		} finally {
			setSending(false);
		}
	}

	const canPreview = Boolean(subject && html) && !previewing && !sending;
	const canSend = eligible !== null && eligible > 0 && !sending;

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Email Blast</h1>
				<label htmlFor="eb-token" style={{ display: "block", color: "#6b7280", marginBottom: "0.5rem" }}>
					Admin token (stored locally)
				</label>
				<input
					id="eb-token"
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
		<div style={{ padding: "2rem", maxWidth: "860px" }}>
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Email Blast</h1>
			<p style={{ color: "#6b7280", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
				Compose and send to contacts. Supports merge fields and optional tag filtering.
			</p>

			<div style={{ marginBottom: "1rem" }}>
				<label htmlFor="eb-subject" style={labelStyle}>Subject</label>
				<input
					id="eb-subject"
					type="text"
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
					placeholder="e.g. Big update from the campaign"
					maxLength={200}
					style={{ ...inputStyle, width: "100%" }}
				/>
			</div>

			<div style={{ marginBottom: "1rem" }}>
				<label htmlFor="eb-html" style={labelStyle}>
					HTML body <span style={{ color: "#6b7280", fontWeight: 400 }}>— use {"{{first_name}}"}, {"{{last_name}}"}, {"{{email}}"} as merge fields</span>
				</label>
				<textarea
					id="eb-html"
					value={html}
					onChange={(e) => setHtml(e.target.value)}
					rows={14}
					style={{
						...inputStyle,
						width: "100%",
						resize: "vertical",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: "0.8rem",
						minHeight: "260px",
					}}
				/>
			</div>

			<div style={{ marginBottom: "1rem", maxWidth: "320px" }}>
				<label htmlFor="eb-tag" style={labelStyle}>Tag filter (optional)</label>
				<input
					id="eb-tag"
					type="text"
					value={tagFilter}
					onChange={(e) => setTagFilter(e.target.value)}
					placeholder="e.g. donor"
					maxLength={50}
					style={{ ...inputStyle, width: "100%" }}
				/>
			</div>

			<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
				<button type="button" onClick={handlePreview} disabled={!canPreview} style={secondaryBtn(canPreview)}>
					{previewing ? "Checking…" : "Preview recipients"}
				</button>
				{eligible !== null && (
					<span style={{ fontSize: "0.875rem", color: "#374151" }}>
						<strong>{eligible.toLocaleString()}</strong> eligible recipient{eligible === 1 ? "" : "s"}
					</span>
				)}
				<button
					type="button"
					onClick={() => setConfirmOpen(true)}
					disabled={!canSend}
					style={{ ...primaryBtn(canSend), marginLeft: "auto" }}
				>
					Send blast
				</button>
			</div>

			{error && (
				<div role="alert" aria-live="polite" style={errorBoxStyle}>
					{error}
				</div>
			)}

			{result && (
				<div
					role="status"
					aria-live="polite"
					style={{
						marginTop: "1rem",
						padding: "0.875rem 1rem",
						background: "#ecfdf5",
						color: "#065f46",
						border: "1px solid #a7f3d0",
						borderRadius: "0.375rem",
					}}
				>
					<strong>Sent {result.sent.toLocaleString()}</strong> · failed {result.failed} · skipped {result.skipped}
					{result.errors.length > 0 && (
						<details style={{ marginTop: "0.5rem" }}>
							<summary style={{ cursor: "pointer", fontSize: "0.8rem" }}>Errors ({result.errors.length})</summary>
							<ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", fontSize: "0.75rem" }}>
								{result.errors.map((e, i) => (
									<li key={i}>{e}</li>
								))}
							</ul>
						</details>
					)}
				</div>
			)}

			{confirmOpen && (
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="eb-confirm-title"
					style={{
						position: "fixed",
						inset: 0,
						background: "rgba(17, 24, 39, 0.6)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 1000,
						padding: "1rem",
					}}
					onClick={(e) => {
						if (e.target === e.currentTarget) setConfirmOpen(false);
					}}
				>
					<div
						style={{
							background: "#fff",
							borderRadius: "0.5rem",
							padding: "1.5rem",
							maxWidth: "420px",
							width: "100%",
							boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
						}}
					>
						<h2 id="eb-confirm-title" style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 700 }}>
							Send to {eligible?.toLocaleString()} recipients?
						</h2>
						<p style={{ color: "#6b7280", fontSize: "0.875rem", margin: "0 0 1rem" }}>
							This action is immediate and cannot be undone.
						</p>
						<div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
							<button type="button" onClick={() => setConfirmOpen(false)} disabled={sending} style={secondaryBtn(!sending)}>
								Cancel
							</button>
							<button type="button" onClick={handleSend} disabled={sending} style={primaryBtn(!sending)}>
								{sending ? "Sending…" : "Yes, send now"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

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

const errorBoxStyle: CSSProperties = {
	marginTop: "1rem",
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

function secondaryBtn(enabled: boolean): CSSProperties {
	return {
		minHeight: "44px",
		padding: "0.625rem 1.125rem",
		background: "#fff",
		color: "#1f2937",
		border: "1px solid #d1d5db",
		borderRadius: "0.375rem",
		cursor: enabled ? "pointer" : "not-allowed",
		opacity: enabled ? 1 : 0.5,
		fontWeight: 600,
		fontSize: "0.875rem",
	};
}

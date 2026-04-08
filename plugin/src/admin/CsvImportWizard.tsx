import { useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";

/**
 * CSV import wizard — three steps:
 *   1. Drop/pick a CSV file (max 5 MB)
 *   2. Preview first 5 rows
 *   3. Confirm upload → POST multipart/form-data to /api/admin/contacts/import
 */

const MAX_SIZE = 5 * 1024 * 1024;

interface ImportResult {
	total_rows: number;
	imported: number;
	updated: number;
	skipped: number;
	errors: Array<{ row: number; error: string }>;
}

export interface CsvImportWizardProps {
	endpoint?: string;
}

type Step = "pick" | "preview" | "uploading" | "done";

function getToken(): string {
	if (typeof window === "undefined") return "";
	return localStorage.getItem("action_pages_admin_token") ?? "";
}

export function CsvImportWizard({ endpoint = "/api/admin/contacts/import" }: CsvImportWizardProps) {
	const [token, setToken] = useState(getToken());
	const [tokenInput, setTokenInput] = useState("");

	const [step, setStep] = useState<Step>("pick");
	const [file, setFile] = useState<File | null>(null);
	const [headers, setHeaders] = useState<string[]>([]);
	const [previewRows, setPreviewRows] = useState<string[][]>([]);
	const [totalRowsEst, setTotalRowsEst] = useState(0);
	const [error, setError] = useState("");
	const [dragging, setDragging] = useState(false);
	const [result, setResult] = useState<ImportResult | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	function saveToken() {
		localStorage.setItem("action_pages_admin_token", tokenInput);
		setToken(tokenInput);
		setTokenInput("");
	}

	function reset() {
		setStep("pick");
		setFile(null);
		setHeaders([]);
		setPreviewRows([]);
		setTotalRowsEst(0);
		setError("");
		setResult(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	async function handleFile(f: File) {
		setError("");
		if (!f.name.toLowerCase().endsWith(".csv")) {
			setError("File must be a .csv");
			return;
		}
		if (f.size > MAX_SIZE) {
			setError("File exceeds 5 MB limit");
			return;
		}
		setFile(f);
		try {
			const text = await f.text();
			const rows = parseCsvPreview(text, 6);
			if (rows.length === 0) {
				setError("CSV is empty");
				return;
			}
			const firstRow = rows[0] ?? [];
			setHeaders(firstRow.map((h) => h.trim()));
			setPreviewRows(rows.slice(1, 6));
			// Estimate data rows — count newlines but subtract header and
			// any embedded newlines inside quoted fields. This is still an
			// approximation; the authoritative parse happens server-side.
			const newlineCount = (text.match(/\n/g)?.length ?? 0);
			const quotedNewlines = (text.match(/"[^"]*\n[^"]*"/g)?.length ?? 0);
			const approx = Math.max(0, newlineCount - quotedNewlines - 1); // -1 for header
			setTotalRowsEst(approx);
			setStep("preview");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not read file");
		}
	}

	function onDrop(e: DragEvent<HTMLDivElement>) {
		e.preventDefault();
		setDragging(false);
		const f = e.dataTransfer.files?.[0];
		if (f) void handleFile(f);
	}

	async function handleUpload() {
		if (!file) return;
		setStep("uploading");
		setError("");
		try {
			const fd = new FormData();
			fd.append("file", file);
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: fd,
			});
			const json = (await res.json()) as Record<string, unknown>;
			if (!res.ok) throw new Error((json.error as string) ?? `HTTP ${res.status}`);
			setResult(json as unknown as ImportResult);
			setStep("done");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
			setStep("preview");
		}
	}

	if (!token) {
		return (
			<div style={{ padding: "2rem", maxWidth: "600px" }}>
				<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>CSV Import</h1>
				<label htmlFor="csv-token" style={{ display: "block", color: "#6b7280", marginBottom: "0.5rem" }}>
					Admin token (stored locally)
				</label>
				<input
					id="csv-token"
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
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>CSV Import</h1>
			<p style={{ color: "#6b7280", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
				Required header: <code>email</code>. Optional: <code>first_name</code>, <code>last_name</code>, <code>zip</code>, <code>tags</code>.
			</p>

			<StepBar step={step} />

			{error && <div role="alert" aria-live="polite" style={errorBoxStyle}>{error}</div>}

			{step === "pick" && (
				<div>
					<div
						onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
						onDragLeave={() => setDragging(false)}
						onDrop={onDrop}
						onClick={() => fileInputRef.current?.click()}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
						style={{
							border: `2px dashed ${dragging ? "#1f2937" : "#d1d5db"}`,
							background: dragging ? "#f9fafb" : "#fff",
							borderRadius: "0.5rem",
							padding: "3rem 1rem",
							textAlign: "center",
							cursor: "pointer",
							minHeight: "200px",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: "0.5rem",
						}}
					>
						<div style={{ fontSize: "2rem" }}>⬆</div>
						<div style={{ fontWeight: 600 }}>Drop a CSV file here</div>
						<div style={{ fontSize: "0.8rem", color: "#6b7280" }}>or click to browse (max 5 MB)</div>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept=".csv,text/csv"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) void handleFile(f);
						}}
						style={{ display: "none" }}
						aria-label="CSV file"
					/>
				</div>
			)}

			{step === "preview" && file && (
				<div>
					<div style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#374151" }}>
						<strong>{file.name}</strong> · {(file.size / 1024).toFixed(1)} KB · ~{totalRowsEst.toLocaleString()} rows
					</div>
					<div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "0.5rem", marginBottom: "1rem" }}>
						<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
							<thead style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								<tr>
									{headers.map((h, i) => (
										<th key={i} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{previewRows.map((row, r) => (
									<tr key={r} style={{ borderBottom: "1px solid #f3f4f6" }}>
										{headers.map((_, c) => (
											<td key={c} style={{ padding: "0.5rem 0.75rem", color: "#1f2937", whiteSpace: "nowrap" }}>
												{row[c] ?? ""}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div style={{ display: "flex", gap: "0.5rem" }}>
						<button type="button" onClick={reset} style={secondaryBtn(true)}>Choose different file</button>
						<button type="button" onClick={handleUpload} style={{ ...primaryBtn(true), marginLeft: "auto" }}>
							Import {file.name}
						</button>
					</div>
				</div>
			)}

			{step === "uploading" && (
				<div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
					<div style={{ fontSize: "1rem", fontWeight: 600 }}>Uploading…</div>
					<div style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>Don&apos;t close this tab.</div>
				</div>
			)}

			{step === "done" && result && (
				<div>
					<div
						role="status"
						aria-live="polite"
						style={{
							padding: "1rem",
							background: "#ecfdf5",
							color: "#065f46",
							border: "1px solid #a7f3d0",
							borderRadius: "0.5rem",
							marginBottom: "1rem",
						}}
					>
						<div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>Import complete</div>
						<div style={{ fontSize: "0.875rem" }}>
							{result.imported.toLocaleString()} imported · {result.updated.toLocaleString()} updated ·{" "}
							{result.skipped.toLocaleString()} skipped · {result.total_rows.toLocaleString()} total rows
						</div>
					</div>
					{result.errors.length > 0 && (
						<details style={{ marginBottom: "1rem" }}>
							<summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
								Errors ({result.errors.length})
							</summary>
							<ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem", fontSize: "0.8rem", color: "#991b1b" }}>
								{result.errors.map((e, i) => (
									<li key={i}>Row {e.row}: {e.error}</li>
								))}
							</ul>
						</details>
					)}
					<button type="button" onClick={reset} style={primaryBtn(true)}>Import another file</button>
				</div>
			)}
		</div>
	);
}

function StepBar({ step }: { step: Step }) {
	const steps: Array<{ id: Step; label: string }> = [
		{ id: "pick", label: "1. Choose file" },
		{ id: "preview", label: "2. Preview" },
		{ id: "done", label: "3. Confirm" },
	];
	const activeIdx = step === "uploading" ? 2 : steps.findIndex((s) => s.id === step);
	return (
		<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
			{steps.map((s, i) => (
				<div
					key={s.id}
					style={{
						flex: 1,
						padding: "0.5rem 0.75rem",
						borderRadius: "0.375rem",
						background: i <= activeIdx ? "#1f2937" : "#f3f4f6",
						color: i <= activeIdx ? "#fff" : "#6b7280",
						fontSize: "0.8rem",
						fontWeight: 600,
						textAlign: "center",
					}}
				>
					{s.label}
				</div>
			))}
		</div>
	);
}

/** Tiny CSV preview parser — just enough for the first N rows. */
function parseCsvPreview(input: string, maxRows: number): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;
	let i = 0;
	const len = input.length;
	if (len > 0 && input.charCodeAt(0) === 0xfeff) i = 1;

	while (i < len && rows.length < maxRows) {
		const ch = input[i]!;
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < len && input[i + 1] === '"') { field += '"'; i += 2; continue; }
				inQuotes = false; i++; continue;
			}
			field += ch; i++; continue;
		}
		if (ch === '"') { inQuotes = true; i++; continue; }
		if (ch === ",") { row.push(field); field = ""; i++; continue; }
		if (ch === "\r") {
			row.push(field); field = ""; rows.push(row); row = []; i++;
			if (i < len && input[i] === "\n") i++;
			continue;
		}
		if (ch === "\n") { row.push(field); field = ""; rows.push(row); row = []; i++; continue; }
		field += ch; i++;
	}
	if ((field.length > 0 || row.length > 0) && rows.length < maxRows) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

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

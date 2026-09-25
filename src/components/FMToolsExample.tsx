import { useState } from "react";
type Example = { ticket_id: string; email_subject: string; email_body: string; expected: { department: string; urgency: number; summary: string } };
export default function FMToolsExample({ examples }: { examples: Example[] }) {
	const [index, setIndex] = useState(0);
	const example = examples[index]!;
	return <section className="artifact-panel"><p className="eyebrow">Evaluation dataset example</p><h2>From a support ticket to structured fields</h2><p>FMTools connects Python workflows to Apple’s on-device models. This shows three public evaluation examples and their reference answers; it does not run a model in your browser.</p><label>Choose a ticket<select aria-label="Choose a ticket" value={index} onChange={(e) => setIndex(Number(e.target.value))}>{examples.map((e, i) => <option key={e.ticket_id} value={i}>{e.email_subject}</option>)}</select></label><h3>{example.email_subject}</h3><p>{example.email_body}</p><h3>Reference answer</h3><pre>{JSON.stringify(example.expected, null, 2)}</pre><p className="source-note">The test checks department, urgency, and summary against a reviewed reference. A model’s generated answer may differ.</p></section>;
}

import { useState } from "react";
const reports = [
	{ pr: 107, name: "Apogee", bytes: 178392, segnet: .00068841, posenet: .00017394, hardware: "CUDA · Tesla T4" },
	{ pr: 110, name: "Fixed-Huffman selector", bytes: 178517, segnet: .00056029, posenet: .00002943, hardware: "CPU · PyTorch" },
	{ pr: 140, name: "Semantic joint context mixing", bytes: 180002, segnet: .00020139, posenet: .00000637, hardware: "CUDA · Tesla T4" },
];
export default function CompressionExhibit() {
	const [index, setIndex] = useState(2);
	const report = reports[index]!;
	const terms = [{ name: "Segmentation distortion", value: 100 * report.segnet }, { name: "Pose distortion", value: Math.sqrt(10 * report.posenet) }, { name: "File-size cost", value: 25 * report.bytes / 37545489 }];
	return <section className="artifact-panel"><p className="eyebrow">Public submission reports · 600 samples each</p><h2>What goes into the score?</h2><p>The challenge charges for file size and for changes in two perception models’ outputs. Lower is better.</p><label>Submission<select aria-label="Submission" value={index} onChange={(e) => setIndex(Number(e.target.value))}>{reports.map((r, i) => <option key={r.pr} value={i}>PR #{r.pr} · {r.name}</option>)}</select></label>
		<dl className="artifact-metrics"><div><dt>Archive size</dt><dd>{report.bytes.toLocaleString()} B</dd></div><div><dt>Original video</dt><dd>37,545,489 B</dd></div><div><dt>Score, approximately</dt><dd>{terms.reduce((sum, term) => sum + term.value, 0).toFixed(4)}</dd></div></dl>
		{terms.map((term) => <div className="score-row" key={term.name}><span>{term.name}</span><div className="score-track"><span style={{ width: `${term.value / .15 * 100}%` }} /></div><span>{term.value.toFixed(5)}</span></div>)}
		<p className="source-note">100 × SegNet distortion + √(10 × PoseNet distortion) + 25 × archive/original size. Recomputed from the rounded components in <a href={`https://github.com/commaai/comma_video_compression_challenge/pull/${report.pr}`}>PR #{report.pr}</a>. Evaluation: {report.hardware}. Hardware differs between reports, and these values are not a live ranking.</p>
		<h3>A frame and the model’s segmentation</h3><div className="artifact-image-pair"><figure><img src="/portfolio/compression-reference-1.webp" width="512" height="384" alt="Reference driving-video frame showing a road and surrounding landscape" loading="lazy" /><figcaption>Reference frame 393</figcaption></figure><figure><img src="/portfolio/compression-segmentation.webp" width="256" height="192" alt="The reference frame divided into five colored segmentation classes" loading="lazy" /><figcaption>Model classes, reduced for display</figcaption></figure></div>
		<p className="source-note">This reference pair comes from <a href="https://github.com/adpena/witness-machine">Witness Machine</a>. Its cached segmentation was produced on macOS CPU and is a visual diagnostic, separate from the submission reports above. It does not show a reconstruction from any of these three archives.</p>
	</section>;
}

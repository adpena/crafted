import { useEffect, useState } from "react";
import data from "../data/portfolio/teadata-example.json";
import { selectCampuses } from "../lib/teadata-example";

const districts = [...new Set(data.rows.map((r) => r.district))].sort();
export default function TeadataDemo() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [district, setDistrict] = useState("Austin ISD");
  const [rating, setRating] = useState("all");
  const [minimum, setMinimum] = useState(0);
  const rows = selectCampuses(data.rows, district, rating, minimum);
  const code = `campuses = engine >> ("district", ${JSON.stringify(district)}) >> ("campuses_in",)
result = (campuses
    >> ("filter", lambda c: (${JSON.stringify(rating)} == "all" or c.rating == ${JSON.stringify(rating)})
        and c.beginning_teachers_pct is not None
        and c.beginning_teachers_pct >= ${minimum})
    >> ("sort", lambda c: c.campus_number)
    >> ("sort", lambda c: c.beginning_teachers_pct, True)
    >> ("take", 10))`;
  return <section className="artifact-panel" id="teadata-demo" aria-labelledby="teadata-demo-title">
    <p className="eyebrow">2025 ratings · 2023–24 staffing</p>
    <h2 id="teadata-demo-title">Explore a published campus dataset</h2>
    <p>This example connects campus identifiers, district membership, accountability ratings, and staffing data. Choose a district to see up to ten campuses with the highest share of beginning teachers.</p>
    <p className="source-note">The source workbook contains 795 selected D/F-rated district campuses across 217 districts. It is not a statewide campus inventory. The two measures cover different reporting years; this comparison does not establish a cause of a school’s rating.</p>
    <fieldset className="exhibit-controls" disabled={!ready} aria-label="Filter campus records">
      <label>District<select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>{districts.map((d) => <option key={d}>{d}</option>)}</select></label>
      <label>2025 rating<select aria-label="2025 rating" value={rating} onChange={(e) => setRating(e.target.value)}><option value="all">D and F</option><option>D</option><option>F</option></select></label>
      <label>Beginning teachers<select aria-label="Beginning teachers" value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}><option value={0}>Any reported percentage</option><option value={10}>At least 10%</option><option value={20}>At least 20%</option></select></label>
    </fieldset>
    <p role="status">{rows.length ? `${rows.length} campuses shown for ${district}.` : "No campuses in this snapshot match those filters."}</p>
    {!!rows.length && <div className="exhibit-table-scroll" tabIndex={0} role="region" aria-label="Campus query results"><table className="exhibit-table"><thead><tr><th scope="col">Campus</th><th scope="col">TEA number</th><th scope="col">2025 rating</th><th scope="col">Beginning teachers, 2023–24</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><th scope="row">{r.name}</th><td>{r.id}</td><td>{r.rating}</td><td>{r.beginningTeachers?.toFixed(1)}%</td></tr>)}</tbody></table></div>}
    <details><summary>Run the same query in Python</summary><pre tabIndex={0}>{code}</pre><p>Use the export script below to load the original workbook into teadata’s district and campus models.</p></details>
    <p className="source-note">Python/teadata produced this snapshot. The browser filters the exported records; it does not run the Python engine. Twelve reference queries are checked against the browser’s results.</p>
    <div className="artifact-links"><a href="https://github.com/adpena/teadata/blob/7b206d8a0fb086fec2176b78bb22bf1530486247/examples/campus_stats_district.xlsx">Original workbook</a><a href="/portfolio/teadata-example.json">Exported data</a><a href="https://github.com/adpena/crafted/blob/main/scripts/build-teadata-exhibit.py">Reproduce the export</a><a href="https://github.com/adpena/teadata/blob/7b206d8a0fb086fec2176b78bb22bf1530486247/docs/querying.md">Query documentation</a></div>
  </section>;
}

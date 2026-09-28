// Render text and vector project previews; no generated imagery or remote assets.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const cards = [
  ['teadata', 'SOFTWARE / PUBLIC DATA', ['teadata'], ['One data model for Texas schools.', 'Python queries you can inspect.'], ['795 CAMPUSES', '217 DISTRICTS', 'Published example dataset']],
  ['comma-lab', 'SOFTWARE / RESEARCH', ['A lossy video', 'compression challenge'], ['Three submissions, with code,', 'archives, and evaluation reports.'], ['PR 107', 'PR 110', 'PR 140']],
  ['molt', 'SOFTWARE / COMPILERS', ['Molt'], ['Python programs compiled', 'to WebAssembly.'], ['A FRACTAL', 'A DATA SUMMARY', 'A WORD COUNTER']],
  ['the-lost-decade-and-a-half', 'RESEARCH / WRITING / WEB', ['The Lost Decade', '(and a Half)'], ['I wrote the 2024 report, did the', 'analysis, and built the web tables.'], ['MAY 2024', 'TEXAS EDUCATOR PAY', 'Report + responsive district index']],
  ['fiscal-impact-of-charter-school-expansion', 'RESEARCH / DATA ENGINEERING', ['CharterCostTracker'], ['From state records to', 'district fiscal-impact reports.'], ['COLLECT', 'CALCULATE', 'REPORT']],
  ['facing-facts', 'RESEARCH / SCHOOL FINANCE', ['Texas charter schools:', '30 years'], ['My quantitative research for', 'OSOD’s Facing Facts report.'], ['SPENDING', 'STAFFING', 'OVERSIGHT']],
  ['fmtools', 'SOFTWARE / LOCAL MODELS', ['FMTools & FMRuntime'], ['Python tools and a Swift runtime', 'for Apple’s on-device models.'], ['PYTHON API', 'SWIFT RUNTIME', 'LOCAL CHAT']],
  ['notifications', 'SOFTWARE / MESSAGING', ['Notifications'], ['One message, multiple services,', 'and a result for each delivery.'], ['SENT', 'FAILED', 'SKIPPED']],
  ['hb2-support-staff-raises', 'RESEARCH / SCHOOL FINANCE', ['HB 2 support-staff', 'raise analysis'], ['Funding models and local', 'organizing materials for Texas AFT.'], ['STATEWIDE MODEL', 'LOCAL WORKBOOKS', '2025']]
];
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
for (const [slug, category, title, description, facts] of cards) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f5f5f0"/><path d="M64 102H1136M64 542H1136" stroke="#1a1a1a" stroke-width="2"/><text x="64" y="67" font-family="monospace" font-size="18" letter-spacing="2" fill="#454540">${category}</text><g fill="#1a1a1a" font-family="Georgia,serif">${title.map((line,i)=>`<text x="64" y="${192+i*64}" font-size="49">${escape(line)}</text>`).join('')}${description.map((line,i)=>`<text x="64" y="${370+i*36}" font-size="27">${escape(line)}</text>`).join('')}</g><path d="M792 154V482" stroke="#d4d4cc" stroke-width="2"/><g fill="#454540" font-family="monospace" font-size="16">${facts.map((line,i)=>`<rect x="836" y="${166+i*95}" width="36" height="5" fill="#16803b"/><text x="836" y="${211+i*95}">${escape(line)}</text>`).join('')}</g><text x="64" y="589" font-family="Georgia,serif" font-size="25" fill="#1a1a1a">Alejandro Peña</text><text x="1136" y="589" text-anchor="end" font-family="monospace" font-size="19" fill="#454540">adpena.com</text></svg>`;
  await writeFile(`public/og/${slug}.svg`, svg);
  await sharp(Buffer.from(svg)).png().toFile(`public/og/${slug}.png`);
}
console.log(`Rendered ${cards.length} project previews at 1200 × 630.`);

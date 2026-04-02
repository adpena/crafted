import type { DisclaimerResult } from "../modules/disclaimers.ts";

interface PageData {
  title: string;
  type: string;
  body: string;
  actblue_url: string;
  refcode: string;
  amounts: number[];
  variant: string;
  disclaimer: DisclaimerResult;
  geo: { country: string; region: string };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderActionPage(data: PageData, embed: boolean): string {
  const { title, type, body, actblue_url, refcode, amounts, disclaimer, geo } = data;

  const amountButtons = amounts
    .map((a) => `<button class="amount" data-amount="${a}" onclick="selectAmount(${a})">$${a}</button>`)
    .join("\n          ");

  const actblueHref = actblue_url
    ? `${actblue_url}?refcode=${encodeURIComponent(refcode)}&amount=`
    : "#";

  const disclaimerHtml = disclaimer.combined
    ? `<p class="disclaimer">${escapeHtml(disclaimer.combined)}</p>`
    : "";

  const citationsHtml = disclaimer.citations.length > 0
    ? `<p class="citations">${disclaimer.citations.map(escapeHtml).join(" · ")}</p>`
    : "";

  const donateSection = type === "fundraise" ? `
      <div class="amounts">
        ${amountButtons}
      </div>
      <a id="donate-link" href="${escapeHtml(actblueHref)}" class="cta" target="_blank" rel="noopener noreferrer">
        Donate
      </a>` : "";

  const petitionSection = type === "petition" ? `
      <form class="petition-form" method="POST" action="submit">
        <input type="text" name="first_name" placeholder="First name" required aria-label="First name" />
        <input type="text" name="last_name" placeholder="Last name" required aria-label="Last name" />
        <input type="email" name="email" placeholder="Email" required aria-label="Email" />
        <input type="text" name="zip" placeholder="ZIP code" required aria-label="ZIP code" />
        <button type="submit" class="cta">Sign</button>
      </form>` : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f5f5f0;
      ${embed ? "padding: 1.5rem;" : "padding: 3rem 1.5rem; max-width: 32rem; margin: 0 auto;"}
    }
    h1 { font-size: 1.5rem; font-weight: 400; letter-spacing: 0.02em; margin-bottom: 1rem; }
    .body { margin-bottom: 1.5rem; font-size: 0.95rem; }
    .amounts { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .amount {
      padding: 0.5rem 1rem;
      font-family: "Courier New", monospace;
      font-size: 0.875rem;
      background: transparent;
      border: 1px solid #1a1a1a;
      cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .amount:hover, .amount.selected {
      background: #1a1a1a;
      color: #f5f5f0;
    }
    .cta {
      display: inline-block;
      padding: 0.6rem 2rem;
      font-family: "Courier New", monospace;
      font-size: 0.875rem;
      color: #f5f5f0;
      background: #1a1a1a;
      border: none;
      text-decoration: none;
      cursor: pointer;
      margin-bottom: 1.5rem;
    }
    .cta:hover { opacity: 0.85; }
    .petition-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
    .petition-form input {
      padding: 0.5rem 0;
      font-family: Georgia, serif;
      font-size: 0.95rem;
      border: none;
      border-bottom: 1px solid #d4d4cc;
      background: transparent;
      color: #1a1a1a;
    }
    .petition-form input:focus { outline: none; border-bottom-color: #1a1a1a; }
    .disclaimer {
      font-family: "Courier New", monospace;
      font-size: 0.7rem;
      color: #707070;
      border-top: 1px solid #d4d4cc;
      padding-top: 0.75rem;
      margin-top: 1rem;
    }
    .citations { font-family: "Courier New", monospace; font-size: 0.6rem; color: #999; margin-top: 0.25rem; }
    @media (prefers-reduced-motion: reduce) { * { transition-duration: 0ms !important; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${body ? `<div class="body">${escapeHtml(body)}</div>` : ""}
    ${donateSection}
    ${petitionSection}
    ${disclaimerHtml}
    ${citationsHtml}
  </main>
  <script>
    var selectedAmount = null;
    function selectAmount(amt) {
      selectedAmount = amt;
      document.querySelectorAll('.amount').forEach(function(el) {
        el.classList.toggle('selected', Number(el.dataset.amount) === amt);
      });
      var link = document.getElementById('donate-link');
      if (link && link.href.includes('amount=')) {
        link.href = link.href.replace(/amount=.*/, 'amount=' + amt);
      }
    }
  </script>
</body>
</html>`;

  return html;
}

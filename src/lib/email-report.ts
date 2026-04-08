/**
 * Dashboard email report generator.
 *
 * Produces an HTML email (plain tables, max client compat) summarizing
 * the campaign ROI dashboard for a reporting period. Follows the same
 * layout/style conventions as email-templates.ts.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DayBucket {
  date: string;
  submissions: number;
  raised: number;
}

interface PageStat {
  slug: string;
  title: string;
  submissions: number;
  raised: number;
  conversion: number;
}

interface SourceStat {
  submissions: number;
  raised: number;
  cost_per_action: number | null;
}

export interface DashboardPayload {
  period: string;
  summary: {
    total_submissions: number;
    total_pages: number;
    total_donors: number;
    total_raised: number;
    conversion_rate: number;
    top_page: { slug: string; submissions: number } | null;
  };
  by_day: DayBucket[];
  by_action_type: Record<string, number>;
  by_page: PageStat[];
  attribution: Record<string, SourceStat>;
}

export interface EmailOutput {
  subject: string;
  html: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDollar(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

/** Compare current period vs previous to determine trend */
function trendArrow(current: number, previous: number): string {
  if (previous === 0) return "";
  const delta = ((current - previous) / previous) * 100;
  if (delta > 2) return `<span style="color:#059669;">&#9650; ${Math.round(delta)}%</span>`;
  if (delta < -2) return `<span style="color:#dc2626;">&#9660; ${Math.round(Math.abs(delta))}%</span>`;
  return `<span style="color:#6b7280;">&#8212; flat</span>`;
}

/* ------------------------------------------------------------------ */
/*  Email layout (same as email-templates.ts)                          */
/* ------------------------------------------------------------------ */

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;">
          ${content}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Main generator                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generate an HTML email report from dashboard data.
 *
 * Optionally accepts previousData to compute trend arrows.
 */
export function generateReportEmail(
  data: DashboardPayload,
  opts?: { dashboardUrl?: string; previousData?: DashboardPayload },
): EmailOutput {
  const s = data.summary;
  const prev = opts?.previousData?.summary;
  const dashboardUrl = opts?.dashboardUrl || "/admin/action-pages";

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Top 3 pages by submissions
  const topPages = [...data.by_page].sort((a, b) => b.submissions - a.submissions).slice(0, 3);

  const submissionTrend = prev ? trendArrow(s.total_submissions, prev.total_submissions) : "";
  const raisedTrend = prev ? trendArrow(s.total_raised, prev.total_raised) : "";

  const html = layout(`
    <h1 style="font-size:22px;font-weight:400;color:#1a1a1a;margin:0 0 4px;">
      Campaign Report
    </h1>
    <p style="font-size:13px;color:#9ca3af;margin:0 0 24px;font-family:monospace;">
      ${esc(today)} &middot; Last 30 days
    </p>

    <!-- Summary stats -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background:#f9fafb;border-radius:4px;text-align:center;width:33%;">
          <div style="font-size:28px;font-weight:600;color:#1f2937;font-family:Georgia,serif;line-height:1;">
            ${fmt(s.total_submissions)}
          </div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace;margin-top:4px;">
            Submissions ${submissionTrend}
          </div>
        </td>
        <td style="width:12px;">&nbsp;</td>
        <td style="padding:16px;background:#f9fafb;border-radius:4px;text-align:center;width:33%;">
          <div style="font-size:28px;font-weight:600;color:#1f2937;font-family:Georgia,serif;line-height:1;">
            ${fmtDollar(s.total_raised)}
          </div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace;margin-top:4px;">
            Raised ${raisedTrend}
          </div>
        </td>
        <td style="width:12px;">&nbsp;</td>
        <td style="padding:16px;background:#f9fafb;border-radius:4px;text-align:center;width:33%;">
          <div style="font-size:28px;font-weight:600;color:#1f2937;font-family:Georgia,serif;line-height:1;">
            ${fmtPct(s.conversion_rate)}
          </div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace;margin-top:4px;">
            Conversion
          </div>
        </td>
      </tr>
    </table>

    <!-- Top pages -->
    <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-family:monospace;margin:0 0 12px;">
      Top Pages
    </h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${topPages.map((p, i) => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 0;font-size:14px;color:#374151;">
          <strong>${i + 1}.</strong> ${esc(p.title)}
          <span style="font-size:11px;color:#9ca3af;font-family:monospace;"> /${esc(p.slug)}</span>
        </td>
        <td style="padding:10px 0;text-align:right;font-size:14px;font-family:Georgia,serif;font-weight:600;color:#1f2937;">
          ${fmt(p.submissions)}
        </td>
        <td style="padding:10px 0;text-align:right;font-size:13px;font-family:monospace;color:#6b7280;padding-left:12px;">
          ${fmtDollar(p.raised)}
        </td>
      </tr>`).join("")}
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="background:#1f2937;border-radius:4px;">
        <a href="${esc(dashboardUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-family:monospace;text-decoration:none;">
          View Full Dashboard
        </a>
      </td></tr>
    </table>

    <hr style="border:none;border-top:1px solid #e5e5e0;margin:24px 0;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;font-family:monospace;">
      Automated report &middot; ${esc(today)}
    </p>
  `);

  // Plain-text version
  const text = [
    `Campaign Report - ${today}`,
    `Last 30 days`,
    ``,
    `Submissions: ${fmt(s.total_submissions)}`,
    `Raised: ${fmtDollar(s.total_raised)}`,
    `Conversion: ${fmtPct(s.conversion_rate)}`,
    ``,
    `Top Pages:`,
    ...topPages.map((p, i) => `  ${i + 1}. ${p.title} (/${p.slug}) - ${fmt(p.submissions)} submissions, ${fmtDollar(p.raised)}`),
    ``,
    `Full dashboard: ${dashboardUrl}`,
  ].join("\n");

  return {
    subject: `Campaign Report: ${fmt(s.total_submissions)} submissions, ${fmtDollar(s.total_raised)} raised`,
    html,
    text,
  };
}

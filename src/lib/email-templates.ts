/**
 * HTML email templates for post-action confirmations.
 *
 * Each template is a pure function: (data) → HTML string.
 * No React dependency — these run server-side in Workers.
 * Styled inline for maximum email client compatibility.
 */

export type ActionType = "petition_sign" | "gotv_pledge" | "signup" | "donation_click" | "letter_sent" | "event_rsvp" | "call_made" | "step_form";

export interface EmailTemplateData {
  type: ActionType;
  firstName?: string;
  email: string;
  pageTitle?: string;
  pageUrl?: string;
  /** ISO date string */
  timestamp: string;
}

export interface EmailOutput {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate a confirmation email for the given action type.
 */
export function renderConfirmationEmail(data: EmailTemplateData): EmailOutput {
  switch (data.type) {
    case "petition_sign":
      return petitionEmail(data);
    case "gotv_pledge":
      return gotvEmail(data);
    case "signup":
      return signupEmail(data);
    case "donation_click":
      return donationEmail(data);
    case "letter_sent":
      return letterEmail(data);
    case "event_rsvp":
      return eventEmail(data);
    case "call_made":
      return callEmail(data);
    default:
      return genericEmail(data);
  }
}

function letterEmail(data: EmailTemplateData): EmailOutput {
  const name = data.firstName || "there";
  return {
    subject: "Your letter has been sent",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Thank you${name !== "there" ? `, ${esc(name)}` : ""}!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your letter has been submitted to your representatives. Personal messages from constituents carry more weight than form letters — thank you for taking the time.
      </p>
      ${shareBlock(data)}
      ${footerBlock(data)}
    `),
    text: `Thank you${name !== "there" ? `, ${name}` : ""}! Your letter has been submitted to your representatives.`,
  };
}

function callEmail(data: EmailTemplateData): EmailOutput {
  const name = data.firstName || "there";
  return {
    subject: "Thank you for calling",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Thank you${name !== "there" ? `, ${esc(name)}` : ""}!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your calls to your representatives have been recorded. Phone calls from constituents get logged by congressional staff — you just made your voice heard.
      </p>
      ${shareBlock(data)}
      ${footerBlock(data)}
    `),
    text: `Thank you${name !== "there" ? `, ${name}` : ""}! Your calls to your representatives have been recorded.`,
  };
}

function eventEmail(data: EmailTemplateData): EmailOutput {
  const name = data.firstName || "there";
  return {
    subject: "You're RSVP'd!",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        See you there, ${esc(name)}!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your RSVP has been received. We'll send a reminder closer to the event date.
      </p>
      ${footerBlock(data)}
    `),
    text: `See you there, ${name}! Your RSVP has been received.`,
  };
}

function petitionEmail(data: EmailTemplateData): EmailOutput {
  const name = data.firstName || "there";
  return {
    subject: "Thanks for signing!",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Thank you${name !== "there" ? `, ${esc(name)}` : ""}!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your signature has been recorded. Every voice matters — thank you for adding yours.
      </p>
      ${shareBlock(data)}
      ${footerBlock(data)}
    `),
    text: `Thank you${name !== "there" ? `, ${name}` : ""}! Your signature has been recorded.${data.pageUrl ? ` Share: ${data.pageUrl}` : ""}`,
  };
}

function gotvEmail(data: EmailTemplateData): EmailOutput {
  const name = data.firstName || "there";
  return {
    subject: "Your pledge to vote",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Thanks for pledging, ${esc(name)}!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your commitment to vote makes a difference. We'll send a reminder as election day approaches.
      </p>
      ${shareBlock(data)}
      ${footerBlock(data)}
    `),
    text: `Thanks for pledging, ${name}! Your commitment to vote makes a difference.`,
  };
}

function signupEmail(data: EmailTemplateData): EmailOutput {
  const name = data.firstName || "there";
  return {
    subject: "You're in!",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Welcome${name !== "there" ? `, ${esc(name)}` : ""}!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        You're signed up and will receive updates. Thank you for joining.
      </p>
      ${footerBlock(data)}
    `),
    text: `Welcome${name !== "there" ? `, ${name}` : ""}! You're signed up and will receive updates.`,
  };
}

function donationEmail(data: EmailTemplateData): EmailOutput {
  return {
    subject: "Thank you for your contribution",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Thank you for your generosity!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your contribution makes a real difference. You'll receive a receipt from ActBlue separately.
      </p>
      ${shareBlock(data)}
      ${footerBlock(data)}
    `),
    text: "Thank you for your generosity! You'll receive a receipt from ActBlue separately.",
  };
}

function genericEmail(data: EmailTemplateData): EmailOutput {
  return {
    subject: "Thank you!",
    html: layout(`
      <h1 style="font-size:24px;font-weight:400;color:#1a1a1a;margin:0 0 16px;">
        Thank you!
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 16px;">
        Your submission has been recorded. Thank you for taking action.
      </p>
      ${footerBlock(data)}
    `),
    text: "Thank you! Your submission has been recorded.",
  };
}

// --- Template helpers ---

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;">
          ${content}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function shareBlock(data: EmailTemplateData): string {
  // Validate pageUrl is a safe https/http URL — reject javascript:, data:, etc.
  const safeUrl = sanitizeUrl(data.pageUrl);
  if (!safeUrl) return "";
  let encoded: string;
  try {
    encoded = encodeURIComponent(safeUrl);
  } catch {
    return "";
  }
  return `
    <p style="font-size:14px;color:#666;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;">
      Spread the word
    </p>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 16px;">
      <a href="https://twitter.com/intent/tweet?url=${encoded}" style="color:#1a1a1a;margin-right:16px;">Share on X</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encoded}" style="color:#1a1a1a;">Share on Facebook</a>
    </p>`;
}

function footerBlock(data: EmailTemplateData): string {
  const date = new Date(data.timestamp).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  return `
    <hr style="border:none;border-top:1px solid #e5e5e0;margin:24px 0;" />
    <p style="font-size:12px;color:#999;margin:0;font-family:monospace;">
      Recorded on ${date}
    </p>`;
}

/** Validate URL is safe https/http — rejects javascript:, data:, vbscript:, etc. */
function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/** Escape HTML entities */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

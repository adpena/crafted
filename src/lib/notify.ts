/**
 * Contact form notification adapters.
 *
 * Each adapter is optional — configure by setting the corresponding
 * Worker secret via `wrangler secret put <NAME>`. Unconfigured
 * adapters are silently skipped. Failures are logged, never surfaced
 * to the visitor.
 *
 * Secrets:
 *   RESEND_API_KEY        — Resend.com API key for email delivery
 *   DISCORD_WEBHOOK_URL   — Discord channel webhook URL
 *   SLACK_WEBHOOK_URL     — Slack incoming webhook URL
 *   TELEGRAM_BOT_TOKEN    — Telegram bot token (from @BotFather)
 *   TELEGRAM_CHAT_ID      — Telegram chat/group ID to send to
 *   WHATSAPP_API_URL      — WhatsApp Business API endpoint
 *   WHATSAPP_API_TOKEN    — WhatsApp Business API bearer token
 *   WHATSAPP_PHONE_ID     — WhatsApp Business phone number ID
 *   WHATSAPP_TO           — Recipient phone number (with country code)
 */

interface Submission {
  name: string;
  email: string;
  message: string;
}

interface Env {
  RESEND_API_KEY?: string;
  DISCORD_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  WHATSAPP_API_URL?: string;
  WHATSAPP_API_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_TO?: string;
}

async function safe(label: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); } catch (e) { console.error(`${label} failed:`, e); }
}

async function sendResend(env: Env, sub: Submission): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  await safe("Resend", async () => {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Contact Form <contact@crafted.adpena.workers.dev>",
        to: "adpena@gmail.com",
        subject: `Portfolio contact from ${sub.name}`,
        reply_to: sub.email,
        text: `Name: ${sub.name}\nEmail: ${sub.email}\n\n${sub.message}`,
      }),
    });
  });
}

async function sendDiscord(env: Env, sub: Submission): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return;
  await safe("Discord", async () => {
    await fetch(env.DISCORD_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**New contact form submission**\n**From:** ${sub.name} (${sub.email})\n**Message:**\n${sub.message.slice(0, 1800)}`,
      }),
    });
  });
}

async function sendSlack(env: Env, sub: Submission): Promise<void> {
  if (!env.SLACK_WEBHOOK_URL) return;
  await safe("Slack", async () => {
    await fetch(env.SLACK_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*New contact form submission*\n*From:* ${sub.name} (${sub.email})\n*Message:*\n${sub.message.slice(0, 3000)}`,
      }),
    });
  });
}

async function sendTelegram(env: Env, sub: Submission): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await safe("Telegram", async () => {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `📬 New contact form submission\n\nFrom: ${sub.name} (${sub.email})\n\n${sub.message.slice(0, 4000)}`,
        parse_mode: "HTML",
      }),
    });
  });
}

async function sendWhatsApp(env: Env, sub: Submission): Promise<void> {
  const apiUrl = env.WHATSAPP_API_URL ?? "https://graph.facebook.com/v21.0";
  if (!env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_ID || !env.WHATSAPP_TO) return;
  await safe("WhatsApp", async () => {
    await fetch(`${apiUrl}/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: env.WHATSAPP_TO,
        type: "text",
        text: { body: `New contact: ${sub.name} (${sub.email})\n\n${sub.message.slice(0, 4000)}` },
      }),
    });
  });
}

export async function notifyAll(env: Env, sub: Submission): Promise<void> {
  await Promise.all([
    sendResend(env, sub),
    sendDiscord(env, sub),
    sendSlack(env, sub),
    sendTelegram(env, sub),
    sendWhatsApp(env, sub),
  ]);
}

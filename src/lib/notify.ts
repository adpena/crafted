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
 *   RESEND_FROM_EMAIL     — Sender address (default: Contact Form <contact@crafted.adpena.workers.dev>)
 *   RESEND_TO_EMAIL       — Recipient address (default: adpena@gmail.com)
 *   DISCORD_WEBHOOK_URL   — Discord channel webhook URL
 *   SLACK_WEBHOOK_URL     — Slack incoming webhook URL
 *   TELEGRAM_BOT_TOKEN    — Telegram bot token (from @BotFather)
 *   TELEGRAM_CHAT_ID      — Telegram chat/group ID to send to
 *   WHATSAPP_API_URL      — WhatsApp Business API endpoint
 *   WHATSAPP_API_TOKEN    — WhatsApp Business API bearer token
 *   WHATSAPP_PHONE_ID     — WhatsApp Business phone number ID
 *   WHATSAPP_TO           — Recipient phone number (with country code)
 *   DRY_RUN               — When set to any truthy value, log payloads without calling APIs
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum length for the message body across all adapters. */
const MAX_MESSAGE_LENGTH = 2000;

/** Marker appended when a message is truncated. */
const TRUNCATION_MARKER = " [truncated]";

/** Minimum length for a secret to be considered plausible. */
const MIN_SECRET_LENGTH = 8;

/** Maximum time (ms) to wait for any single adapter before considering it failed. */
const ADAPTER_TIMEOUT_MS = 5000;

/** Default Resend sender address. */
const DEFAULT_FROM_EMAIL = "Contact Form <contact@crafted.adpena.workers.dev>";

/** Default Resend recipient address. */
const DEFAULT_TO_EMAIL = "adpena@gmail.com";

/** Default WhatsApp Business API base URL. */
const DEFAULT_WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Submission {
  name: string;
  email: string;
  message: string;
}

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_TO_EMAIL?: string;
  DISCORD_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  WHATSAPP_API_URL?: string;
  WHATSAPP_API_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  WHATSAPP_TO?: string;
  DRY_RUN?: string;
}

/** Result returned from {@link notifyAll}. */
export interface NotifyResult {
  /** Adapters that fired successfully. */
  sent: string[];
  /** Adapters that attempted to fire but encountered an error. */
  failed: string[];
  /** Adapters that were not configured (missing secrets). */
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Sanitisation helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown formatting characters so user input cannot inject
 * bold/italic/link markup into Discord or Slack messages.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/[*_~`|>\[\]()\\]/g, "")
    .replace(/https?:\/\/\S+/g, "[link removed]");
}

/**
 * Escape characters that have meaning in Telegram's HTML parse mode.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Truncate a string to {@link MAX_MESSAGE_LENGTH}, appending a marker
 * when truncation occurs.
 */
function truncate(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return (
    text.slice(0, MAX_MESSAGE_LENGTH - TRUNCATION_MARKER.length) +
    TRUNCATION_MARKER
  );
}

/**
 * Return `true` if the provided value looks like a plausible secret
 * (non-empty string of at least {@link MIN_SECRET_LENGTH} characters).
 */
function isPlausibleSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length >= MIN_SECRET_LENGTH;
}

/** Return `true` when dry-run mode is active. */
function isDryRun(env: NotifyEnv): boolean {
  return !!env.DRY_RUN;
}

// ---------------------------------------------------------------------------
// Adapter helpers
// ---------------------------------------------------------------------------

type AdapterFn = (env: NotifyEnv, sub: Submission) => Promise<void>;

interface AdapterDef {
  name: string;
  /** Return `true` when all required secrets are present AND plausible. */
  isConfigured: (env: NotifyEnv) => boolean;
  send: AdapterFn;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

const resendAdapter: AdapterDef = {
  name: "Resend",
  isConfigured: (env) => isPlausibleSecret(env.RESEND_API_KEY),
  async send(env, sub) {
    const from = env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
    const to = env.RESEND_TO_EMAIL || DEFAULT_TO_EMAIL;
    const safeName = stripMarkdown(sub.name);
    const body = truncate(
      `Name: ${safeName}\nEmail: ${sub.email}\n\n${sub.message}`,
    );

    if (isDryRun(env)) {
      console.info("[DRY_RUN] Resend:", { from, to, subject: `Portfolio contact from ${safeName}`, body });
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Portfolio contact from ${safeName}`,
        reply_to: sub.email,
        text: body,
      }),
    });

    if (!res.ok) {
      throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    }
  },
};

const discordAdapter: AdapterDef = {
  name: "Discord",
  isConfigured: (env) => isPlausibleSecret(env.DISCORD_WEBHOOK_URL),
  async send(env, sub) {
    const safeName = stripMarkdown(sub.name);
    const safeEmail = stripMarkdown(sub.email);
    const safeMessage = stripMarkdown(sub.message);
    const content = truncate(
      `New contact form submission\nFrom: ${safeName} (${safeEmail})\nMessage:\n${safeMessage}`,
    );

    if (isDryRun(env)) {
      console.info("[DRY_RUN] Discord:", { content });
      return;
    }

    const res = await fetch(env.DISCORD_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      throw new Error(`Discord responded ${res.status}: ${await res.text()}`);
    }
  },
};

const slackAdapter: AdapterDef = {
  name: "Slack",
  isConfigured: (env) => isPlausibleSecret(env.SLACK_WEBHOOK_URL),
  async send(env, sub) {
    const safeName = stripMarkdown(sub.name);
    const safeEmail = stripMarkdown(sub.email);
    const safeMessage = stripMarkdown(sub.message);
    const text = truncate(
      `New contact form submission\nFrom: ${safeName} (${safeEmail})\nMessage:\n${safeMessage}`,
    );

    if (isDryRun(env)) {
      console.info("[DRY_RUN] Slack:", { text });
      return;
    }

    const res = await fetch(env.SLACK_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Slack responded ${res.status}: ${await res.text()}`);
    }
  },
};

const telegramAdapter: AdapterDef = {
  name: "Telegram",
  isConfigured: (env) =>
    isPlausibleSecret(env.TELEGRAM_BOT_TOKEN) &&
    isPlausibleSecret(env.TELEGRAM_CHAT_ID),
  async send(env, sub) {
    const safeName = escapeHtml(sub.name);
    const safeEmail = escapeHtml(sub.email);
    const safeMessage = escapeHtml(sub.message);
    const text = truncate(
      `New contact form submission\n\nFrom: ${safeName} (${safeEmail})\n\n${safeMessage}`,
    );

    if (isDryRun(env)) {
      console.info("[DRY_RUN] Telegram:", { chat_id: env.TELEGRAM_CHAT_ID, text });
      return;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Telegram responded ${res.status}: ${await res.text()}`);
    }
  },
};

const whatsappAdapter: AdapterDef = {
  name: "WhatsApp",
  isConfigured: (env) =>
    isPlausibleSecret(env.WHATSAPP_API_TOKEN) &&
    isPlausibleSecret(env.WHATSAPP_PHONE_ID) &&
    typeof env.WHATSAPP_TO === "string" &&
    env.WHATSAPP_TO.trim().length > 0,
  async send(env, sub) {
    const apiUrl = env.WHATSAPP_API_URL || DEFAULT_WHATSAPP_API_URL;
    const safeName = stripMarkdown(sub.name);
    const safeMessage = stripMarkdown(sub.message);
    const body = truncate(
      `New contact: ${safeName} (${sub.email})\n\n${safeMessage}`,
    );

    if (isDryRun(env)) {
      console.info("[DRY_RUN] WhatsApp:", { to: env.WHATSAPP_TO, body });
      return;
    }

    const res = await fetch(`${apiUrl}/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: env.WHATSAPP_TO,
        type: "text",
        text: { body },
      }),
    });

    if (!res.ok) {
      throw new Error(`WhatsApp responded ${res.status}: ${await res.text()}`);
    }
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapters: AdapterDef[] = [
  resendAdapter,
  discordAdapter,
  slackAdapter,
  telegramAdapter,
  whatsappAdapter,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fan-out a contact-form submission to every configured notification adapter.
 *
 * Adapters that are not configured (missing or implausible secrets) are
 * skipped. Failures are caught and logged — they never propagate to the
 * caller. When the `DRY_RUN` env var is set, payloads are logged without
 * making any external API calls.
 *
 * @returns A summary of which adapters fired, failed, or were skipped.
 */
export async function notifyAll(
  env: NotifyEnv,
  sub: Submission,
): Promise<NotifyResult> {
  const result: NotifyResult = { sent: [], failed: [], skipped: [] };

  const tasks = adapters.map(async (adapter) => {
    if (!adapter.isConfigured(env)) {
      result.skipped.push(adapter.name);
      return;
    }

    try {
      await Promise.race([
        adapter.send(env, sub),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ADAPTER_TIMEOUT_MS),
        ),
      ]);
      result.sent.push(adapter.name);
    } catch (err) {
      result.failed.push(adapter.name);
      console.error(
        `[notify] ${adapter.name} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  });

  await Promise.all(tasks);
  return result;
}

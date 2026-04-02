/**
 * Multi-channel notification dispatch.
 *
 * Sends a form submission to every configured channel in parallel.
 * Unconfigured adapters are skipped. Failures are caught and logged.
 * No external dependencies — uses only the Fetch API.
 *
 * Configure via environment variables (Worker secrets):
 *
 *   RESEND_API_KEY        Resend.com API key
 *   RESEND_FROM_EMAIL     Sender address (required if RESEND_API_KEY is set)
 *   RESEND_TO_EMAIL       Recipient address (required if RESEND_API_KEY is set)
 *   DISCORD_WEBHOOK_URL   Discord incoming webhook URL
 *   SLACK_WEBHOOK_URL     Slack incoming webhook URL
 *   TELEGRAM_BOT_TOKEN    Telegram bot token (from @BotFather)
 *   TELEGRAM_CHAT_ID      Telegram chat or group ID
 *   WHATSAPP_API_TOKEN    WhatsApp Business API bearer token
 *   WHATSAPP_PHONE_ID     WhatsApp Business phone number ID
 *   WHATSAPP_TO           Recipient phone number with country code
 *   WHATSAPP_API_URL      WhatsApp API base URL (default: Meta Graph API v21.0)
 *   CF_EMAIL_FROM         Cloudflare Email sender (e.g. contact@yourdomain.com)
 *   CF_EMAIL_TO           Cloudflare Email recipient
 *   SEND_EMAIL            Cloudflare Email Workers binding (runtime-injected, not a secret)
 *   DRY_RUN               Log payloads without calling external APIs
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 2000;
const TRUNCATION_MARKER = " [truncated]";
const MIN_SECRET_LENGTH = 8;
const ADAPTER_TIMEOUT_MS = 5000;
const DEFAULT_WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  CF_EMAIL_FROM?: string;
  CF_EMAIL_TO?: string;
  /** Cloudflare Email Workers send binding (injected by runtime, not a secret) */
  SEND_EMAIL?: { send: (msg: EmailMessage) => Promise<void> };
  DRY_RUN?: string;
}

interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  replyTo?: string;
  text: string;
}

export interface NotifyResult {
  sent: string[];
  failed: string[];
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlausibleSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length >= MIN_SECRET_LENGTH;
}

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254 && !/[\r\n]/.test(value);
}

function sanitizeText(text: string): string {
  if (typeof text !== "string") return "";
  // Strip only characters that render as bold/italic/strikethrough/code
  // in Discord and Slack. Preserve everything else.
  return text.replace(/[*_~`]/g, "");
}

function escapeHtml(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return text.slice(0, MAX_MESSAGE_LENGTH - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
}

function coerce(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 200);
  } catch {
    return "(unreadable)";
  }
}

function validateUrl(url: string, label: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error(`${label} must use HTTPS`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("HTTPS")) throw e;
    throw new Error(`${label} is not a valid URL`);
  }
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

interface Adapter {
  name: string;
  isConfigured: (env: NotifyEnv) => boolean;
  send: (env: NotifyEnv, sub: Submission, signal: AbortSignal) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

const resend: Adapter = {
  name: "Resend",
  isConfigured: (env) =>
    isPlausibleSecret(env.RESEND_API_KEY) &&
    isNonEmpty(env.RESEND_FROM_EMAIL) &&
    isNonEmpty(env.RESEND_TO_EMAIL),
  async send(env, sub, signal) {
    const name = sanitizeText(sub.name);
    const email = coerce(sub.email);

    if (!isValidEmail(email)) {
      throw new Error("invalid reply_to email");
    }

    const body = truncate(`Name: ${name}\nEmail: ${email}\n\n${sanitizeText(sub.message)}`);

    if (env.DRY_RUN) {
      console.info("[DRY_RUN] Resend:", { to: env.RESEND_TO_EMAIL, body });
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: env.RESEND_TO_EMAIL,
        subject: `Contact from ${name}`,
        reply_to: email,
        text: body,
      }),
    });

    if (!res.ok) {
      throw new Error(`${res.status}: ${await readErrorBody(res)}`);
    }
  },
};

const discord: Adapter = {
  name: "Discord",
  isConfigured: (env) => isPlausibleSecret(env.DISCORD_WEBHOOK_URL),
  async send(env, sub, signal) {
    const content = truncate(
      `New contact\nFrom: ${sanitizeText(sub.name)} (${sanitizeText(sub.email)})\n\n${sanitizeText(sub.message)}`,
    );

    if (env.DRY_RUN) {
      console.info("[DRY_RUN] Discord:", { content });
      return;
    }

    const res = await fetch(env.DISCORD_WEBHOOK_URL!, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      throw new Error(`${res.status}: ${await readErrorBody(res)}`);
    }
  },
};

const slack: Adapter = {
  name: "Slack",
  isConfigured: (env) => isPlausibleSecret(env.SLACK_WEBHOOK_URL),
  async send(env, sub, signal) {
    const text = truncate(
      `New contact\nFrom: ${sanitizeText(sub.name)} (${sanitizeText(sub.email)})\n\n${sanitizeText(sub.message)}`,
    );

    if (env.DRY_RUN) {
      console.info("[DRY_RUN] Slack:", { text });
      return;
    }

    const res = await fetch(env.SLACK_WEBHOOK_URL!, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`${res.status}: ${await readErrorBody(res)}`);
    }
  },
};

const telegram: Adapter = {
  name: "Telegram",
  isConfigured: (env) =>
    isPlausibleSecret(env.TELEGRAM_BOT_TOKEN) && isNonEmpty(env.TELEGRAM_CHAT_ID),
  async send(env, sub, signal) {
    const text = truncate(
      `New contact\n\nFrom: ${escapeHtml(sub.name)} (${escapeHtml(sub.email)})\n\n${escapeHtml(sub.message)}`,
    );

    if (env.DRY_RUN) {
      console.info("[DRY_RUN] Telegram:", { chat_id: env.TELEGRAM_CHAT_ID, text });
      return;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
      },
    );

    if (!res.ok) {
      throw new Error(`${res.status}: ${await readErrorBody(res)}`);
    }
  },
};

const whatsapp: Adapter = {
  name: "WhatsApp",
  isConfigured: (env) =>
    isPlausibleSecret(env.WHATSAPP_API_TOKEN) &&
    isNonEmpty(env.WHATSAPP_PHONE_ID) &&
    isNonEmpty(env.WHATSAPP_TO),
  async send(env, sub, signal) {
    const apiUrl = env.WHATSAPP_API_URL || DEFAULT_WHATSAPP_API_URL;
    validateUrl(apiUrl, "WHATSAPP_API_URL");

    const body = truncate(
      `New contact: ${sanitizeText(sub.name)} (${sanitizeText(sub.email)})\n\n${sanitizeText(sub.message)}`,
    );

    if (env.DRY_RUN) {
      console.info("[DRY_RUN] WhatsApp:", { to: env.WHATSAPP_TO, body });
      return;
    }

    const res = await fetch(`${apiUrl}/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      signal,
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
      throw new Error(`${res.status}: ${await readErrorBody(res)}`);
    }
  },
};

const cloudflareEmail: Adapter = {
  name: "CloudflareEmail",
  isConfigured: (env) =>
    env.SEND_EMAIL != null &&
    typeof env.SEND_EMAIL.send === "function" &&
    isNonEmpty(env.CF_EMAIL_FROM) &&
    isNonEmpty(env.CF_EMAIL_TO),
  async send(env, sub, _signal) {
    const name = sanitizeText(sub.name);
    const email = coerce(sub.email);

    if (!isValidEmail(email)) {
      throw new Error("invalid reply_to email");
    }

    const body = truncate(`Name: ${name}\nEmail: ${email}\n\n${sanitizeText(sub.message)}`);

    if (env.DRY_RUN) {
      console.info("[DRY_RUN] CloudflareEmail:", { from: env.CF_EMAIL_FROM, to: env.CF_EMAIL_TO, body });
      return;
    }

    await env.SEND_EMAIL!.send({
      from: env.CF_EMAIL_FROM!,
      to: env.CF_EMAIL_TO!,
      subject: `Contact from ${name}`,
      replyTo: email,
      text: body,
    });
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const adapters: Adapter[] = [cloudflareEmail, resend, discord, slack, telegram, whatsapp];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a submission to every configured notification channel.
 *
 * Runs all adapters in parallel with a per-adapter timeout.
 * Returns which adapters sent, failed, or were skipped.
 */
export async function notifyAll(env: NotifyEnv, sub: Submission): Promise<NotifyResult> {
  const result: NotifyResult = { sent: [], failed: [], skipped: [] };

  // Validate input at the boundary
  const safeSub: Submission = {
    name: coerce(sub?.name),
    email: coerce(sub?.email),
    message: coerce(sub?.message),
  };

  if (!safeSub.name || !safeSub.email || !safeSub.message) {
    console.warn("[notify] skipped: empty name, email, or message");
    return result;
  }

  await Promise.all(
    adapters.map(async (adapter) => {
      if (!adapter.isConfigured(env)) {
        result.skipped.push(adapter.name);
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ADAPTER_TIMEOUT_MS);

      try {
        await adapter.send(env, safeSub, controller.signal);
        result.sent.push(adapter.name);
      } catch (err) {
        result.failed.push(adapter.name);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[notify] ${adapter.name} failed: ${msg}`);
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return result;
}

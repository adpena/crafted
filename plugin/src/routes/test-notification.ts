import type { RouteContext, PluginContext } from "emdash";
import { notifyAll, type NotifyEnv, type NotifyResult } from "@adpena/notifications";

/**
 * POST /test-notification
 *
 * Sends a test notification through one or all configured adapters.
 *
 * Input: { channel?: string }   // omit to test every configured channel
 * Output: { sent: string[]; failed: string[]; skipped: string[] }
 *
 * Pulls credentials from plugin KV (settings:*) and assembles a NotifyEnv
 * on the fly so settings stored via the admin UI work without a redeploy.
 */

const SETTING_KEYS = [
  "discord_webhook_url",
  "slack_webhook_url",
  "telegram_bot_token",
  "telegram_chat_id",
  "whatsapp_api_token",
  "whatsapp_phone_id",
  "whatsapp_to",
  "whatsapp_api_url",
  "resend_api_key",
  "resend_from_email",
  "resend_to_email",
  "cf_email_from",
  "cf_email_to",
  "hubspot_portal_id",
  "hubspot_form_id",
  "hubspot_api_token",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

async function loadSettings(ctx: PluginContext): Promise<Record<SettingKey, string | null>> {
  const entries = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const value = await ctx.kv.get<string>(`settings:${key}`);
      return [key, value ?? null] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<SettingKey, string | null>;
}

function buildNotifyEnv(
  settings: Record<SettingKey, string | null>,
  runtimeEnv: Record<string, unknown> | undefined,
): NotifyEnv {
  const pick = (key: SettingKey): string | undefined => {
    const value = settings[key];
    return value && value.trim() ? value.trim() : undefined;
  };

  // Note: cast to NotifyEnv & Record<string, unknown> so newer adapter env
  // vars (HubSpot, etc.) work even when the locally installed types lag
  // behind the runtime package.
  const env = {
    DISCORD_WEBHOOK_URL: pick("discord_webhook_url"),
    SLACK_WEBHOOK_URL: pick("slack_webhook_url"),
    TELEGRAM_BOT_TOKEN: pick("telegram_bot_token"),
    TELEGRAM_CHAT_ID: pick("telegram_chat_id"),
    WHATSAPP_API_TOKEN: pick("whatsapp_api_token"),
    WHATSAPP_PHONE_ID: pick("whatsapp_phone_id"),
    WHATSAPP_TO: pick("whatsapp_to"),
    WHATSAPP_API_URL: pick("whatsapp_api_url"),
    RESEND_API_KEY: pick("resend_api_key"),
    RESEND_FROM_EMAIL: pick("resend_from_email"),
    RESEND_TO_EMAIL: pick("resend_to_email"),
    CF_EMAIL_FROM: pick("cf_email_from"),
    CF_EMAIL_TO: pick("cf_email_to"),
    HUBSPOT_PORTAL_ID: pick("hubspot_portal_id"),
    HUBSPOT_FORM_ID: pick("hubspot_form_id"),
    HUBSPOT_API_TOKEN: pick("hubspot_api_token"),
  } as NotifyEnv & Record<string, unknown>;

  // SEND_EMAIL binding is injected by the Workers runtime — forward it
  // through if present so the cloudflareEmail adapter activates.
  const sendEmail = runtimeEnv?.SEND_EMAIL as NotifyEnv["SEND_EMAIL"] | undefined;
  if (sendEmail) {
    env.SEND_EMAIL = sendEmail;
  }

  return env;
}

const CHANNEL_NAMES = new Set([
  "Discord",
  "Slack",
  "Telegram",
  "WhatsApp",
  "Resend",
  "Cloudflare Email",
  "HubSpot Forms",
  "HubSpot Contacts",
]);

export async function handleTestNotification(
  routeCtx: RouteContext,
  ctx: PluginContext,
): Promise<{ status: number; body: unknown }> {
  if (routeCtx.request.method !== "POST") {
    return {
      status: 405,
      body: { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } },
    };
  }

  const input = (routeCtx.input ?? {}) as { channel?: string };
  const requestedChannel = typeof input.channel === "string" ? input.channel.trim() : "";

  if (requestedChannel && !CHANNEL_NAMES.has(requestedChannel)) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_CHANNEL",
          message: `Unknown channel "${requestedChannel}"`,
          allowed: Array.from(CHANNEL_NAMES),
        },
      },
    };
  }

  const settings = await loadSettings(ctx);
  // The runtime env (with bindings like SEND_EMAIL) is exposed on routeCtx in
  // some emdash builds. Fall back to undefined if not present.
  const runtimeEnv = (routeCtx as unknown as { env?: Record<string, unknown> }).env;
  const env = buildNotifyEnv(settings, runtimeEnv);

  const message = {
    subject: "Test from Action Pages",
    body: "If you can read this, your notification setup is working!",
    fields: {
      test: "true",
      timestamp: new Date().toISOString(),
      ...(requestedChannel ? { channel: requestedChannel } : {}),
    },
  };

  let result: NotifyResult;
  try {
    result = await notifyAll(env, message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.log?.error?.(`[test-notification] notifyAll threw: ${msg}`);
    return {
      status: 500,
      body: { error: { code: "DISPATCH_FAILED", message: msg } },
    };
  }

  // If the caller asked for a single channel, narrow the report to it so the
  // UI can show a focused result.
  if (requestedChannel) {
    const filterTo = (list: string[]) => list.filter((name) => name === requestedChannel);
    result = {
      sent: filterTo(result.sent),
      failed: filterTo(result.failed),
      skipped: filterTo(result.skipped),
    };
  }

  return {
    status: 200,
    body: {
      data: {
        ...result,
        timestamp: message.fields.timestamp,
      },
    },
  };
}

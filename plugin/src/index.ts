import type { PluginDescriptor } from "emdash";

// Note: cast to PluginDescriptor at the return because the emdash type
// in this version doesn't yet include the `admin` field for settings UI.
// The runtime accepts it via the standard plugin descriptor format.
export function actionPages(): PluginDescriptor {
  return ({
    id: "crafted-action-pages",
    version: "0.2.0",
    format: "standard",
    entrypoint: "@crafted/action-pages/sandbox",
    capabilities: ["read:content", "write:content", "email:send", "network:fetch", "page:inject"],
    allowedHosts: ["secure.actblue.com", "*.cloudflareinsights.com"],
    storage: {
      campaigns: { indexes: ["slug"] },
      action_pages: { indexes: ["slug", "status", "campaign_id"] },
      submissions: { indexes: ["page_id", "campaign_id", "created_at"] },
      ab_variants: { indexes: ["page_id"] },
    },
    admin: {
      settingsSchema: {
        default_committee_name: {
          type: "string",
          label: "Default Committee Name",
          description: "Used in disclaimer text (e.g., 'Peña for Congress')",
        },
        default_treasurer_name: {
          type: "string",
          label: "Default Treasurer Name",
          description: "Optional treasurer line for disclaimer",
        },
        default_theme: {
          type: "select",
          label: "Default Theme",
          options: [
            { value: "warm", label: "Warm (Editorial)" },
            { value: "bold", label: "Bold (Dark)" },
            { value: "clean", label: "Clean (Minimal)" },
          ],
          default: "warm",
        },
        actblue_base_url: {
          type: "string",
          label: "ActBlue Base URL",
          description: "Your ActBlue donation page URL (https://secure.actblue.com/donate/...)",
        },
        webhook_url_1: {
          type: "string",
          label: "Webhook URL (Primary)",
          description: "Zapier Catch Hook or any webhook endpoint. Receives all action events.",
        },
        webhook_url_2: {
          type: "string",
          label: "Webhook URL (Secondary)",
          description: "Optional second webhook endpoint",
        },
        webhook_secret: {
          type: "secret",
          label: "Webhook Secret",
          description: "HMAC-SHA256 signing key for webhook verification",
        },
        google_sheets_webhook: {
          type: "string",
          label: "Google Sheets Webhook",
          description: "Google Apps Script web app URL for Sheets integration",
        },
        slack_webhook_url: {
          type: "string",
          label: "Slack Webhook URL",
          description: "Slack › Apps › Incoming Webhooks › Add to Slack. Paste the resulting URL here.",
        },
        discord_webhook_url: {
          type: "string",
          label: "Discord Webhook URL",
          description: "Discord channel › Edit Channel › Integrations › Webhooks › New Webhook.",
        },
        notification_email: {
          type: "string",
          label: "Notification Email",
          description: "Email address to receive action summaries (uses emdash email)",
        },

        // ── Telegram ─────────────────────────────────────────────────────
        telegram_bot_token: {
          type: "secret",
          label: "Telegram Bot Token",
          description: "Create a bot via @BotFather on Telegram, then paste the token here.",
        },
        telegram_chat_id: {
          type: "string",
          label: "Telegram Chat ID",
          description: "Numeric chat ID (use @userinfobot or @RawDataBot to find it). Group IDs start with -100.",
        },

        // ── WhatsApp Business ────────────────────────────────────────────
        whatsapp_api_token: {
          type: "secret",
          label: "WhatsApp API Token",
          description: "Meta › WhatsApp Business › Generate access token (requires whatsapp_business_messaging scope).",
        },
        whatsapp_phone_id: {
          type: "string",
          label: "WhatsApp Phone Number ID",
          description: "Phone number ID from Meta › WhatsApp › API Setup.",
        },
        whatsapp_to: {
          type: "string",
          label: "WhatsApp Recipient",
          description: "Recipient phone number in E.164 format, no plus sign (e.g. 15551234567).",
        },
        whatsapp_api_url: {
          type: "string",
          label: "WhatsApp API URL (optional)",
          description: "Override the Meta Graph API endpoint. Leave blank to use the default.",
        },

        // ── Resend ───────────────────────────────────────────────────────
        resend_api_key: {
          type: "secret",
          label: "Resend API Key",
          description: "Resend dashboard › API Keys › Create API Key. Starts with re_.",
        },
        resend_from_email: {
          type: "string",
          label: "Resend From Address",
          description: "Verified sender (e.g. notifications@yourdomain.com). Domain must be verified in Resend.",
        },
        resend_to_email: {
          type: "string",
          label: "Resend To Address",
          description: "Where transactional notifications are delivered.",
        },

        // ── Cloudflare Email Workers ────────────────────────────────────
        cf_email_from: {
          type: "string",
          label: "Cloudflare Email From",
          description: "Verified sender. Requires SEND_EMAIL binding (auto-injected by Workers runtime).",
        },
        cf_email_to: {
          type: "string",
          label: "Cloudflare Email To",
          description: "Recipient address (must be verified destination in Cloudflare Email Routing).",
        },

        // ── HubSpot Forms (public, no auth) ─────────────────────────────
        hubspot_portal_id: {
          type: "string",
          label: "HubSpot Portal ID",
          description: "HubSpot › Settings › Account Defaults › Account ID. Numeric.",
        },
        hubspot_form_id: {
          type: "string",
          label: "HubSpot Form ID",
          description: "Marketing › Forms › Form › Embed code. UUID format.",
        },

        // ── HubSpot Contacts (private app) ──────────────────────────────
        hubspot_api_token: {
          type: "secret",
          label: "HubSpot Private App Token",
          description: "HubSpot › Settings › Integrations › Private Apps. Requires crm.objects.contacts.write scope.",
        },
      },
      pages: [
        { path: "/action-pages", label: "Action Pages", icon: "zap" },
        { path: "/submissions", label: "Submissions", icon: "inbox" },
        { path: "/notifications", label: "Notifications", icon: "bell" },
      ],
      widgets: [
        { id: "action-stats", size: "half", title: "Action Page Stats" },
      ],
    },
  } as unknown as PluginDescriptor);
}

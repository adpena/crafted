import { definePlugin } from "emdash";
import type { PluginDefinition } from "emdash";
import { handleInstall } from "./hooks/install.ts";
import { handleContentAfterSave } from "./hooks/content-after-save.ts";
import { handlePageMetadata } from "./hooks/page-metadata.ts";
import { handleCron } from "./hooks/cron.ts";
import { handleSubmit } from "./routes/submit.ts";
import { handlePage } from "./routes/page.ts";
import { handleEmbed } from "./routes/embed.ts";
import { handleStats } from "./routes/stats.ts";
import { handleCreatePage } from "./routes/create-page.ts";
import { handleWebComponent } from "./routes/web-component.ts";
import { handleTestNotification } from "./routes/test-notification.ts";

/**
 * Native-format plugin factory.
 *
 * `definePlugin` with `id` + `version` returns a ResolvedPlugin.
 * The admin config (settingsSchema, pages, widgets) is carried through
 * to the runtime manifest so the admin panel can render them.
 */
export function createPlugin() {
  // Cast needed: TS overload resolution sees StandardPluginDefinition (no id)
  // before PluginDefinition (with id). Explicit cast selects the native overload.
  return definePlugin({
    id: "action-pages",
    version: "0.3.0",
    capabilities: ["read:content", "write:content", "email:send", "network:fetch", "page:inject"],
    allowedHosts: ["secure.actblue.com", "*.cloudflareinsights.com"],
    storage: {
      campaigns: { indexes: ["slug"] },
      action_pages: { indexes: ["slug", "status", "campaign_id"] },
      submissions: { indexes: ["page_id", "campaign_id", "created_at"] },
      ab_variants: { indexes: ["page_id"] },
    },
    admin: {
      entry: "@adpena/action-pages/admin",
      settingsSchema: {
        default_committee_name: {
          type: "string",
          label: "Default Committee Name",
          description: "Used in disclaimer text (e.g., 'Pena for Congress')",
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
          description: "Slack > Apps > Incoming Webhooks > Add to Slack. Paste the resulting URL here.",
        },
        discord_webhook_url: {
          type: "string",
          label: "Discord Webhook URL",
          description: "Discord channel > Edit Channel > Integrations > Webhooks > New Webhook.",
        },
        notification_email: {
          type: "string",
          label: "Notification Email",
          description: "Email address to receive action summaries (uses emdash email)",
        },
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
        whatsapp_api_token: {
          type: "secret",
          label: "WhatsApp API Token",
          description: "Meta > WhatsApp Business > Generate access token (requires whatsapp_business_messaging scope).",
        },
        whatsapp_phone_id: {
          type: "string",
          label: "WhatsApp Phone Number ID",
          description: "Phone number ID from Meta > WhatsApp > API Setup.",
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
        resend_api_key: {
          type: "secret",
          label: "Resend API Key",
          description: "Resend dashboard > API Keys > Create API Key. Starts with re_.",
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
        hubspot_portal_id: {
          type: "string",
          label: "HubSpot Portal ID",
          description: "HubSpot > Settings > Account Defaults > Account ID. Numeric.",
        },
        hubspot_form_id: {
          type: "string",
          label: "HubSpot Form ID",
          description: "Marketing > Forms > Form > Embed code. UUID format.",
        },
        hubspot_api_token: {
          type: "secret",
          label: "HubSpot Private App Token",
          description: "HubSpot > Settings > Integrations > Private Apps. Requires crm.objects.contacts.write scope.",
        },
      },
      pages: [
        { path: "/action-pages", label: "Action Pages", icon: "zap" },
        { path: "/submissions", label: "Submissions", icon: "inbox" },
        { path: "/notifications", label: "Notifications", icon: "bell" },
        { path: "/templates", label: "Templates", icon: "layout" },
        { path: "/brand", label: "Brand", icon: "palette" },
        { path: "/generate", label: "AI Generator", icon: "sparkles" },
        { path: "/email", label: "Email Blast", icon: "send" },
        { path: "/import", label: "Import", icon: "upload" },
        { path: "/webhooks", label: "Webhooks", icon: "webhook" },
        { path: "/audit", label: "Audit Log", icon: "shield" },
      ],
      widgets: [
        { id: "action-stats", size: "half", title: "Action Page Stats" },
      ],
    },
    hooks: {
      "plugin:activate": { handler: handleInstall },
      "content:afterSave": { handler: handleContentAfterSave },
      "page:metadata": { handler: handlePageMetadata },
      "cron": { handler: handleCron },
    },
    routes: {
      submit: { handler: handleSubmit, public: true },
      page: { handler: handlePage, public: true },
      embed: { handler: handleEmbed, public: true },
      stats: { handler: handleStats },
      "create-page": { handler: handleCreatePage },
      "web-component.js": { handler: handleWebComponent, public: true },
      "test-notification": { handler: handleTestNotification },
    },
  } as unknown as PluginDefinition);
}

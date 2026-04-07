import type { PluginDescriptor } from "emdash";

export function actionPages(): PluginDescriptor {
  return {
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
          description: "Slack incoming webhook URL for action notifications",
        },
        discord_webhook_url: {
          type: "string",
          label: "Discord Webhook URL",
          description: "Discord webhook URL for action notifications",
        },
        notification_email: {
          type: "string",
          label: "Notification Email",
          description: "Email address to receive action summaries (uses emdash email)",
        },
      },
      pages: [
        { path: "/action-pages", label: "Action Pages", icon: "zap" },
        { path: "/submissions", label: "Submissions", icon: "inbox" },
      ],
      widgets: [
        { id: "action-stats", size: "half", title: "Action Page Stats" },
      ],
    },
  };
}

import type { PluginDescriptor } from "emdash";

/**
 * Plugin descriptor for Campaign Action Pages.
 *
 * The entrypoint module (sandbox-entry.ts) defines hooks and routes.
 * The adminEntry module (admin/index.tsx) provides React admin components.
 * The settingsSchema auto-generates a settings UI in the emdash admin panel.
 */
export function actionPages(): PluginDescriptor {
  return {
    id: "action-pages",
    format: "native",
    version: "0.3.0",
    entrypoint: "@adpena/action-pages/sandbox",
    adminEntry: "@adpena/action-pages/admin",
    capabilities: ["content:read", "content:write", "email:send", "network:request", "hooks.page-fragments:register"],
    allowedHosts: ["secure.actblue.com", "*.cloudflareinsights.com"],
    storage: {
      campaigns: { indexes: ["slug"] },
      action_pages: { indexes: ["slug", "status", "campaign_id"] },
      submissions: { indexes: ["page_id", "campaign_id", "created_at"] },
      ab_variants: { indexes: ["page_id"] },
    },
    adminPages: [
      { path: "/", label: "Dashboard", icon: "chart" },
      { path: "/action-pages", label: "Action Pages", icon: "zap" },
      { path: "/submissions", label: "Submissions", icon: "inbox" },
      { path: "/notifications", label: "Notifications", icon: "bell" },
      { path: "/lists", label: "List Builder", icon: "users" },
    ],
    adminWidgets: [
      { id: "action-stats", size: "half", title: "Action Page Stats" },
    ],
  };
}

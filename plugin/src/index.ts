import type { PluginDescriptor } from "emdash";

/**
 * Plugin descriptor for Campaign Action Pages.
 *
 * The entrypoint module (sandbox-entry.ts) defines hooks and routes.
 * The adminEntry module (admin/index.tsx) provides React admin components.
 * The settingsSchema auto-generates a settings UI in the emdash admin panel.
 *
 * Note: cast to PluginDescriptor because emdash v0.1.0's type definition
 * doesn't include adminEntry/adminPages/adminWidgets fields yet, but the
 * runtime accepts them via the standard plugin descriptor format.
 */
export function actionPages(): PluginDescriptor {
  return ({
    id: "action-pages",
    version: "0.3.0",
    entrypoint: "@adpena/action-pages/sandbox",
    adminEntry: "@adpena/action-pages/admin",
    capabilities: ["read:content", "write:content", "email:send", "network:fetch", "page:inject"],
    allowedHosts: ["secure.actblue.com", "*.cloudflareinsights.com"],
    storage: {
      campaigns: { indexes: ["slug"] },
      action_pages: { indexes: ["slug", "status", "campaign_id"] },
      submissions: { indexes: ["page_id", "campaign_id", "created_at"] },
      ab_variants: { indexes: ["page_id"] },
    },
    adminPages: [
      { path: "/action-pages", label: "Action Pages", icon: "zap" },
      { path: "/submissions", label: "Submissions", icon: "inbox" },
      { path: "/notifications", label: "Notifications", icon: "bell" },
    ],
    adminWidgets: [
      { id: "action-stats", size: "half", title: "Action Page Stats" },
    ],
  } as unknown as PluginDescriptor);
}

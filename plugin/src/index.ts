import type { PluginDescriptor } from "emdash";

export function actionPages(): PluginDescriptor {
  return {
    id: "crafted-action-pages",
    version: "0.1.0",
    format: "standard",
    entrypoint: "@crafted/action-pages/sandbox",
    capabilities: ["read:content", "write:content", "email:send", "network:fetch", "page:inject"],
    storage: {
      action_pages: { indexes: ["slug", "status"] },
      submissions: { indexes: ["page_id", "created_at"] },
      ab_variants: { indexes: ["page_id"] },
    },
    adminPages: [
      { path: "/action-pages", label: "Action Pages" },
      { path: "/submissions", label: "Submissions" },
      { path: "/disclaimers", label: "Disclaimers" },
    ],
    adminWidgets: [
      { id: "ab-dashboard", title: "A/B Dashboard" },
    ],
  };
}

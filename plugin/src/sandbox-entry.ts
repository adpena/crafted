// TODO(plugin-mcp): Register plugin-provided MCP tools when emdash supports it.
//   Tools to expose:
//   - create_campaign: create a new campaign with committee info
//   - create_action_page: create an action page for a campaign
//   - list_submissions: query submissions by campaign/page/date
//   - campaign_stats: A/B variant performance for a campaign
//   - export_submissions: CSV/JSON export for external tools
//
// TODO(plugin-admin): Build React admin UI pages for:
//   - Action page builder (visual editor)
//   - Submissions viewer with filtering
//   - Campaign management dashboard
//   - Disclaimer data browser

import { definePlugin } from "emdash";
import { handleInstall } from "./hooks/install.ts";
import { handleContentAfterSave } from "./hooks/content-after-save.ts";
import { handlePageMetadata } from "./hooks/page-metadata.ts";
import { handleCron } from "./hooks/cron.ts";
import { handleSubmit } from "./routes/submit.ts";
import { handlePage } from "./routes/page.ts";
import { handleEmbed } from "./routes/embed.ts";
import { handleStats } from "./routes/stats.ts";

export default definePlugin({
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
  },
});

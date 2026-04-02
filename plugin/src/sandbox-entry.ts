import { definePlugin } from "emdash";
import { handleContentAfterSave } from "./hooks/content-after-save.ts";
import { handlePageMetadata } from "./hooks/page-metadata.ts";
import { handleCron } from "./hooks/cron.ts";
import { handleSubmit } from "./routes/submit.ts";
import { handlePage } from "./routes/page.ts";
import { handleEmbed } from "./routes/embed.ts";
import { handleStats } from "./routes/stats.ts";

export default definePlugin({
  hooks: {
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

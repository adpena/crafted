import type { PluginContext } from "emdash";

/** Placeholder for periodic A/B stats aggregation. */
export async function handleCron(_event: unknown, ctx: PluginContext): Promise<void> {
  ctx.log.info("cron: A/B stats aggregation placeholder");
}

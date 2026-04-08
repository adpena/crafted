/**
 * Cloudflare Workers entrypoint.
 *
 * Extends the Astro Cloudflare adapter's default handler with a
 * `scheduled` function so the same worker can serve HTTP requests AND
 * respond to Cloudflare Cron Triggers.
 *
 * Scheduled tasks:
 *   - D1 → R2 backup (runs when a Cron Trigger fires, gated on the
 *     BACKUPS R2 binding being present)
 */

import handler from "@astrojs/cloudflare/entrypoints/server";
import { runBackup, type BackupD1, type BackupR2 } from "./lib/backup.ts";

export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

interface ScheduledEnv {
  DB?: BackupD1;
  BACKUPS?: BackupR2;
}

interface ScheduledContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export default {
  fetch: handler.fetch,

  /**
   * Cron Trigger entrypoint.
   *
   * When multiple triggers are registered in wrangler.jsonc they all hit
   * this function — the `event.cron` field tells us which. For now only
   * the nightly backup schedule is wired up.
   */
  async scheduled(
    event: ScheduledEvent,
    env: ScheduledEnv,
    ctx: ScheduledContext,
  ): Promise<void> {
    // Run every scheduled task inside waitUntil so Workers keeps the
    // invocation alive until they resolve. If we awaited directly, the
    // runtime could terminate us at the first suspend point.
    ctx.waitUntil(runScheduledBackup(env, event));
  },
};

async function runScheduledBackup(env: ScheduledEnv, event: ScheduledEvent): Promise<void> {
  if (!env.DB) {
    console.warn("[scheduled] skipping backup: DB binding missing");
    return;
  }
  if (!env.BACKUPS) {
    console.warn("[scheduled] skipping backup: BACKUPS R2 binding missing");
    return;
  }
  try {
    const result = await runBackup(env.DB, env.BACKUPS);
    console.info(
      `[scheduled] backup ok cron=${event.cron} key=${result.key} rows=${result.rows} bytes=${result.bytes}`,
    );
  } catch (err) {
    console.error(
      "[scheduled] backup failed:",
      err instanceof Error ? err.message : "unknown",
    );
  }
}

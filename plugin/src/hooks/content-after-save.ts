import type { ContentHookEvent, PluginContext } from "emdash";

export async function handleContentAfterSave(event: ContentHookEvent, ctx: PluginContext): Promise<void> {
  if (event.collection === "action_pages") {
    ctx.log.info(`Action page saved: ${event.content.slug ?? event.content.id}`);
  }
}

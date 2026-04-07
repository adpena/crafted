import type { PageMetadataEvent, PageMetadataContribution, PluginContext } from "emdash";

export async function handlePageMetadata(
  event: PageMetadataEvent,
  ctx: PluginContext,
): Promise<PageMetadataContribution | PageMetadataContribution[] | null> {
  const path = event.page.path;
  if (!path) return null;

  // Check if this is an action page URL
  const match = path.match(/^\/action\/([^/]+)/);
  if (!match) return null;

  const slug = match[1]!;
  const result = await ctx.storage.action_pages!.query({ where: { slug } });
  const page = result.items[0]?.data as Record<string, unknown> | undefined;
  if (!page) return null;

  return [
    { kind: "property" as const, property: "og:title", content: page.title as string },
    { kind: "property" as const, property: "og:description", content: (page.description as string) ?? "" },
    { kind: "property" as const, property: "og:type", content: "website" },
  ];
}

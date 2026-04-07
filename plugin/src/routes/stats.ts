import type { RouteContext, PluginContext } from "emdash";
import { SLUG_RE } from "../lib/slug.ts";

export async function handleStats(routeCtx: RouteContext, ctx: PluginContext) {
  const input = routeCtx.input as { page_id?: string; campaign?: string } | undefined;
  const url = new URL(routeCtx.request.url);
  const pageId = input?.page_id ?? url.searchParams.get("page_id");
  const campaign = input?.campaign ?? url.searchParams.get("campaign");
  if (!pageId || !/^[a-z0-9][a-z0-9-]*$/.test(pageId)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Missing or invalid page_id parameter" } } };
  }

  const result = await ctx.storage.ab_variants!.query({ where: { page_id: pageId } });

  const stats = result.items.map((item) => {
    const v = item.data as Record<string, unknown>;
    const impressions = (v.impressions as number) || 0;
    const conversions = (v.conversions as number) || 0;
    const rate = impressions > 0 ? conversions / impressions : 0;

    return {
      variant: v.variant as string,
      impressions,
      conversions,
      conversion_rate: Math.round(rate * 10000) / 10000,
    };
  });

  return { status: 200, body: { data: { page_id: pageId, campaign: campaign ?? null, variants: stats } } };
}

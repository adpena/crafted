import type { RouteContext, PluginContext } from "emdash";
import { personalize, DEFAULT_AMOUNTS } from "../modules/geo-ask.ts";
import type { GeoContext } from "../modules/geo-ask.ts";
import { assignVariant } from "../modules/ab-assign.ts";
import { resolveDisclaimer } from "../modules/disclaimers.ts";
import type { Disclaimer } from "../modules/disclaimers.ts";

export async function handlePage(routeCtx: RouteContext, ctx: PluginContext) {
  const url = new URL(routeCtx.request.url);
  const slug = (routeCtx.input as { slug?: string })?.slug ?? url.searchParams.get("slug");

  if (!slug) {
    return { status: 400, body: { error: "Missing slug parameter" } };
  }

  const result = await ctx.storage.action_pages.query({ where: { slug } });
  const page = result.items[0]?.data as Record<string, unknown> | undefined;
  if (!page) {
    return { status: 404, body: { error: "Page not found" } };
  }

  const geo: GeoContext = {
    country: (routeCtx.requestMeta?.geo?.country as string) ?? "US",
    region: (routeCtx.requestMeta?.geo?.region as string) ?? "",
    city: (routeCtx.requestMeta?.geo?.city as string) ?? undefined,
  };

  const { jurisdiction, context_line } = personalize(geo);

  const visitorId = routeCtx.request.headers.get("x-visitor-id") ?? crypto.randomUUID();
  const variants = (page.variants as string[]) ?? ["control"];
  const variant = assignVariant(visitorId, variants);

  const disclaimerData = (await ctx.kv.get<Disclaimer[]>("disclaimers")) ?? [];
  const committeeName = (page.committee_name as string) ?? "";
  const disclaimer = resolveDisclaimer(disclaimerData, {
    jurisdiction,
    type: "digital",
    vars: { committee_name: committeeName },
  });

  return {
    status: 200,
    body: {
      title: (page.title as string) ?? "Action Page",
      type: (page.type as string) ?? "fundraise",
      body: (page.body as string) ?? "",
      actblue_url: (page.actblue_url as string) ?? "",
      refcode: (page.refcode as string) ?? "",
      amounts: DEFAULT_AMOUNTS,
      variant,
      disclaimer,
      geo,
      context_line,
    },
  };
}

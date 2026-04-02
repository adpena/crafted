import type { RouteContext, PluginContext } from "emdash";
import { suggestAmounts } from "../modules/geo-ask.ts";
import type { AmountConfig, GeoContext } from "../modules/geo-ask.ts";
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
  };

  const amountConfig = page.amount_config as AmountConfig | undefined;
  const amounts = amountConfig
    ? suggestAmounts(amountConfig, geo)
    : [10, 25, 50, 100, 250];

  const visitorId = routeCtx.request.headers.get("x-visitor-id") ?? crypto.randomUUID();
  const variants = (page.variants as string[]) ?? ["control"];
  const variant = assignVariant(visitorId, variants);

  const disclaimerData = (await ctx.kv.get<Disclaimer[]>("disclaimers")) ?? [];
  const committeeName = (page.committee_name as string) ?? "";
  const disclaimer = resolveDisclaimer(disclaimerData, {
    jurisdiction: geo.region || "FED",
    type: "digital",
    vars: { committee_name: committeeName },
  });

  const pageData = {
    title: (page.title as string) ?? "Action Page",
    type: (page.type as string) ?? "fundraise",
    body: (page.body as string) ?? "",
    actblue_url: (page.actblue_url as string) ?? "",
    refcode: (page.refcode as string) ?? "",
    amounts,
    variant,
    disclaimer,
    geo,
  };

  return { status: 200, body: pageData };
}

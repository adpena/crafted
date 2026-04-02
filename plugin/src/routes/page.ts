import type { RouteContext, PluginContext } from "emdash";
import { suggestAmounts } from "../modules/geo-ask.ts";
import type { AmountConfig } from "../modules/geo-ask.ts";
import { assignVariant } from "../modules/ab-assign.ts";
import { resolveDisclaimer } from "../modules/disclaimers.ts";
import type { Disclaimer } from "../modules/disclaimers.ts";

export async function handlePage(routeCtx: RouteContext, ctx: PluginContext) {
  const input = routeCtx.input as { slug?: string } | undefined;
  const slug = input?.slug ?? new URL(routeCtx.request.url).searchParams.get("slug");
  if (!slug) {
    return { status: 400, body: { error: "Missing slug parameter" } };
  }

  const result = await ctx.storage.action_pages.query({ where: { slug } });
  const page = result.items[0]?.data as Record<string, unknown> | undefined;
  if (!page) {
    return { status: 404, body: { error: "Page not found" } };
  }

  // Geo-personalization
  const geo = routeCtx.requestMeta.geo;
  const geoContext = { country: geo?.country ?? "US", region: geo?.region ?? "" };
  const amountConfig = page.amount_config as AmountConfig | undefined;
  const amounts = amountConfig ? suggestAmounts(amountConfig, geoContext) : null;

  // A/B variant assignment
  const visitorId = (routeCtx.request.headers.get("x-visitor-id") ?? crypto.randomUUID()) as string;
  const variants = (page.variants as string[] | undefined) ?? ["control"];
  const variant = assignVariant(visitorId, variants);

  // Disclaimer resolution
  const disclaimerData = await ctx.kv.get<Disclaimer[]>("disclaimers");
  const jurisdiction = (geo?.region ?? "FED") as string;
  const disclaimer = disclaimerData
    ? resolveDisclaimer(disclaimerData, {
        jurisdiction,
        type: "digital",
        vars: (page.disclaimer_vars as Record<string, string>) ?? {},
      })
    : null;

  return {
    status: 200,
    body: {
      page,
      amounts,
      variant,
      visitor_id: visitorId,
      disclaimer,
      geo: { country: geoContext.country, region: geoContext.region, city: geo?.city ?? null },
    },
  };
}

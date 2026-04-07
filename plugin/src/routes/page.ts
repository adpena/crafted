import type { RouteContext, PluginContext } from "emdash";
import { resolveJurisdiction, DEFAULT_AMOUNTS } from "../modules/geo-ask.ts";
import type { GeoContext } from "../modules/geo-ask.ts";
import { assignVariant } from "../modules/ab-assign.ts";
import { resolveDisclaimer } from "../modules/disclaimers.ts";
import type { Disclaimer } from "../modules/disclaimers.ts";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function handlePage(routeCtx: RouteContext, ctx: PluginContext) {
  const url = new URL(routeCtx.request.url);
  const input = routeCtx.input as { slug?: string; campaign?: string } | undefined;
  const slug = input?.slug ?? url.searchParams.get("slug");
  const campaignSlug = input?.campaign ?? url.searchParams.get("campaign");

  if (!slug || !SLUG_RE.test(slug)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Missing or invalid slug" } } };
  }

  // Build query — optionally scoped by campaign
  const where: Record<string, string> = { slug };
  if (campaignSlug) {
    if (!SLUG_RE.test(campaignSlug)) {
      return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Invalid campaign" } } };
    }
    // Resolve campaign ID from slug
    const campaignResult = await ctx.storage.campaigns!.query({ where: { slug: campaignSlug } });
    const campaign = campaignResult.items[0];
    if (!campaign) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Campaign not found" } } };
    }
    where.campaign_id = campaign.id;
  }

  const result = await ctx.storage.action_pages!.query({ where });
  const page = result.items[0]?.data as Record<string, unknown> | undefined;
  if (!page) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: "Page not found" } } };
  }

  const geo: GeoContext = {
    country: (routeCtx.requestMeta?.geo?.country as string) ?? "US",
    region: (routeCtx.requestMeta?.geo?.region as string) ?? "",
    city: (routeCtx.requestMeta?.geo?.city as string) ?? undefined,
  };

  const jurisdiction = resolveJurisdiction(geo);

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

  let actblue_url = "";
  try {
    const p = new URL((page.actblue_url as string) ?? "");
    if (p.protocol === "https:" && (p.hostname === "secure.actblue.com" || p.hostname === "actblue.com")) {
      actblue_url = p.href;
    }
  } catch {}

  return {
    status: 200,
    body: {
      data: {
        title: (page.title as string) ?? "Action Page",
        type: (page.type as string) ?? "fundraise",
        body: (page.body as string) ?? "",
        actblue_url,
        refcode: (page.refcode as string) ?? "",
        amounts: DEFAULT_AMOUNTS,
        variant,
        disclaimer,
        jurisdiction,
        campaign: campaignSlug ?? null,
      },
    },
  };
}

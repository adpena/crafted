import type { RouteContext, PluginContext } from "emdash";
import { SLUG_RE } from "../lib/slug.ts";

export async function handleEmbed(routeCtx: RouteContext, _ctx: PluginContext) {
  const input = routeCtx.input as { slug?: string; campaign?: string; base_url?: string } | undefined;
  const url = new URL(routeCtx.request.url);
  const slug = input?.slug ?? url.searchParams.get("slug");
  const campaign = input?.campaign ?? url.searchParams.get("campaign");

  if (!slug || !SLUG_RE.test(slug)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Missing or invalid slug" } } };
  }

  if (campaign && !SLUG_RE.test(campaign)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Invalid campaign" } } };
  }

  const rawBaseUrl = input?.base_url ?? url.origin;
  let baseUrl: string;
  try {
    const parsed = new URL(rawBaseUrl);
    baseUrl = parsed.origin !== url.origin ? url.origin : parsed.origin;
  } catch {
    baseUrl = url.origin;
  }

  const safeBase = JSON.stringify(baseUrl);
  const safeSlug = JSON.stringify(slug);
  const safeCampaign = campaign ? JSON.stringify(campaign) : "null";

  // Build the action page URL with optional campaign scope
  const script = `
(function() {
  var base = ${safeBase};
  var slug = ${safeSlug};
  var campaign = ${safeCampaign};
  var path = campaign ? '/action/' + campaign + '/' + slug : '/action/' + slug;
  var container = document.createElement('div');
  container.id = 'crafted-action-page-' + slug;
  var shadow = container.attachShadow({ mode: 'open' });
  var iframe = document.createElement('iframe');
  iframe.src = base + path;
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = '400px';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'Action Page');
  shadow.appendChild(iframe);
  document.currentScript.parentNode.insertBefore(container, document.currentScript);
})();
`.trim();

  return {
    status: 200,
    headers: { "content-type": "application/javascript; charset=utf-8" },
    body: script,
  };
}

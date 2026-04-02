import type { RouteContext, PluginContext } from "emdash";

export async function handleEmbed(routeCtx: RouteContext, _ctx: PluginContext) {
  const input = routeCtx.input as { slug?: string; base_url?: string } | undefined;
  const url = new URL(routeCtx.request.url);
  const slug = input?.slug ?? url.searchParams.get("slug");
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { status: 400, body: { error: "Missing or invalid slug parameter" } };
  }

  // Validate baseUrl to prevent open redirect -- must be same origin or a valid https URL
  const rawBaseUrl = input?.base_url ?? url.origin;
  let baseUrl: string;
  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.origin === url.origin || parsed.protocol === "https:") {
      baseUrl = parsed.origin;
    } else {
      baseUrl = url.origin;
    }
  } catch {
    baseUrl = url.origin;
  }

  const script = `
(function() {
  var container = document.createElement('div');
  container.id = 'crafted-action-page-${slug}';
  var shadow = container.attachShadow({ mode: 'open' });
  var iframe = document.createElement('iframe');
  iframe.src = '${baseUrl}/api/plugins/crafted-action-pages/page?slug=${slug}';
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

import type { RouteContext, PluginContext } from "emdash";

/**
 * Serves the <crafted-action-page> Web Component as a standalone IIFE.
 *
 * Mounted at /api/_plugin/action-pages/web-component.js by emdash's
 * route conventions. Designers drop one script tag into any HTML page and
 * use the custom element anywhere in the document:
 *
 *   <script src="https://adpena.com/api/_plugin/action-pages/web-component.js" async></script>
 *   <crafted-action-page slug="my-petition"></crafted-action-page>
 *
 * The body below is the runtime form of plugin/src/web-component/action-page.ts,
 * hand-rolled here so it can be served without a build step. Keep the two in
 * sync if you change the source — both are exercised by the test suite.
 */

const SCRIPT = `(function () {
  if (typeof customElements === "undefined") return;
  if (customElements.get("crafted-action-page")) return;

  var SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
  var STYLE_TEXT =
    ":host{display:block;width:100%;min-height:400px;contain:layout style}" +
    "iframe{display:block;width:100%;min-height:400px;border:0;background:transparent}" +
    ".crafted-error{padding:1rem;font-family:system-ui,sans-serif;color:#b91c1c;border:1px solid #fecaca;background:#fef2f2}";

  function isCraftedMessage(v) {
    return v && typeof v === "object" && (v.type === "crafted:resize" || v.type === "crafted:submit");
  }

  function ActionPageElement() {
    var self = Reflect.construct(HTMLElement, [], ActionPageElement);
    self._shadow = self.attachShadow({ mode: "open" });
    self._iframe = null;
    self._origin = "";
    self._onMessage = function (event) { self._handleMessage(event); };
    return self;
  }
  ActionPageElement.prototype = Object.create(HTMLElement.prototype);
  ActionPageElement.prototype.constructor = ActionPageElement;
  Object.setPrototypeOf(ActionPageElement, HTMLElement);

  Object.defineProperty(ActionPageElement, "observedAttributes", {
    get: function () { return ["slug", "campaign", "theme", "domain"]; }
  });

  ActionPageElement.prototype.connectedCallback = function () {
    window.addEventListener("message", this._onMessage);
    this._render();
  };
  ActionPageElement.prototype.disconnectedCallback = function () {
    window.removeEventListener("message", this._onMessage);
  };
  ActionPageElement.prototype.attributeChangedCallback = function (_n, oldV, newV) {
    if (oldV === newV) return;
    if (this.isConnected) this._render();
  };

  ActionPageElement.prototype._getOrigin = function () {
    var domain = this.getAttribute("domain");
    if (domain) {
      try { return new URL(domain).origin; } catch (_) {}
    }
    return (typeof window !== "undefined" && window.location) ? window.location.origin : "";
  };

  // Click attribution params to forward from parent page into the iframe.
  // Without this, fbclid/gclid/UTM params on the WordPress page are invisible
  // to the embedded action page, breaking ad conversion tracking.
  var FORWARD_PARAMS = [
    "fbclid", "gclid", "ttclid", "twclid", "li_fat_id", "rdt_cid", "scid", "msclkid",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"
  ];

  ActionPageElement.prototype._buildSrc = function () {
    var slug = this.getAttribute("slug");
    if (!slug || !SLUG_RE.test(slug)) return null;
    var campaign = this.getAttribute("campaign");
    if (campaign && !SLUG_RE.test(campaign)) return null;
    var theme = this.getAttribute("theme");
    var origin = this._getOrigin();
    var path = campaign ? "/action/" + campaign + "/" + slug : "/action/" + slug;
    var qs = "?embed=1" + (theme ? "&theme=" + encodeURIComponent(theme) : "");

    // Forward click attribution params from the parent page URL into the iframe.
    // This ensures fbclid, gclid, UTM params from Facebook/Google ads are captured
    // by the embedded action page even when it's in an iframe on a WordPress site.
    if (typeof window !== "undefined" && window.location && window.location.search) {
      try {
        var parentParams = new URLSearchParams(window.location.search);
        for (var i = 0; i < FORWARD_PARAMS.length; i++) {
          var val = parentParams.get(FORWARD_PARAMS[i]);
          if (val) qs += "&" + FORWARD_PARAMS[i] + "=" + encodeURIComponent(val);
        }
      } catch (_) { /* older browsers without URLSearchParams — params won't forward */ }
    }

    return (origin || "") + path + qs;
  };

  ActionPageElement.prototype._render = function () {
    var src = this._buildSrc();
    this._origin = this._getOrigin();
    var shadow = this._shadow;

    if (!shadow.querySelector("style")) {
      var style = document.createElement("style");
      style.textContent = STYLE_TEXT;
      shadow.appendChild(style);
    }

    var children = Array.prototype.slice.call(shadow.children);
    for (var i = 0; i < children.length; i++) {
      if (children[i].tagName !== "STYLE") shadow.removeChild(children[i]);
    }

    if (!src) {
      var err = document.createElement("div");
      err.className = "crafted-error";
      err.textContent = "[crafted-action-page] Missing or invalid 'slug' attribute.";
      shadow.appendChild(err);
      this._iframe = null;
      return;
    }

    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", "Action Page");
    iframe.setAttribute("allow", "payment");
    shadow.appendChild(iframe);
    this._iframe = iframe;
  };

  ActionPageElement.prototype._handleMessage = function (event) {
    if (!this._origin) return;
    if (event.origin !== this._origin) return;
    if (!this._iframe || event.source !== this._iframe.contentWindow) return;
    if (!isCraftedMessage(event.data)) return;
    if (event.data.type === "crafted:resize") {
      var h = Number(event.data.height);
      if (isFinite(h) && h > 0 && this._iframe) {
        this._iframe.style.height = h + "px";
        this.dispatchEvent(new CustomEvent("craftedResize", {
          detail: { height: h }, bubbles: true, composed: true
        }));
      }
      return;
    }
    if (event.data.type === "crafted:submit") {
      this.dispatchEvent(new CustomEvent("craftedSubmit", {
        detail: event.data.payload, bubbles: true, composed: true
      }));
    }
  };

  customElements.define("crafted-action-page", ActionPageElement);
})();`;

export async function handleWebComponent(_routeCtx: RouteContext, _ctx: PluginContext) {
  return {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
    body: SCRIPT,
  };
}

// Exported for tests so we can sanity-check the served script.
export const WEB_COMPONENT_SCRIPT = SCRIPT;

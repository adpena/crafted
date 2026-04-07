import { describe, it, expect } from "vitest";
import { generateHtmlForm } from "../src/web-component/html-form.js";
import { WEB_COMPONENT_SCRIPT, handleWebComponent } from "../src/routes/web-component.js";

/* ------------------------------------------------------------------ */
/*  generateHtmlForm                                                   */
/* ------------------------------------------------------------------ */

describe("generateHtmlForm", () => {
  const baseOpts = {
    slug: "my-petition",
    domain: "https://adpena.com",
  };

  it("produces valid HTML for a petition", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition" });
    expect(html).toContain("<form");
    expect(html).toContain("</form>");
    expect(html).toContain('id="crafted-form-my-petition"');
    expect(html).toContain('name="first_name"');
    expect(html).toContain('name="last_name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="zip"');
    expect(html).toContain('name="comment"');
    expect(html).toContain('value="petition_sign"');
  });

  it("produces valid HTML for a fundraise", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "fundraise" });
    expect(html).toContain('name="amount"');
    expect(html).toContain('type="number"');
    expect(html).toContain('value="donation_click"');
  });

  it("produces valid HTML for gotv", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "gotv" });
    expect(html).toContain('name="first_name"');
    expect(html).toContain('name="zip"');
    expect(html).toContain('name="pledge"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('value="gotv_pledge"');
  });

  it("produces valid HTML for signup", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "signup" });
    expect(html).toContain('name="email"');
    expect(html).toContain('value="signup"');
  });

  it("includes the correct submit endpoint", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition" });
    expect(html).toContain('action="https://adpena.com/api/_plugin/crafted-action-pages/submit"');
  });

  it("strips trailing slashes from the domain", () => {
    const html = generateHtmlForm({ ...baseOpts, domain: "https://adpena.com///", action: "signup" });
    expect(html).toContain('action="https://adpena.com/api/_plugin/crafted-action-pages/submit"');
    expect(html).not.toContain("//api/_plugin");
  });

  it("emits a hidden page_id matching the slug", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition" });
    expect(html).toContain('<input type="hidden" name="page_id" value="my-petition">');
  });

  it("emits a hidden campaign_id when campaign is provided", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition", campaign: "texas-aft" });
    expect(html).toContain('name="campaign_id" value="texas-aft"');
  });

  it("omits the campaign_id input when campaign is not provided", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition" });
    expect(html).not.toContain('name="campaign_id"');
  });

  it("includes theme CSS variables", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition", theme: "warm" });
    expect(html).toContain("--page-bg");
    expect(html).toContain("--page-text");
    expect(html).toContain("--page-accent");
    expect(html).toContain("--page-font-serif");
  });

  it("uses the bold theme tokens when requested", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition", theme: "bold" });
    // bold theme background is #0a0a0a
    expect(html).toContain("#0a0a0a");
  });

  it("merges custom theme objects over defaults", () => {
    const html = generateHtmlForm({
      ...baseOpts,
      action: "petition",
      theme: { "--page-accent": "#ff00aa" },
    });
    expect(html).toContain("#ff00aa");
  });

  it("does not include hx-* attributes when htmx is not requested", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition" });
    expect(html).not.toContain("hx-post");
    expect(html).not.toContain("hx-target");
  });

  it("includes hx-* attributes when htmx is requested", () => {
    const html = generateHtmlForm({ ...baseOpts, action: "petition", htmx: true });
    expect(html).toContain('hx-post="https://adpena.com/api/_plugin/crafted-action-pages/submit"');
    expect(html).toContain("hx-target");
    expect(html).toContain("hx-swap");
  });

  it("escapes user-controlled values in attributes", () => {
    const html = generateHtmlForm({
      slug: "ok-slug",
      domain: "https://adpena.com",
      action: "petition",
      submitLabel: '<script>alert(1)</script>',
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("throws on an unknown action type", () => {
    expect(() =>
      generateHtmlForm({ ...baseOpts, action: "nope" as unknown as "petition" }),
    ).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

describe("handleWebComponent route", () => {
  it("returns the IIFE-wrapped script with the right headers", async () => {
    const fakeReq = new Request("https://adpena.com/api/_plugin/crafted-action-pages/web-component.js");
    const result = await handleWebComponent(
      { request: fakeReq, requestMeta: {}, input: undefined } as never,
      {} as never,
    );
    expect(result.status).toBe(200);
    expect(result.headers?.["content-type"]).toContain("application/javascript");
    expect(result.headers?.["cache-control"]).toContain("max-age=3600");
    expect(typeof result.body).toBe("string");
    expect(result.body).toContain("customElements.define");
    expect(result.body).toContain('"crafted-action-page"');
  });

  it("script body starts with an IIFE", () => {
    expect(WEB_COMPONENT_SCRIPT.startsWith("(function ()")).toBe(true);
    expect(WEB_COMPONENT_SCRIPT.trim().endsWith("})();")).toBe(true);
  });

  it("script defines the four observed attributes", () => {
    expect(WEB_COMPONENT_SCRIPT).toContain('"slug"');
    expect(WEB_COMPONENT_SCRIPT).toContain('"campaign"');
    expect(WEB_COMPONENT_SCRIPT).toContain('"theme"');
    expect(WEB_COMPONENT_SCRIPT).toContain('"domain"');
  });

  it("script registers craftedSubmit and craftedResize events", () => {
    expect(WEB_COMPONENT_SCRIPT).toContain("craftedSubmit");
    expect(WEB_COMPONENT_SCRIPT).toContain("craftedResize");
  });

  it("script validates iframe origin against the domain attribute", () => {
    expect(WEB_COMPONENT_SCRIPT).toContain("event.origin");
  });
});

/* ------------------------------------------------------------------ */
/*  Custom Element runtime                                             */
/*                                                                     */
/*  Vitest's default `node` environment has no window/customElements,  */
/*  and we don't want to add a heavy DOM dep. Instead we evaluate the  */
/*  served IIFE against a minimal stub DOM and verify the element gets */
/*  registered with the right name and `observedAttributes`.           */
/* ------------------------------------------------------------------ */

describe("custom element registration (sandboxed runtime)", () => {
  function createStubDom() {
    const registry = new Map<string, unknown>();
    const customElements = {
      define(name: string, ctor: unknown) {
        registry.set(name, ctor);
      },
      get(name: string) {
        return registry.get(name);
      },
    };

    class StubHTMLElement {
      isConnected = false;
      attachShadow() {
        return { children: [], querySelector: () => null, appendChild: () => {}, removeChild: () => {} };
      }
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
      getAttribute() { return null; }
    }

    const win: Record<string, unknown> = {
      customElements,
      HTMLElement: StubHTMLElement,
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { origin: "https://adpena.com" },
      Reflect: { construct: (_t: unknown, _a: unknown, _n: unknown) => new StubHTMLElement() },
      URL,
      CustomEvent: class { constructor(public type: string, public init?: unknown) {} },
      document: { createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }) },
    };
    return { win, registry, customElements };
  }

  it("registers <crafted-action-page> when the IIFE runs", () => {
    const { win, registry } = createStubDom();
    const fn = new Function(
      "customElements", "HTMLElement", "Reflect", "URL", "CustomEvent", "window", "document",
      `var addEventListener = function(){}; var removeEventListener = function(){}; ${WEB_COMPONENT_SCRIPT}`,
    );
    fn(win.customElements, win.HTMLElement, win.Reflect, win.URL, win.CustomEvent, win, win.document);
    expect(registry.has("crafted-action-page")).toBe(true);
  });

  it("the registered constructor exposes the four observed attributes", () => {
    const { win, registry } = createStubDom();
    const fn = new Function(
      "customElements", "HTMLElement", "Reflect", "URL", "CustomEvent", "window", "document",
      `var addEventListener = function(){}; var removeEventListener = function(){}; ${WEB_COMPONENT_SCRIPT}`,
    );
    fn(win.customElements, win.HTMLElement, win.Reflect, win.URL, win.CustomEvent, win, win.document);
    const ctor = registry.get("crafted-action-page") as { observedAttributes?: string[] };
    expect(ctor?.observedAttributes).toEqual(["slug", "campaign", "theme", "domain"]);
  });
});

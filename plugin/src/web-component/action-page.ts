/**
 * <crafted-action-page> — framework-agnostic Web Component
 *
 * A Custom Element that wraps the action-page iframe embed and exposes a
 * clean attribute API. Drop it into any framework: HTML, HTMX, React, Vue,
 * Solid, Svelte. Zero dependencies.
 *
 * Usage:
 *
 *   <crafted-action-page
 *     slug="my-petition"
 *     campaign="texas-aft"
 *     theme="warm"
 *     domain="https://adpena.com"
 *   ></crafted-action-page>
 *
 * Events:
 *   - "craftedSubmit" — CustomEvent fired when the iframe reports a successful
 *     submission. The submission payload is on `event.detail`.
 *   - "craftedResize" — CustomEvent fired when the iframe reports a height
 *     change. `event.detail = { height: number }`.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const TAG_NAME = "crafted-action-page";

export type CraftedSubmitDetail = {
  type: string;
  page_id?: string;
  campaign_id?: string | null;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CraftedResizeDetail = {
  height: number;
};

type CraftedMessage =
  | { type: "crafted:resize"; height: number }
  | { type: "crafted:submit"; payload: CraftedSubmitDetail };

function isCraftedMessage(value: unknown): value is CraftedMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown };
  return v.type === "crafted:resize" || v.type === "crafted:submit";
}

export class ActionPageElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["slug", "campaign", "theme", "domain"];
  }

  private iframe: HTMLIFrameElement | null = null;
  private shadow: ShadowRoot;
  private messageHandler: (event: MessageEvent) => void;
  private resolvedOrigin = "";

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.messageHandler = (event: MessageEvent) => this.handleMessage(event);
  }

  connectedCallback(): void {
    window.addEventListener("message", this.messageHandler);
    this.render();
  }

  disconnectedCallback(): void {
    window.removeEventListener("message", this.messageHandler);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    // Only re-render if we are already mounted
    if (this.isConnected) {
      this.render();
    }
  }

  private getOrigin(): string {
    const domain = this.getAttribute("domain");
    if (domain) {
      try {
        return new URL(domain).origin;
      } catch {
        // Fall through
      }
    }
    if (typeof window !== "undefined" && window.location) {
      return window.location.origin;
    }
    return "";
  }

  private buildSrc(): string | null {
    const slug = this.getAttribute("slug");
    if (!slug || !SLUG_RE.test(slug)) {
      return null;
    }
    const campaign = this.getAttribute("campaign");
    if (campaign && !SLUG_RE.test(campaign)) {
      return null;
    }
    const theme = this.getAttribute("theme");
    const origin = this.getOrigin();
    const path = campaign ? `/action/${campaign}/${slug}` : `/action/${slug}`;
    const url = new URL(path, origin || "http://localhost");
    url.searchParams.set("embed", "1");
    if (theme) url.searchParams.set("theme", theme);
    return origin ? `${origin}${url.pathname}${url.search}` : `${url.pathname}${url.search}`;
  }

  private render(): void {
    const src = this.buildSrc();
    this.resolvedOrigin = this.getOrigin();

    // Inject styles once
    if (!this.shadow.querySelector("style")) {
      const style = document.createElement("style");
      style.textContent = `
        :host {
          display: block;
          width: 100%;
          min-height: 400px;
          contain: layout style;
        }
        iframe {
          display: block;
          width: 100%;
          min-height: 400px;
          border: 0;
          background: transparent;
        }
        .crafted-error {
          padding: 1rem;
          font-family: system-ui, sans-serif;
          color: #b91c1c;
          border: 1px solid #fecaca;
          background: #fef2f2;
        }
      `;
      this.shadow.appendChild(style);
    }

    // Remove any prior content (other than the style)
    Array.from(this.shadow.children).forEach((child) => {
      if (child.tagName !== "STYLE") child.remove();
    });

    if (!src) {
      const err = document.createElement("div");
      err.className = "crafted-error";
      err.textContent = "[crafted-action-page] Missing or invalid 'slug' attribute.";
      this.shadow.appendChild(err);
      this.iframe = null;
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("title", "Action Page");
    iframe.setAttribute("allow", "payment");
    this.shadow.appendChild(iframe);
    this.iframe = iframe;
  }

  private handleMessage(event: MessageEvent): void {
    // Origin must match the resolved domain
    if (this.resolvedOrigin && event.origin !== this.resolvedOrigin) {
      return;
    }
    // Source must be our iframe's contentWindow
    if (!this.iframe || event.source !== this.iframe.contentWindow) {
      return;
    }
    if (!isCraftedMessage(event.data)) return;

    if (event.data.type === "crafted:resize") {
      const height = Number(event.data.height);
      if (Number.isFinite(height) && height > 0 && this.iframe) {
        this.iframe.style.height = `${height}px`;
        this.dispatchEvent(
          new CustomEvent<CraftedResizeDetail>("craftedResize", {
            detail: { height },
            bubbles: true,
            composed: true,
          }),
        );
      }
      return;
    }

    if (event.data.type === "crafted:submit") {
      this.dispatchEvent(
        new CustomEvent<CraftedSubmitDetail>("craftedSubmit", {
          detail: event.data.payload,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

// Self-register at module load. Idempotent — safe to import twice.
if (typeof customElements !== "undefined" && !customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, ActionPageElement);
}

export { TAG_NAME };
